"""Student-scoped Agent tools backed by existing application services."""
from __future__ import annotations

import json
from typing import Any

from app.db.db import db_service
from app.services import agent_rag_service
from app.services.agent_tool_registry import TOOL_REGISTRY
from app.services.address_ai_service import normalize_student_address
from app.services.workflow_guard import validate_status_transition


class ToolAccessError(Exception):
    pass


class ToolInputError(Exception):
    pass


def _ensure_student_tool_user(user: dict) -> None:
    if not isinstance(user, dict) or user.get('role') != 'STUDENT':
        raise ToolAccessError('Trợ lý AI chỉ dành cho tài khoản sinh viên.')


def _safe_user(user: dict) -> dict:
    return {key: user.get(key) for key in ('username', 'fullName', 'studentCode') if key in user}


def _public_case(case: dict) -> dict:
    # Never send SIS-backed Rule Engine facts or escalation details to the Agent.
    fields = ('id', 'title', 'category', 'priority', 'description', 'status', 'createdAt', 'updatedAt',
              'deadline', 'assignedDepartment', 'studentClaim', 'addressAnalysis')
    return {key: case.get(key) for key in fields if key in case}


def _case_owner_check(case: dict | None, user: dict) -> dict:
    _ensure_student_tool_user(user)
    if not case:
        raise ToolInputError('Không tìm thấy hồ sơ này.')
    if case.get('studentId') != user.get('id'):
        raise ToolAccessError('Bạn chỉ có thể truy cập hồ sơ thuộc tài khoản của mình.')
    return case


def _safe_notification(item: dict) -> dict:
    return {key: item.get(key) for key in ('id', 'title', 'message', 'type', 'caseId', 'isRead', 'createdAt')}


async def _read_tool(name: str, args: dict, user: dict) -> dict:
    _ensure_student_tool_user(user)
    user_id = user.get('id')
    if name == 'get_my_profile':
        return _safe_user(user)
    if name == 'list_my_cases':
        filters = {'studentId': user_id}
        if args.get('status'):
            filters['status'] = args['status']
        filters['limit'] = args.get('limit', 10)
        cases = await db_service.get_cases(filters)
        return {'cases': [_public_case(case) for case in cases], 'totalReturned': len(cases)}
    if name in ('get_case_detail', 'get_case_comments', 'explain_case_decision'):
        case_id = args['caseId']
        if name == 'get_case_comments':
            case, comments = await db_service.get_case_with_comments(case_id)
            _case_owner_check(case, user)
            safe_comments = [{key: item.get(key) for key in ('id', 'authorName', 'authorRole', 'content', 'createdAt')}
                             for item in comments[:100]]
            return {'caseId': case_id, 'comments': safe_comments}
        case = _case_owner_check(await db_service.get_case_by_id(case_id), user)
        if name == 'explain_case_decision':
            stored = case.get('ruleEngine') if isinstance(case.get('ruleEngine'), dict) else {}
            if not stored:
                return {'caseId': case_id, 'status': case.get('status'),
                        'message': 'Hồ sơ chưa lưu kết quả Rule Engine để giải thích.'}
            return {'caseId': case_id, 'status': case.get('status'), 'decision': stored.get('decision'),
                    'escalationReason': stored.get('escalationReason'), 'source': 'stored_rule_engine_result'}
        return _public_case(case)
    if name == 'get_notifications':
        rows = await db_service.get_notifications(user_id)
        return {'notifications': [_safe_notification(row) for row in rows[:50]]}
    if name == 'normalize_address':
        address_type = args.get('addressType', 'PERMANENT').upper()
        if address_type not in ('PERMANENT', 'TEMPORARY'):
            raise ToolInputError('Loại địa chỉ không hợp lệ.')
        result = await normalize_student_address(args['address'], address_type, user)
        fields = ('houseNumber', 'street', 'wardCommune', 'district', 'provinceCity', 'normalizedAddress',
                  'missingFields', 'ambiguousFields', 'confidence', 'provider', 'model', 'apiCallPerformed',
                  'apiAttempts', 'isFallback', 'durationMs')
        return {key: result.get(key) for key in fields}
    if name in ('search_policy', 'get_workflow_requirements'):
        result = await agent_rag_service.search(args['query'])
        return {'chunks': [{'source': item['source'], 'content': item['content']} for item in result['chunks']],
                'sources': result['sources'], 'retrievalMode': result['retrievalMode']}
    raise ToolInputError('Công cụ đọc chưa được hỗ trợ.')


async def invoke_read(name: str, args: dict, user: dict) -> dict:
    _ensure_student_tool_user(user)
    spec = TOOL_REGISTRY.get(name)
    if not spec or 'STUDENT' not in spec.get('allowedRoles', ()):
        raise ToolAccessError('Công cụ này không được cấp cho vai trò hiện tại.')
    if spec['requiresConfirmation']:
        raise ToolInputError('Công cụ ghi bắt buộc phải qua bước xác nhận.')
    return await _read_tool(name, args, user)


async def prepare_action(name: str, args: dict, user: dict) -> tuple[dict, dict]:
    _ensure_student_tool_user(user)
    spec = TOOL_REGISTRY.get(name)
    if not spec or 'STUDENT' not in spec.get('allowedRoles', ()) or not spec['requiresConfirmation']:
        raise ToolAccessError('Công cụ ghi này không được cấp cho vai trò hiện tại.')
    prepared = dict(args)
    preview: dict[str, Any] = {'toolName': name}
    if name == 'create_case':
        prepared['category'] = 'MILITARY_SERVICE_CONFIRMATION'
        preview.update({'title': args['title'], 'category': 'MILITARY_SERVICE_CONFIRMATION',
                        'addressType': args.get('addressType', 'PERMANENT'), 'rawAddress': args['rawAddress'],
                        'note': 'Sau khi bạn gửi, hệ thống sẽ kiểm tra thông tin và chuyển hồ sơ đến bộ phận phù hợp. Đây không phải giấy xác nhận chính thức hay quyết định tạm hoãn nghĩa vụ quân sự.'})
    elif name in ('supplement_case', 'add_case_comment'):
        case = _case_owner_check(await db_service.get_case_by_id(args['caseId']), user)
        prepared['_expectedStatus'] = case.get('status')
        preview.update({'caseId': case['id'], 'currentStatus': case.get('status'), 'title': case.get('title')})
        if name == 'supplement_case':
            valid, error = validate_status_transition(case.get('status'), 'UNDER_REVIEW', 'STUDENT')
            if not valid:
                raise ToolInputError(error or 'Hồ sơ chưa thể bổ sung ở trạng thái hiện tại.')
            preview['additionalDescription'] = args.get('additionalDescription', '')
        else:
            preview['comment'] = args['content']
    elif name in ('mark_notification_read', 'mark_all_notifications_read'):
        if name == 'mark_notification_read':
            own_notifications = await db_service.get_notifications(user.get('id'))
            own_ids = {item.get('id') for item in own_notifications}
            if args['notificationId'] not in own_ids:
                raise ToolAccessError('Thông báo không thuộc tài khoản hiện tại.')
            notification = next((item for item in own_notifications if item.get('id') == args['notificationId']), {})
            preview['notificationTitle'] = notification.get('title') or notification.get('message') or 'Thông báo đã chọn'
    return prepared, preview


async def revalidate_action(name: str, args: dict, user: dict) -> None:
    _ensure_student_tool_user(user)
    spec = TOOL_REGISTRY.get(name)
    if not spec or 'STUDENT' not in spec.get('allowedRoles', ()):
        raise ToolAccessError('Vai trò hiện tại không còn được phép thực hiện hành động này.')
    if 'caseId' in args:
        case = _case_owner_check(await db_service.get_case_by_id(args['caseId']), user)
        if case.get('status') != args.get('_expectedStatus'):
            raise ToolInputError('Trạng thái hồ sơ đã thay đổi. Hãy tạo đề xuất mới dựa trên dữ liệu hiện tại.')
        if name == 'supplement_case':
            valid, error = validate_status_transition(case.get('status'), 'UNDER_REVIEW', 'STUDENT')
            if not valid:
                raise ToolInputError(error or 'Workflow không cho phép bổ sung ở trạng thái hiện tại.')
    if name == 'mark_notification_read':
        own_notifications = await db_service.get_notifications(user.get('id'))
        if args.get('notificationId') not in {item.get('id') for item in own_notifications}:
            raise ToolAccessError('Thông báo không thuộc tài khoản hiện tại.')


async def execute_action(name: str, args: dict, user: dict) -> dict:
    """Call established student business entrypoints after explicit confirmation."""
    _ensure_student_tool_user(user)
    from app.routers import cases as case_routes
    from app.schemas.cases import AddCommentRequest, CreateCaseRequest, SupplementCaseRequest

    clean = {key: value for key, value in args.items() if not key.startswith('_')}
    if name == 'create_case':
        request = CreateCaseRequest(**{**clean, 'category': 'MILITARY_SERVICE_CONFIRMATION'})
        response = await case_routes.create_case_endpoint(request, user)
    elif name == 'supplement_case':
        response = await case_routes.supplement_case_endpoint(clean['caseId'], SupplementCaseRequest(**clean), user)
    elif name == 'add_case_comment':
        response = await case_routes.add_case_comment(clean['caseId'], AddCommentRequest(content=clean['content']), user)
    elif name == 'mark_notification_read':
        changed = await db_service.mark_notification_as_read(clean['notificationId'], user['id'])
        response = {'success': changed, 'message': 'Thông báo đã được cập nhật.' if changed else 'Thông báo không thay đổi.'}
    elif name == 'mark_all_notifications_read':
        await db_service.mark_all_notifications_as_read(user['id'])
        response = {'success': True, 'message': 'Đã đánh dấu thông báo là đã đọc.'}
    else:
        raise ToolInputError('Hành động xác nhận không được hỗ trợ.')
    if hasattr(response, 'status_code'):
        body = json.loads(response.body.decode('utf-8'))
        if response.status_code >= 400:
            raise ToolInputError(body.get('message') or 'Hành động nghiệp vụ bị từ chối.')
        return {'success': bool(body.get('success')), 'message': body.get('message'), 'data': body.get('data')}
    return response
