import os
from datetime import datetime
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import HTMLResponse

from app.db.db import db_service
from app.services.ai_service import extract_case_data
from app.services.rule_engine import evaluate_case
from app.services.report_service import (
    generate_cases_csv,
    generate_cases_table_html,
    generate_decision_html
)
from app.core.responses import api_response
from app.core.dependencies import get_current_user, require_roles
from app.schemas.cases import (
    CreateCaseRequest,
    ReviewCaseRequest,
    AddCommentRequest,
    SupplementCaseRequest,
    ReRouteCaseRequest
)

router = APIRouter(tags=["Cases"])


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
    student_user = await db_service.get_user_by_id(user['id'])

    ai_res = await extract_case_data(case_dict, user)
    ai_extraction = ai_res.get('data', {})

    rule_verdict = evaluate_case(case_dict, ai_extraction, student_user or {})

    case_dict['aiExtraction'] = ai_extraction
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
    target_case = await db_service.get_case_by_id(case_id)
    if not target_case:
        return api_response(404, False, f"Không tìm thấy hồ sơ #{case_id}.", None, 'NOT_FOUND')

    student_user = await db_service.get_user_by_id(target_case['studentId'])
    ai_extraction = target_case.get('aiExtraction') or {}
    rule_verdict = evaluate_case(target_case, ai_extraction, student_user or {})

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

    action = (req.action or req.decision or 'APPROVE').upper()
    next_status = 'APPROVED'
    action_label = 'CHẤP THUẬN (APPROVED)'

    if action in ('APPROVE', 'APPROVED'):
        next_status = 'APPROVED'
        action_label = 'CHẤP THUẬN (APPROVED)'
    elif action in ('REJECT', 'REJECTED'):
        next_status = 'REJECTED'
        action_label = 'TỪ CHỐI (REJECTED)'
    elif action in ('REQUIRE_SUPPLEMENT', 'REQUIRES_SUPPLEMENT', 'REQUEST_INFO'):
        next_status = 'REQUIRES_SUPPLEMENT'
        action_label = 'YÊU CẦU BỔ SUNG HỒ SƠ'
    elif action == 'UNDER_REVIEW':
        next_status = 'UNDER_REVIEW'
        action_label = 'ĐANG XỬ LÝ'

    review_result = {
        'action': action,
        'decision': action_label,
        'reason': req.reason or 'Phê duyệt hồ sơ',
        'reviewerId': user['id'],
        'reviewerName': user['fullName'],
        'reviewerRole': user['role'],
        'reviewerDepartment': user.get('department') or target_case.get('assignedDepartment'),
        'reviewedAt': datetime.utcnow().isoformat() + 'Z'
    }

    updated = await db_service.update_case_status(
        case_id,
        next_status,
        user,
        req.reason or f"Thẩm định viên {user['fullName']} đã {action_label}",
        {
            'reviewResult': review_result,
            'assignedDepartment': req.assignedDepartment or target_case.get('assignedDepartment')
        }
    )

    return api_response(200, True, f"Thẩm định hồ sơ #{case_id} thành công ({next_status}).", {'case': updated, **(updated or {})})


@router.get("/api/cases/{case_id}/comments")
async def get_case_comments(case_id: str, user: dict = Depends(get_current_user)):
    target_case = await db_service.get_case_by_id(case_id)
    if not target_case:
        return api_response(404, False, f"Không tìm thấy hồ sơ #{case_id}.", None, 'NOT_FOUND')

    if user['role'] == 'STUDENT' and target_case['studentId'] != user['id']:
        return api_response(403, False, 'Bạn không có quyền xem bình luận trên hồ sơ của sinh viên khác.', None, 'FORBIDDEN')

    comments = await db_service.get_comments(case_id)
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

    new_cmt = await db_service.add_comment(case_id, user, req.content)
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
    filename = f"CaseFlow_Danh_Sach_Ho_So_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
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
