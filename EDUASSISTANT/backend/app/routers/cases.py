import os
from datetime import datetime
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, Request, Response, WebSocket, WebSocketDisconnect, Query
import jwt
from fastapi.responses import HTMLResponse

from app.db.db import db_service
from app.services.ai_service import extract_case_data
from app.services.rule_engine import evaluate_case
from app.services.workflow_guard import validate_status_transition
from app.services.escalation_policy_service import record_reviewer_feedback
from app.services.report_service import (
    generate_cases_csv,
    generate_cases_table_html,
    generate_decision_html
)
from app.core.responses import api_response
from app.core.dependencies import get_current_user, require_roles
from app.config import JWT_SECRET
from app.realtime import comment_hub, case_event_hub
from app.schemas.cases import (
    CreateCaseRequest,
    ReviewCaseRequest,
    ReviewerFeedbackRequest,
    AddCommentRequest,
    SupplementCaseRequest,
    ReRouteCaseRequest
)

router = APIRouter(tags=["Cases"])


@router.websocket("/ws/comments/{case_id}")
async def comment_websocket(
    websocket: WebSocket,
    case_id: str,
    token: str = Query(...),
):
    """Subscribe an authenticated participant to one case's comment room."""
    try:
        identity = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user = await db_service.get_user_by_id(identity.get("id"))
        target_case = await db_service.get_case_by_id(case_id)
        if not user or not target_case:
            await websocket.close(code=1008)
            return
        if user["role"] == "STUDENT" and target_case["studentId"] != user["id"]:
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return

    await comment_hub.connect(case_id, websocket)
    try:
        while True:
            # Keeps the connection open and permits a lightweight client ping.
            await websocket.receive_text()
    except WebSocketDisconnect:
        comment_hub.disconnect(case_id, websocket)


@router.websocket("/ws/cases")
async def case_events_websocket(websocket: WebSocket, token: str = Query(...)):
    """Push new and updated cases to authenticated reviewer/admin queues."""
    try:
        identity = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user = await db_service.get_user_by_id(identity.get("id"))
        if not user:
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return
    await case_event_hub.connect(websocket, {'id': user['id'], 'role': user['role']})
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        case_event_hub.disconnect(websocket)


@router.get("/api/cases/my-cases")
async def get_my_cases(user: dict = Depends(get_current_user)):
    student_cases = await db_service.get_cases({'studentId': user['id']})
    return api_response(200, True, 'Lấy danh sách hồ sơ của sinh viên thành công.', {
        'cases': student_cases,
        'total': len(student_cases)
    })


@router.get("/api/cases")
async def get_cases(
    status: Optional[str] = 'ALL',
    category: Optional[str] = 'ALL',
    department: Optional[str] = 'ALL',
    user: dict = Depends(get_current_user)
):
    filter_dict = {
        'status': status,
        'category': category,
        'department': department
    }
    if user['role'] == 'STUDENT':
        filter_dict['studentId'] = user['id']

    cases = await db_service.get_cases(filter_dict)
    return api_response(200, True, 'Lấy danh sách hồ sơ thành công.', {'cases': cases, 'total': len(cases)})


@router.get("/api/cases/{case_id}")
async def get_case_detail(case_id: str, user: dict = Depends(get_current_user)):
    target_case = await db_service.get_case_by_id(case_id)
    if not target_case:
        return api_response(404, False, f"Không tìm thấy hồ sơ #{case_id}.", None, 'NOT_FOUND')

    if user['role'] == 'STUDENT' and target_case['studentId'] != user['id']:
        await db_service.log_audit({
            'action': 'IDOR_ACCESS_BLOCKED',
            'actor': {'id': user['id'], 'username': user['username'], 'role': user['role'], 'name': user['fullName']},
            'caseId': case_id,
            'input': {'targetCaseOwner': target_case['studentId']},
            'result': 'BLOCKED',
            'reason': f"Sinh viên {user['username']} cố gắng truy cập trái phép hồ sơ #{case_id} của {target_case['studentName']}"
        })
        return api_response(403, False, 'Bạn không có quyền truy cập hồ sơ của sinh viên khác.', None, 'FORBIDDEN')

    return api_response(200, True, 'Lấy chi tiết hồ sơ thành công.', {'case': target_case, **target_case})


@router.post("/api/cases")
async def create_case_endpoint(req: CreateCaseRequest, user: dict = Depends(get_current_user)):
    if user['role'] != 'STUDENT' and user['role'] != 'ADMIN':
        return api_response(403, False, 'Chỉ sinh viên mới được quyền tạo hồ sơ học vụ.', None, 'FORBIDDEN')

    case_dict = req.dict()
    ai_res = await extract_case_data(case_dict, user)
    ai_extraction = ai_res.get('data', {})
    case_dict['aiExtraction'] = ai_extraction
    case_dict['aiMetadata'] = {
        'modeUsed': ai_res.get('modeUsed'),
        'fallbackOccurred': ai_res.get('fallbackOccurred'),
        'fallbackReason': ai_res.get('fallbackReason'),
        'durationMs': ai_res.get('durationMs')
    }

    # Ưu tiên dữ kiện OCR từ tệp minh chứng thực tế thay vì text AI
    files = case_dict.get('evidenceFiles') or []
    factual_ocr = files[0].get('ocrData') if (files and isinstance(files[0], dict)) else None

    rule_verdict = evaluate_case(case_dict, factual_ocr, user)

    case_dict['ruleEngine'] = rule_verdict
    case_dict['status'] = rule_verdict['status']

    if rule_verdict.get('escalationReason'):
        case_dict['escalation'] = {
            'reason': rule_verdict['escalationReason'],
            'explanation': rule_verdict['explanation'],
            'config': rule_verdict.get('escalationConfig'),
            'ruleMatched': rule_verdict.get('ruleMatched')
        }

    created = await db_service.create_case(case_dict, user)
    await case_event_hub.broadcast({'type': 'case_created', 'case': created}, roles={'REVIEWER', 'ADMIN'})
    return api_response(201, True, 'Tạo hồ sơ học vụ thành công.', {'case': created, **(created or {})})


@router.post("/api/cases/{case_id}/supplement")
async def supplement_case_endpoint(
    case_id: str,
    req: SupplementCaseRequest,
    user: dict = Depends(get_current_user)
):
    target_case = await db_service.get_case_by_id(case_id)
    if not target_case:
        return api_response(404, False, f"Không tìm thấy hồ sơ #{case_id}.", None, 'NOT_FOUND')

    if user['role'] == 'STUDENT' and target_case['studentId'] != user['id']:
        return api_response(403, False, 'Bạn không có quyền bổ sung hồ sơ của sinh viên khác.', None, 'FORBIDDEN')

    supplement_entry = {
        'note': req.additionalDescription,
        'files': req.newEvidenceFiles,
        'submittedAt': datetime.utcnow().isoformat() + 'Z'
    }
    history = target_case.get('supplementHistory') or []
    if isinstance(history, list):
        history.append(supplement_entry)
    else:
        history = [supplement_entry]

    current_files = target_case.get('evidenceFiles') or []
    new_files = req.newEvidenceFiles or []
    merged_files = current_files + [f for f in new_files if f not in current_files]

    updated = await db_service.update_case_status(
        case_id,
        'UNDER_REVIEW',
        user,
        req.additionalDescription or 'Sinh viên gửi bổ sung minh chứng',
        {
            'supplementHistory': history,
            'evidenceFiles': merged_files
        }
    )

    return api_response(200, True, f"Bổ sung hồ sơ #{case_id} thành công.", {'case': updated, **(updated or {})})


@router.post("/api/cases/{case_id}/re-route")
async def re_route_case_endpoint(
    case_id: str,
    req: ReRouteCaseRequest,
    user: dict = Depends(require_roles('REVIEWER', 'ADMIN'))
):
    target_case = await db_service.get_case_by_id(case_id)
    if not target_case:
        return api_response(404, False, f"Không tìm thấy hồ sơ #{case_id}.", None, 'NOT_FOUND')

    updated = await db_service.update_case_status(
        case_id,
        target_case['status'],
        user,
        f"Cán bộ {user['fullName']} điều phối hồ sơ sang {req.department}",
        {'assignedDepartment': req.department}
    )

    return api_response(200, True, f"Điều phối hồ sơ #{case_id} sang {req.department} thành công.", {'case': updated, **(updated or {})})


@router.post("/api/cases/{case_id}/evaluate-rules")
async def evaluate_rules_endpoint(
    case_id: str,
    user: dict = Depends(require_roles('REVIEWER', 'ADMIN'))
):
    target_case, student_user = await db_service.get_case_with_student(case_id)
    if not target_case:
        return api_response(404, False, f"Không tìm thấy hồ sơ #{case_id}.", None, 'NOT_FOUND')

    files = target_case.get('evidenceFiles') or []
    factual_ocr = files[0].get('ocrData') if (files and isinstance(files[0], dict)) else None
    rule_verdict = evaluate_case(target_case, factual_ocr, student_user or {})

    return api_response(200, True, 'Đánh giá lại quy tắc hồ sơ thành công.', {
        'caseId': case_id,
        'evaluation': rule_verdict
    })


@router.post("/api/cases/{case_id}/review")
async def review_case(
    case_id: str,
    req: ReviewCaseRequest,
    user: dict = Depends(require_roles('REVIEWER', 'ADMIN'))
):
    target_case = await db_service.get_case_by_id(case_id)
    if not target_case:
        return api_response(404, False, f"Không tìm thấy hồ sơ #{case_id}.", None, 'NOT_FOUND')

    VALID_ACTIONS = {'APPROVE', 'APPROVED', 'REJECT', 'REJECTED', 'REQUEST_INFO', 'REQUIRE_SUPPLEMENT', 'REQUIRES_SUPPLEMENT', 'OVERRIDE', 'STOP'}
    raw_action = (req.action or req.decision or '').strip().upper()
    if not raw_action or raw_action not in VALID_ACTIONS:
        return api_response(
            400,
            False,
            f"Hành động thẩm định '{req.action or req.decision}' không hợp lệ. Chỉ chấp nhận APPROVE, REJECT, REQUEST_INFO, OVERRIDE, STOP.",
            None,
            'INVALID_REVIEW_ACTION'
        )

    action = raw_action
    is_override = action == 'OVERRIDE'
    override_reason = req.overrideReason or (req.reason if is_override else None)

    if is_override:
        if not override_reason or len(override_reason.strip()) < 3:
            return api_response(400, False, 'Bắt buộc phải cung cấp lý do ghi đè (overrideReason) khi thực hiện OVERRIDE.', None, 'OVERRIDE_REASON_REQUIRED')
        next_status = (req.targetStatus or 'APPROVED').upper()
        action_label = f"GHI ĐÈ THẨM ĐỊNH (OVERRIDE -> {next_status})"
    elif action in ('APPROVE', 'APPROVED'):
        next_status = 'APPROVED'
        action_label = 'CHẤP THUẬN (APPROVED)'
    elif action in ('REJECT', 'REJECTED'):
        next_status = 'REJECTED'
        action_label = 'TỪ CHỐI (REJECTED)'
    elif action in ('REQUIRE_SUPPLEMENT', 'REQUIRES_SUPPLEMENT', 'REQUEST_INFO'):
        next_status = 'REQUIRES_SUPPLEMENT'
        action_label = 'YÊU CẦU BỔ SUNG HỒ SƠ'
    elif action == 'STOP':
        next_status = 'STOPPED'
        action_label = 'DỪNG TIẾN TRÌNH XỬ LÝ (STOPPED)'
    else:
        return api_response(400, False, f"Hành động '{action}' không hợp lệ.", None, 'INVALID_REVIEW_ACTION')

    # Bảo vệ chuyển đổi trạng thái bằng Workflow State Transition Guard
    is_admin = user['role'] == 'ADMIN'
    is_valid_trans, trans_err = validate_status_transition(
        current_status=target_case['status'],
        next_status=next_status,
        actor_role=user['role'],
        is_admin_override=(is_override and is_admin)
    )
    if not is_valid_trans:
        return api_response(400, False, trans_err, None, 'INVALID_STATUS_TRANSITION')

    prior_rec = (target_case.get('ruleEngine') or {}).get('decision') or 'AUTO_ESCALATED'

    review_result = {
        'action': action,
        'decision': action_label,
        'reason': override_reason if is_override else (req.reason or 'Thẩm định hồ sơ'),
        'overrideReason': override_reason if is_override else None,
        'previousRecommendation': prior_rec if is_override else None,
        'reviewerId': user['id'],
        'reviewerName': user['fullName'],
        'reviewerRole': user['role'],
        'reviewerDepartment': user.get('department') or target_case.get('assignedDepartment'),
        'reviewedAt': datetime.utcnow().isoformat() + 'Z'
    }

    if is_override:
        await db_service.log_audit({
            'action': 'HUMAN_OVERRIDE',
            'actor': {'id': user['id'], 'username': user['username'], 'role': user['role'], 'name': user.get('fullName')},
            'caseId': case_id,
            'input': {
                'systemRecommendation': prior_rec,
                'humanAction': 'OVERRIDE',
                'targetStatus': next_status,
                'overrideReason': override_reason
            },
            'result': f"OVERRIDDEN_TO_{next_status}",
            'reason': override_reason
        })

    updated = await db_service.update_case_status(
        case_id,
        next_status,
        user,
        override_reason if is_override else (req.reason or f"Thẩm định viên {user['fullName']} đã {action_label}"),
        {
            'reviewResult': review_result,
            'assignedDepartment': req.assignedDepartment or target_case.get('assignedDepartment')
        }
    )

    return api_response(200, True, f"Thẩm định hồ sơ #{case_id} thành công ({next_status}).", {'case': updated, **(updated or {})})


@router.post("/api/cases/{case_id}/feedback")
async def submit_case_feedback(
    case_id: str,
    req: ReviewerFeedbackRequest,
    user: dict = Depends(require_roles('REVIEWER', 'ADMIN'))
):
    target_case = await db_service.get_case_by_id(case_id)
    if not target_case:
        return api_response(404, False, f"Không tìm thấy hồ sơ #{case_id}.", None, 'NOT_FOUND')

    fb_type = (req.type or '').strip().upper()
    if fb_type not in ('CORRECT', 'MISSED_ESCALATION', 'UNNECESSARY_ESCALATION'):
        return api_response(
            400,
            False,
            'Loại phản hồi phải là CORRECT, MISSED_ESCALATION hoặc UNNECESSARY_ESCALATION.',
            None,
            'INVALID_FEEDBACK_TYPE'
        )

    res = record_reviewer_feedback(
        case_id=case_id,
        feedback_type=fb_type,
        reviewer=user.get('fullName') or user.get('username'),
        note=req.note
    )

    feedback_entry = {
        'type': fb_type,
        'note': req.note or '',
        'reviewerId': user['id'],
        'reviewerName': user.get('fullName') or user.get('username'),
        'reviewerRole': user['role'],
        'oldThreshold': res['oldThreshold'],
        'newThreshold': res['newThreshold'],
        'submittedAt': datetime.utcnow().isoformat() + 'Z'
    }

    feedbacks = target_case.get('reviewerFeedback') or []
    if isinstance(feedbacks, list):
        feedbacks.append(feedback_entry)
    else:
        feedbacks = [feedback_entry]

    await db_service.update_case_status(
        case_id,
        target_case['status'],
        user,
        f"Thẩm định viên {user['fullName']} gửi phản hồi feedback: {fb_type}",
        {'reviewerFeedback': feedbacks}
    )

    await db_service.log_audit({
        'action': 'REVIEWER_FEEDBACK_SUBMITTED',
        'actor': {'id': user['id'], 'username': user['username'], 'role': user['role'], 'name': user.get('fullName')},
        'caseId': case_id,
        'input': {
            'feedbackType': fb_type,
            'note': req.note,
            'oldThreshold': res['oldThreshold'],
            'newThreshold': res['newThreshold']
        },
        'result': 'SUCCESS',
        'reason': f"Phản hồi thẩm định viên {fb_type}: điều chỉnh ngưỡng tin cậy từ {res['oldThreshold']} sang {res['newThreshold']}"
    })

    return api_response(200, True, f"Tiếp nhận phản hồi thành công. Ngưỡng tin cậy thích ứng hiện tại: {res['newThreshold']}.", {
        'caseId': case_id,
        'feedback': feedback_entry,
        'threshold': res
    })


@router.get("/api/cases/{case_id}/comments")
async def get_case_comments(case_id: str, user: dict = Depends(get_current_user)):
    target_case, comments = await db_service.get_case_with_comments(case_id)
    if not target_case:
        return api_response(404, False, f"Không tìm thấy hồ sơ #{case_id}.", None, 'NOT_FOUND')

    if user['role'] == 'STUDENT' and target_case['studentId'] != user['id']:
        return api_response(403, False, 'Bạn không có quyền xem bình luận trên hồ sơ của sinh viên khác.', None, 'FORBIDDEN')

    return api_response(200, True, 'Lấy danh sách bình luận thành công.', comments)


@router.post("/api/cases/{case_id}/comments")
async def add_case_comment(case_id: str, req: AddCommentRequest, user: dict = Depends(get_current_user)):
    target_case = await db_service.get_case_by_id(case_id)
    if not target_case:
        return api_response(404, False, f"Không tìm thấy hồ sơ #{case_id}.", None, 'NOT_FOUND')

    if user['role'] == 'STUDENT' and target_case['studentId'] != user['id']:
        return api_response(403, False, 'Bạn không có quyền bình luận trên hồ sơ của sinh viên khác.', None, 'FORBIDDEN')

    if not req.content or not req.content.strip():
        return api_response(400, False, 'Nội dung bình luận không được để trống.', None, 'EMPTY_COMMENT')

    new_cmt = await db_service.add_comment(case_id, user, req.content, target_case)
    await comment_hub.broadcast(case_id, {
        'type': 'comment_created',
        'caseId': case_id,
        'comment': new_cmt,
    })
    return api_response(201, True, 'Thêm bình luận thành công.', new_cmt)


@router.get("/api/cases/{case_id}/export-decision")
async def export_decision(case_id: str, request: Request, user: dict = Depends(get_current_user)):
    target_case = await db_service.get_case_by_id(case_id)
    if not target_case:
        return api_response(404, False, 'Không tìm thấy hồ sơ.', None, 'NOT_FOUND')

    if user['role'] == 'STUDENT' and target_case['studentId'] != user['id']:
        return api_response(403, False, 'Bạn không có quyền truy cập quyết định này.', None, 'FORBIDDEN')

    base_url = str(request.base_url).rstrip('/')
    html_content = generate_decision_html(target_case, base_url)
    return HTMLResponse(content=html_content)


@router.get("/api/cases/verify/{case_id}")
async def verify_case_public(case_id: str):
    verification_data = await db_service.get_case_for_verification(case_id)
    if not verification_data:
        return api_response(404, False, 'Không tìm thấy hồ sơ để xác thực.', None, 'NOT_FOUND')
    return api_response(200, True, 'Tra cứu xác thực chứng nhận học vụ số hóa thành công.', verification_data)


@router.get("/api/reports/export-csv")
@router.get("/api/cases/export/csv")
async def export_cases_csv(user: dict = Depends(require_roles('REVIEWER', 'ADMIN'))):
    cases = await db_service.get_cases({})
    csv_str = generate_cases_csv(cases)
    filename = f"EDUASSISTANT_Danh_Sach_Ho_So_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_str.encode('utf-8'),
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


@router.get("/api/reports/export-cases-html")
@router.get("/api/cases/export/table")
async def export_cases_table(user: dict = Depends(require_roles('REVIEWER', 'ADMIN'))):
    cases = await db_service.get_cases({})
    html_content = generate_cases_table_html(cases)
    return HTMLResponse(content=html_content)
