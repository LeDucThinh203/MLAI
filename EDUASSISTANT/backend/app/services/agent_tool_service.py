"""Typed Agent tool handlers and confirmation-time revalidation."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from app.db.database import get_all, get_one
from app.db.db import db_service
from app.services import agent_rag_service
from app.services.agent_tool_registry import TOOL_REGISTRY
from app.services.address_ai_service import normalize_student_address
from app.services.escalation_policy_service import get_confidence_threshold, get_threshold_history
from app.services.policy_registry_service import POLICY_REGISTRY
from app.services.rule_engine import evaluate_case
from app.services.workflow_guard import validate_status_transition


class ToolAccessError(Exception):
    pass


class ToolInputError(Exception):
    pass


def _safe_user(user: dict) -> dict:
    return {key: user.get(key) for key in ('username', 'fullName', 'studentCode', 'role', 'department') if key in user}


def _public_case(case: dict) -> dict:
    fields = ('id', 'title', 'category', 'priority', 'description', 'status', 'createdAt', 'updatedAt',
              'deadline', 'assignedDepartment', 'ruleEngine', 'escalation', 'reviewResult',
              'studentClaim', 'addressAnalysis', 'reviewerFeedback')
    return {key: case.get(key) for key in fields if key in case}


def _case_owner_check(case: dict | None, user: dict) -> dict:
    if not case:
        raise ToolInputError('Không tìm thấy hồ sơ này.')
    if user.get('role') == 'STUDENT' and case.get('studentId') != user.get('id'):
        raise ToolAccessError('Bạn chỉ có thể truy cập hồ sơ thuộc tài khoản của mình.')
    return case


def _safe_notification(item: dict) -> dict:
    return {key: item.get(key) for key in ('id', 'title', 'message', 'type', 'caseId', 'isRead', 'createdAt')}


async def _read_tool(name: str, args: dict, user: dict) -> dict:
    role, user_id = user.get('role'), user.get('id')
    if name == 'get_my_profile':
        return _safe_user(user)
    if name == 'get_my_sis_record':
        if role != 'STUDENT':
            raise ToolAccessError('Chỉ tài khoản sinh viên mới dùng được công cụ này.')
        return {'record': get_one('''SELECT studentCode,fullName,academicStatus,courseStartDate,courseEndDate,
            currentTermActive,hasCurrentSchedule,registeredPermanentAddress,faculty,source,recordStatus,updatedAt
            FROM sis_student_records WHERE userId=?''', (user_id,))}
    if name in ('list_my_cases', 'list_cases'):
        filters = {'studentId': user_id} if role == 'STUDENT' else {}
        if args.get('status'):
            filters['status'] = args['status']
        filters['limit'] = args.get('limit', 10)
        cases = await db_service.get_cases(filters)
        return {'cases': [_public_case(case) for case in cases], 'totalReturned': len(cases)}
    if name in ('get_case_detail', 'get_case_comments', 'explain_case_decision', 'evaluate_case_rules', 'get_audit_for_case'):
        case_id = args['caseId']
        if name == 'get_case_comments':
            case, comments = await db_service.get_case_with_comments(case_id)
            _case_owner_check(case, user)
            safe_comments = [{key: item.get(key) for key in ('id', 'authorName', 'authorRole', 'content', 'createdAt')}
                             for item in comments[:100]]
            return {'caseId': case_id, 'comments': safe_comments}
        if name == 'get_audit_for_case':
            if role not in ('REVIEWER', 'ADMIN'):
                raise ToolAccessError('Chỉ Reviewer hoặc Admin mới truy cập audit hồ sơ.')
            page = await db_service.get_audits_page({'caseId': case_id}, page=1, page_size=50)
            audits = page.get('audits', [])
            return {'caseId': case_id, 'audits': [{key: row.get(key) for key in ('id', 'action', 'actorName', 'actorRole', 'result', 'reason', 'timestamp')} for row in audits]}
        if name == 'evaluate_case_rules':
            case, student = await db_service.get_case_with_student(case_id)
            if not case:
                raise ToolInputError('Không tìm thấy hồ sơ này.')
            files = case.get('evidenceFiles') or []
            ocr = files[0].get('ocrData') if files and isinstance(files[0], dict) else None
            return {'caseId': case_id, 'evaluation': evaluate_case(case, ocr, student or {})}
        case = await db_service.get_case_by_id(case_id)
        _case_owner_check(case, user)
        if name == 'explain_case_decision':
            stored = case.get('ruleEngine') if isinstance(case.get('ruleEngine'), dict) else {}
            if not stored:
                return {'caseId': case_id, 'status': case.get('status'), 'message': 'Hồ sơ chưa lưu kết quả Rule Engine để giải thích.'}
            return {'caseId': case_id, 'status': case.get('status'), 'decision': stored.get('decision'),
                    'escalationReason': stored.get('escalationReason'), 'ruleMatched': stored.get('ruleMatched'),
                    'explanation': stored.get('explanation'), 'suggestedAction': stored.get('suggestedAction'),
                    'institutionalTrust': stored.get('institutionalTrust'), 'source': 'stored_rule_engine_result'}
        return _public_case(case)
    if name == 'get_notifications':
        rows = await db_service.get_notifications(user_id)
        return {'notifications': [_safe_notification(row) for row in rows[:50]]}
    if name == 'normalize_address':
        if args.get('addressType', 'PERMANENT').upper() not in ('PERMANENT', 'TEMPORARY'):
            raise ToolInputError('Loại địa chỉ không hợp lệ.')
        result = await normalize_student_address(args['address'], args.get('addressType', 'PERMANENT').upper(), user)
        fields = ('houseNumber', 'street', 'wardCommune', 'district', 'provinceCity', 'normalizedAddress',
                  'missingFields', 'ambiguousFields', 'confidence', 'provider', 'model', 'apiCallPerformed',
                  'apiAttempts', 'isFallback', 'durationMs')
        return {key: result.get(key) for key in fields}
    if name in ('search_policy', 'get_workflow_requirements'):
        result = await agent_rag_service.search(args['query'])
        return {'chunks': [{'source': item['source'], 'content': item['content']} for item in result['chunks']],
                'sources': result['sources'], 'retrievalMode': result['retrievalMode']}
    if name == 'get_current_threshold':
        return {'threshold': get_confidence_threshold(), 'source': 'runtime_escalation_policy'}
    if name == 'list_sis_records':
        clauses, params = ['1=1'], []
        if args.get('search'):
            clauses.append('(studentCode ILIKE ? OR fullName ILIKE ? OR faculty ILIKE ?)')
            params.extend([f"%{args['search']}%"] * 3)
        for column in ('academicStatus', 'faculty', 'recordStatus'):
            if args.get(column):
                clauses.append(f'{column}=?')
                params.append(args[column])
        if args.get('verificationStatus'):
            clauses.append('verificationStatus=?')
            params.append(args['verificationStatus'])
        limit = args.get('limit', 20)
        rows = get_all('SELECT id,userId,studentCode,fullName,academicStatus,courseStartDate,courseEndDate,currentTermActive,hasCurrentSchedule,faculty,source,sourceType,verificationStatus,recordStatus,updatedAt FROM sis_student_records WHERE ' + ' AND '.join(clauses) + ' ORDER BY updatedAt DESC LIMIT ?', tuple(params + [limit]))
        return {'records': rows, 'totalReturned': len(rows)}
    if name == 'get_sis_record':
        return {'record': get_one('''SELECT id,userId,studentCode,fullName,academicStatus,courseStartDate,courseEndDate,
            currentTermActive,hasCurrentSchedule,registeredPermanentAddress,faculty,source,sourceType,verificationStatus,
            verifiedBy,verifiedAt,recordStatus,updatedAt FROM sis_student_records WHERE id=?''', (args['recordId'],))}
    if name == 'list_users':
        users = get_all('''SELECT id,username,fullName,studentCode,email,role,department,createdAt,academicStatus,faculty
            FROM users ORDER BY createdAt DESC LIMIT ?''', (100,))
        return {'users': users, 'totalReturned': len(users)}
    if name == 'get_admin_metrics':
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        stats = await db_service.get_admin_dashboard_statistics(cutoff)
        users = stats.get('users') or {}
        cases = stats.get('cases') or {}
        return {'users': {'total': users.get('total_users')},
                'cases': {key: cases.get(key) for key in ('total_cases', 'pending_cases', 'approved_cases',
                                                          'rejected_cases', 'auto_approved_cases', 'escalated_cases')},
                'statuses': stats.get('statuses', []), 'priorities': stats.get('priorities', []),
                'escalations': stats.get('escalations', [])}
    if name == 'get_policy_registry':
        state = get_one('SELECT currentThreshold,minThreshold,maxThreshold,stepSize,updatedAt FROM escalation_policy_state WHERE id=?', ('GLOBAL_NVQS_POLICY',))
        return {'policies': POLICY_REGISTRY, 'adaptivePolicy': state}
    if name == 'get_threshold_history':
        return {'history': get_threshold_history(limit=30)}
    if name == 'get_audits':
        page = await db_service.get_audits_page({}, page=1, page_size=50)
        rows = page.get('audits', [])
        return {'audits': [{key: row.get(key) for key in ('id', 'action', 'caseId', 'actorName', 'actorRole', 'result', 'reason', 'timestamp')} for row in rows]}
    raise ToolInputError('Công cụ đọc chưa được hỗ trợ.')


async def invoke_read(name: str, args: dict, user: dict) -> dict:
    spec = TOOL_REGISTRY.get(name)
    if not spec or user.get('role') not in (spec or {}).get('allowedRoles', ()):
        raise ToolAccessError('Công cụ này không được cấp cho vai trò hiện tại.')
    if spec['requiresConfirmation']:
        raise ToolInputError('Công cụ ghi bắt buộc phải qua bước xác nhận.')
    return await _read_tool(name, args, user)


async def prepare_action(name: str, args: dict, user: dict) -> tuple[dict, dict]:
    spec = TOOL_REGISTRY.get(name)
    if not spec or user.get('role') not in (spec or {}).get('allowedRoles', ()) or not spec['requiresConfirmation']:
        raise ToolAccessError('Công cụ ghi này không được cấp cho vai trò hiện tại.')
    prepared = dict(args)
    preview: dict[str, Any] = {'toolName': name}
    if name == 'create_case':
        prepared['category'] = 'MILITARY_SERVICE_CONFIRMATION'
        preview.update({'title': args['title'], 'category': 'MILITARY_SERVICE_CONFIRMATION',
                       'addressType': args.get('addressType', 'PERMANENT'),
                       'rawAddress': args['rawAddress'],
                       'note': 'Sau khi bạn gửi, hệ thống sẽ kiểm tra thông tin và chuyển hồ sơ đến bộ phận phù hợp. Đây không phải giấy xác nhận chính thức hay quyết định tạm hoãn nghĩa vụ quân sự.'})
    elif name in ('supplement_case', 'add_case_comment', 'review_case_approve', 'review_case_reject',
                  'review_case_request_info', 'review_case_stop', 'review_case_override', 'reroute_case',
                  'submit_reviewer_feedback'):
        case = _case_owner_check(await db_service.get_case_by_id(args['caseId']), user)
        prepared['_expectedStatus'] = case.get('status')
        preview.update({'caseId': case['id'], 'currentStatus': case.get('status'), 'title': case.get('title')})
        if name == 'supplement_case':
            valid, error = validate_status_transition(case.get('status'), 'UNDER_REVIEW', user.get('role'))
            if not valid:
                raise ToolInputError(error or 'Workflow không cho phép bổ sung ở trạng thái hiện tại.')
        if name.startswith('review_case_'):
            status_by_tool = {'review_case_approve': 'APPROVED', 'review_case_reject': 'REJECTED',
                              'review_case_request_info': 'REQUIRES_SUPPLEMENT', 'review_case_stop': 'STOPPED'}
            destination = args.get('targetStatus', 'APPROVED') if name == 'review_case_override' else status_by_tool[name]
            is_override = name == 'review_case_override'
            valid, error = validate_status_transition(case.get('status'), destination, user.get('role'), is_admin_override=is_override and user.get('role') == 'ADMIN')
            if not valid:
                raise ToolInputError(error or 'Hồ sơ chưa thể chuyển sang trạng thái này theo quy trình hiện tại.')
            preview.update({'newStatus': destination, 'reason': args.get('reason'),
                            'systemRecommendation': (case.get('ruleEngine') or {}).get('decision') if isinstance(case.get('ruleEngine'), dict) else None})
        elif name == 'reroute_case':
            preview.update({'department': args['department']})
        elif name == 'supplement_case':
            preview.update({'additionalDescription': args.get('additionalDescription', '')})
        elif name == 'add_case_comment':
            preview.update({'comment': args['content']})
        else:
            preview.update({'feedbackType': args.get('type'), 'note': args.get('note')})
    elif name in ('mark_notification_read', 'mark_all_notifications_read'):
        if name == 'mark_notification_read':
            own_notifications = await db_service.get_notifications(user.get('id'))
            own_ids = {item.get('id') for item in own_notifications}
            if args['notificationId'] not in own_ids:
                raise ToolAccessError('Thông báo không thuộc tài khoản hiện tại.')
            notification = next((item for item in own_notifications if item.get('id') == args['notificationId']), {})
            preview.update({'notificationTitle': notification.get('title') or notification.get('message') or 'Thông báo đã chọn'})
    elif name in ('create_sis_record', 'update_sis_record', 'verify_demo_sis_record'):
        if name != 'create_sis_record':
            record = get_one('SELECT id,userId,studentCode,fullName,verificationStatus,sourceType,updatedAt FROM sis_student_records WHERE id=?', (args['recordId'],))
            if not record:
                raise ToolInputError('Không tìm thấy bản ghi SIS.')
            if name == 'verify_demo_sis_record' and record.get('sourceType') != 'INTERNAL_DEMO_SIS':
                raise ToolInputError('Chỉ bản ghi SIS demo nội bộ mới được đánh dấu xác minh demo.')
            prepared['_expectedUpdatedAt'] = record.get('updatedAt')
            preview.update({'recordId': record['id'], 'studentCode': record.get('studentCode'),
                            'verificationStatus': record.get('verificationStatus'), 'sourceType': record.get('sourceType')})
        else:
            student = await db_service.get_user_by_id(args['userId'])
            if not student or student.get('role') != 'STUDENT':
                raise ToolInputError('Không tìm thấy tài khoản sinh viên đã chọn.')
            preview.update({'studentCode': student.get('studentCode'), 'fullName': student.get('fullName') or args['fullName'],
                            'verificationStatus': 'UNVERIFIED', 'sourceType': 'INTERNAL_DEMO_SIS'})
        preview['warning'] = 'Đây là dữ liệu mẫu để minh họa; thông tin này chưa được kết nối hoặc xác nhận bởi nhà trường.'
    elif name == 'update_user_role':
        target = await db_service.get_user_by_id(args['userId'])
        if not target:
            raise ToolInputError('Không tìm thấy người dùng.')
        prepared['_expectedRole'] = target.get('role')
        preview.update({'userId': target['id'], 'username': target.get('username'), 'currentRole': target.get('role'), 'newRole': args['role']})
    elif name == 'create_user':
        if await db_service.get_user_by_username(args['username']):
            raise ToolInputError('Tên đăng nhập này đã được sử dụng.')
        preview.update({'username': args['username'], 'fullName': args['fullName'], 'role': args.get('role', 'STUDENT'),
                        'note': 'Mật khẩu chỉ nhập trong form xác nhận bảo mật và không được lưu trong chat.'})
    return prepared, preview


async def revalidate_action(name: str, args: dict, user: dict) -> None:
    spec = TOOL_REGISTRY.get(name)
    if not spec or user.get('role') not in (spec or {}).get('allowedRoles', ()):
        raise ToolAccessError('Vai trò hiện tại không còn được phép thực hiện hành động này.')
    if 'caseId' in args:
        case = _case_owner_check(await db_service.get_case_by_id(args['caseId']), user)
        if case.get('status') != args.get('_expectedStatus'):
            raise ToolInputError('Trạng thái hồ sơ đã thay đổi. Hãy tạo đề xuất mới dựa trên dữ liệu hiện tại.')
        if name.startswith('review_case_'):
            destination = {'review_case_approve': 'APPROVED', 'review_case_reject': 'REJECTED',
                           'review_case_request_info': 'REQUIRES_SUPPLEMENT', 'review_case_stop': 'STOPPED'}.get(name)
            if name == 'review_case_override':
                destination = args.get('targetStatus', 'APPROVED')
                if len((args.get('reason') or '').strip()) < 3:
                    raise ToolInputError('Admin override cần lý do rõ ràng.')
            valid, error = validate_status_transition(case.get('status'), destination, user.get('role'),
                                                       is_admin_override=name == 'review_case_override' and user.get('role') == 'ADMIN')
            if not valid:
                raise ToolInputError(error or 'Workflow không cho phép chuyển trạng thái này.')
        if name == 'supplement_case':
            valid, error = validate_status_transition(case.get('status'), 'UNDER_REVIEW', user.get('role'))
            if not valid:
                raise ToolInputError(error or 'Workflow không cho phép bổ sung ở trạng thái hiện tại.')
    if 'recordId' in args:
        record = get_one('SELECT updatedAt,sourceType FROM sis_student_records WHERE id=?', (args['recordId'],))
        if not record or record.get('updatedAt') != args.get('_expectedUpdatedAt'):
            raise ToolInputError('Bản ghi SIS đã thay đổi. Hãy tạo đề xuất mới.')
        if name == 'verify_demo_sis_record' and record.get('sourceType') != 'INTERNAL_DEMO_SIS':
            raise ToolInputError('Chỉ SIS demo nội bộ mới được xác minh demo.')
    if name == 'update_user_role':
        target = await db_service.get_user_by_id(args['userId'])
        if not target or target.get('role') != args.get('_expectedRole'):
            raise ToolInputError('Tài khoản hoặc vai trò đã thay đổi; hãy tạo đề xuất mới.')
    if name == 'create_user' and await db_service.get_user_by_username(args['username']):
        raise ToolInputError('Tên đăng nhập đã được tạo sau khi đề xuất được lập.')


async def execute_action(name: str, args: dict, user: dict, secure_fields: dict | None = None) -> dict:
    """Call the established REST/business entrypoints after the confirmation gate."""
    from app.routers import admin as admin_routes, cases as case_routes
    from app.schemas.admin import CreateAdminUserRequest, UpdateRoleRequest
    from app.schemas.cases import (AddCommentRequest, CreateCaseRequest, ReRouteCaseRequest,
                                   ReviewCaseRequest, ReviewerFeedbackRequest, SupplementCaseRequest)
    from app.routers.admin import SisCreateRequest, SisDemoVerificationRequest, SisUpdateRequest

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
    elif name.startswith('review_case_'):
        action, target = {'review_case_approve': ('APPROVE', 'APPROVED'), 'review_case_reject': ('REJECT', 'REJECTED'),
                          'review_case_request_info': ('REQUEST_INFO', 'REQUIRES_SUPPLEMENT'),
                          'review_case_stop': ('STOP', 'STOPPED'), 'review_case_override': ('OVERRIDE', clean.get('targetStatus', 'APPROVED'))}[name]
        response = await case_routes.review_case(clean['caseId'], ReviewCaseRequest(
            action=action, reason=clean.get('reason'), overrideReason=clean.get('reason') if action == 'OVERRIDE' else None,
            targetStatus=target if action == 'OVERRIDE' else None), user)
    elif name == 'reroute_case':
        response = await case_routes.re_route_case_endpoint(clean['caseId'], ReRouteCaseRequest(department=clean['department']), user)
    elif name == 'submit_reviewer_feedback':
        response = await case_routes.submit_case_feedback(clean['caseId'], ReviewerFeedbackRequest(type=clean['type'], note=clean.get('note')), user)
    elif name == 'create_sis_record':
        response = await admin_routes.create_sis_record(SisCreateRequest(**clean), user)
    elif name == 'update_sis_record':
        record_id = clean.pop('recordId')
        response = await admin_routes.update_sis_record(record_id, SisUpdateRequest(**clean), user)
    elif name == 'verify_demo_sis_record':
        response = await admin_routes.verify_demo_sis_record(clean['recordId'], SisDemoVerificationRequest(reason=clean['reason']), user)
    elif name == 'update_user_role':
        response = await admin_routes.update_user_role_endpoint(clean['userId'], UpdateRoleRequest(role=clean['role']), user)
    elif name == 'create_user':
        password = (secure_fields or {}).get('password', '')
        if set(secure_fields or {}) - {'password'} or len(password) < 6:
            raise ToolInputError('Hãy nhập mật khẩu tối thiểu 6 ký tự trong ô xác nhận bảo mật.')
        response = await admin_routes.admin_create_user(CreateAdminUserRequest(**{**clean, 'password': password}), user)
    else:
        raise ToolInputError('Hành động xác nhận không được hỗ trợ.')
    if hasattr(response, 'status_code'):
        if response.status_code >= 400:
            body = json.loads(response.body.decode('utf-8'))
            raise ToolInputError(body.get('message') or 'Hành động nghiệp vụ bị từ chối.')
        body = json.loads(response.body.decode('utf-8'))
        return {'success': bool(body.get('success')), 'message': body.get('message'), 'data': body.get('data')}
    return response
