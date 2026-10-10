import os
from datetime import datetime
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, Request, Response, WebSocket, WebSocketDisconnect
import jwt
from fastapi.responses import HTMLResponse

from app.db.db import db_service
from app.db.database import get_one
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
from app.core.cache import get_json as get_cached_json, set_json as set_cached_json
from app.config import ACCESS_COOKIE_NAME, JWT_SECRET
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


async def _get_websocket_identity(websocket: WebSocket) -> Optional[dict]:
    """WebSockets authenticate with the same HttpOnly access cookie as HTTP."""
    raw_token = websocket.cookies.get(ACCESS_COOKIE_NAME)
    if not raw_token:
        return None
    try:
        identity = jwt.decode(raw_token, JWT_SECRET, algorithms=["HS256"])
        if identity.get('jti') and await db_service.is_access_token_revoked(identity['jti']):
            return None
        return identity
    except jwt.PyJWTError:
        return None


@router.websocket("/ws/comments/{case_id}")
async def comment_websocket(
    websocket: WebSocket,
    case_id: str,
):
    """Subscribe an authenticated participant to one case's comment room."""
    try:
        identity = await _get_websocket_identity(websocket)
        if not identity:
            await websocket.close(code=1008)
            return
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
async def case_events_websocket(websocket: WebSocket):
    """Push new and updated cases to authenticated reviewer/admin queues."""
    try:
        identity = await _get_websocket_identity(websocket)
        if not identity:
            await websocket.close(code=1008)
            return
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
    cache_identity = {'userId': user['id'], 'view': 'my-cases'}
    cached = await get_cached_json('cases', cache_identity)
    if cached is not None:
        return api_response(200, True, 'Cached case list.', cached)
    student_cases = await db_service.get_cases({'studentId': user['id']})
    await set_cached_json('cases', cache_identity, {'cases': student_cases, 'total': len(student_cases)}, 30)
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

    cache_identity = {'userId': user['id'], 'role': user['role'], 'filters': filter_dict}
    cached = await get_cached_json('cases', cache_identity)
    if cached is not None:
        return api_response(200, True, 'Cached case list.', cached)
    cases = await db_service.get_cases(filter_dict)
    await set_cached_json('cases', cache_identity, {'cases': cases, 'total': len(cases)}, 20)
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

    if req.category and req.category != 'MILITARY_SERVICE_CONFIRMATION':
        return api_response(
            400, False,
            f"Hệ thống hiện chỉ tiếp nhận hồ sơ 'MILITARY_SERVICE_CONFIRMATION' (Cấp giấy xác nhận tạm hoãn NVQS). Danh mục '{req.category}' không được hỗ trợ.",
            None, 'INVALID_CATEGORY'
        )

    from app.services.address_ai_service import normalize_student_address

    case_dict = req.dict()
    case_dict['category'] = 'MILITARY_SERVICE_CONFIRMATION'
    if not case_dict.get('title'):
        case_dict['title'] = 'Yêu cầu cấp Giấy xác nhận sinh viên phục vụ tạm hoãn NVQS'

    # Lấy thông tin sinh viên Authoritative Record (Tuyệt đối không invent fallback giả)
    student_user = await db_service.get_user_by_id(user['id']) or user

    sis_record = get_one('SELECT * FROM sis_student_records WHERE userId = ?', (user['id'],))
    authoritative = sis_record or {}
    # SIS is canonical when present. If migration data is absent, preserve only
    # explicit legacy fields; do not invent academic facts or use username as MSSV.
    inst_facts = {
        'studentId': user['id'],
        'studentCode': authoritative.get('studentCode') if sis_record else student_user.get('studentCode'),
        'fullName': authoritative.get('fullName') if sis_record else student_user.get('fullName'),
        'academicStatus': authoritative.get('academicStatus') if sis_record else student_user.get('academicStatus'),
        'courseStartDate': authoritative.get('courseStartDate') if sis_record else student_user.get('courseStartDate'),
        'courseEndDate': authoritative.get('courseEndDate') if sis_record else student_user.get('courseEndDate'),
        'currentTermActive': authoritative.get('currentTermActive') if sis_record else student_user.get('currentTermActive'),
        'hasCurrentSchedule': authoritative.get('hasCurrentSchedule') if sis_record else student_user.get('hasCurrentSchedule'),
        'registeredPermanentAddress': authoritative.get('registeredPermanentAddress') if sis_record else student_user.get('registeredPermanentAddress'),
        'faculty': authoritative.get('faculty') if sis_record else student_user.get('faculty'),
        'recordStatus': authoritative.get('recordStatus') if sis_record else None,
        'source': authoritative.get('source') if sis_record else 'LEGACY_ACCOUNT'
    }
    case_dict['institutionalFacts'] = inst_facts
    case_dict['authoritativeInstitutionalFacts'] = inst_facts

    # Student Claims
    raw_addr = req.rawAddress or case_dict.get('description') or ''
    addr_type = req.addressType or 'PERMANENT'
    student_claim = {
        'addressType': addr_type,
        'rawAddress': raw_addr,
        'declaredStructuredAddress': req.declaredStructuredAddress,
        'requestReason': req.description or 'Cấp giấy xác nhận sinh viên phục vụ tạm hoãn nghĩa vụ quân sự',
        'notes': req.notes or '',
        'studentCode': inst_facts['studentCode'],
        'fullName': inst_facts['fullName']
    }
    case_dict['studentClaim'] = student_claim

    # AI Address Normalization
    ai_address_res = await normalize_student_address(raw_addr, addr_type, user)
    case_dict['aiAddressAnalysis'] = ai_address_res
    case_dict['aiExtraction'] = {
        'normalizedAddress': ai_address_res.get('normalizedAddress'),
        'missingFields': ai_address_res.get('missingFields'),
        'confidence': ai_address_res.get('confidence'),
        'modeUsed': ai_address_res.get('modeUsed'),
        'studentClaim': student_claim,
        'institutionalFacts': inst_facts,
        'addressAnalysis': ai_address_res,
        'provenance': {
            'modeUsed': ai_address_res.get('modeUsed'),
            'isLive': ai_address_res.get('isLive'),
            'isFallback': ai_address_res.get('isFallback'),
            'isSynthetic': ai_address_res.get('isSynthetic'),
            'confidence': ai_address_res.get('confidence')
        }
    }
    case_dict['aiMetadata'] = {
        'modeUsed': ai_address_res.get('modeUsed'),
        'isLive': ai_address_res.get('isLive'),
        'isFallback': ai_address_res.get('isFallback'),
        'isSynthetic': ai_address_res.get('isSynthetic'),
        'fallbackOccurred': ai_address_res.get('isFallback'),
        'confidence': ai_address_res.get('confidence'),
        'durationMs': ai_address_res.get('durationMs')
    }

    files = case_dict.get('evidenceFiles') or []
    factual_ocr = files[0].get('ocrData') if (files and isinstance(files[0], dict)) else None

    rule_verdict = evaluate_case(case_dict, factual_ocr, student_user)
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
    return api_response(201, True, 'Tạo yêu cầu cấp Giấy xác nhận tạm hoãn NVQS thành công.', {'case': created, **(created or {})})


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

    # Ràng buộc ngữ nghĩa phản hồi phù hợp với quyết định của hệ thống
    sys_rec = (target_case.get('ruleEngine') or {}).get('decision') or ''
    if sys_rec == 'AUTO_APPROVE' and fb_type == 'UNNECESSARY_ESCALATION':
        return api_response(
            400, False,
            'Không thể chọn UNNECESSARY_ESCALATION khi hệ thống đã đề xuất AUTO_APPROVE. Hãy chọn CORRECT hoặc MISSED_ESCALATION.',
            None, 'INCOMPATIBLE_FEEDBACK_TYPE'
        )
    if sys_rec == 'ESCALATE_TO_HUMAN' and fb_type == 'MISSED_ESCALATION':
        return api_response(
            400, False,
            'Không thể chọn MISSED_ESCALATION khi hệ thống đã chuyển cán bộ (ESCALATE_TO_HUMAN). Hãy chọn CORRECT hoặc UNNECESSARY_ESCALATION.',
            None, 'INCOMPATIBLE_FEEDBACK_TYPE'
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

    if target_case.get('status') != 'APPROVED':
        return api_response(409, False, 'Only approved cases have an internal receipt.', None, 'CASE_NOT_APPROVED')

    if user['role'] == 'STUDENT' and target_case['studentId'] != user['id']:
        return api_response(403, False, 'Bạn không có quyền truy cập quyết định này.', None, 'FORBIDDEN')

    public_frontend_url = os.environ.get('FRONTEND_URL', 'https://edu-sp.pages.dev').strip().rstrip('/')
    html_content = generate_decision_html(target_case, public_frontend_url)
    return HTMLResponse(content=html_content)


@router.get("/api/cases/verify/{case_id}")
async def verify_case_public(case_id: str):
    verification_data = await db_service.get_case_for_verification(case_id)
    if not verification_data:
        return api_response(404, False, 'Không tìm thấy hồ sơ để xác thực.', None, 'NOT_FOUND')
    return api_response(200, True, 'Internal workflow record lookup completed.', verification_data)


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
