import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Response

from app.db.db import db_service
from app.services.report_service import generate_users_csv
from app.services.upload_service import UPLOAD_DIR
from app.services.ai_service import get_ai_mode
from app.core.responses import api_response
from app.core.dependencies import require_roles
from app.core.cache import get_json as get_cached_json, set_json as set_cached_json
from app.schemas.admin import UpdateRoleRequest, CreateAdminUserRequest
from app.db.database import get_all, get_one, run_query
from app.services.policy_registry_service import POLICY_REGISTRY
from pydantic import BaseModel
from typing import Optional

router = APIRouter(tags=["Admin"])

class SisUpdateRequest(BaseModel):
    studentCode: Optional[str] = None
    fullName: str
    academicStatus: Optional[str] = None
    courseStartDate: Optional[str] = None
    courseEndDate: Optional[str] = None
    currentTermActive: Optional[bool] = None
    hasCurrentSchedule: Optional[bool] = None
    registeredPermanentAddress: Optional[str] = None
    faculty: Optional[str] = None
    recordStatus: Optional[str] = None


class SisCreateRequest(SisUpdateRequest):
    userId: str


@router.get('/api/admin/policies')
async def get_policy_registry(user: dict = Depends(require_roles('ADMIN'))):
    state = get_one('SELECT * FROM escalation_policy_state WHERE id = ?', ('GLOBAL_NVQS_POLICY',))
    history = get_all('SELECT * FROM escalation_threshold_history ORDER BY createdAt DESC LIMIT 10')
    return api_response(200, True, 'Policy registry loaded.', {'policies': POLICY_REGISTRY, 'domain': 'MILITARY_SERVICE_CONFIRMATION', 'adaptivePolicy': state, 'thresholdHistory': history})


@router.get('/api/admin/sis')
async def list_sis_records(search: str = '', academicStatus: str = '', faculty: str = '', recordStatus: str = '', page: int = 1, pageSize: int = 10, user: dict = Depends(require_roles('ADMIN'))):
    clauses, params = ['1=1'], []
    if search.strip():
        clauses.append("(studentCode ILIKE ? OR fullName ILIKE ? OR faculty ILIKE ? OR registeredPermanentAddress ILIKE ?)")
        params += [f'%{search.strip()}%'] * 4
    for column, value in [('academicStatus', academicStatus), ('faculty', faculty), ('recordStatus', recordStatus)]:
        if value.strip(): clauses.append(f'{column} = ?'); params.append(value.strip())
    where = ' WHERE ' + ' AND '.join(clauses)
    total = (get_one('SELECT COUNT(*) AS count FROM sis_student_records' + where, tuple(params)) or {}).get('count', 0)
    size = min(20, max(1, pageSize)); safe_page = max(1, page)
    records = get_all('SELECT * FROM sis_student_records' + where + ' ORDER BY updatedAt DESC LIMIT ? OFFSET ?', tuple(params + [size, (safe_page - 1) * size]))
    return api_response(200, True, 'SIS records loaded.', {'records': records, 'total': int(total), 'page': safe_page, 'pageSize': size})


@router.get('/api/admin/sis/available-students')
async def list_students_without_sis(user: dict = Depends(require_roles('ADMIN'))):
    students = get_all('''SELECT u.id, u.studentCode, u.fullName, u.faculty, u.academicStatus
        FROM users u LEFT JOIN sis_student_records s ON s.userId = u.id
        WHERE u.role = ? AND s.id IS NULL ORDER BY u.fullName ASC''', ('STUDENT',))
    return api_response(200, True, 'Students available for SIS registration loaded.', {'students': students})


@router.post('/api/admin/sis')
async def create_sis_record(req: SisCreateRequest, user: dict = Depends(require_roles('ADMIN'))):
    data = req.dict()
    student = get_one('SELECT * FROM users WHERE id = ? AND role = ?', (data['userId'], 'STUDENT'))
    if not student:
        return api_response(400, False, 'Select an existing student account for this SIS record.', None, 'INVALID_STUDENT')
    if get_one('SELECT id FROM sis_student_records WHERE userId = ?', (data['userId'],)):
        return api_response(409, False, 'This student already has an SIS record.', None, 'SIS_RECORD_EXISTS')

    data['studentCode'] = data['studentCode'].strip().upper() if data.get('studentCode') else student.get('studentCode')
    data['fullName'] = data['fullName'].strip()
    if not data['fullName']:
        return api_response(400, False, 'Full name is required.', None, 'VALIDATION_ERROR')
    if data.get('academicStatus') not in (None, 'ACTIVE', 'SUSPENDED', 'WITHDRAWN', 'GRADUATED', 'LEAVE_OF_ABSENCE', 'UNKNOWN'):
        return api_response(400, False, 'Invalid academic status.', None, 'VALIDATION_ERROR')
    try:
        start = datetime.strptime(data['courseStartDate'], '%Y-%m-%d').date() if data.get('courseStartDate') else None
        end = datetime.strptime(data['courseEndDate'], '%Y-%m-%d').date() if data.get('courseEndDate') else None
    except ValueError:
        return api_response(400, False, 'Course dates must use YYYY-MM-DD.', None, 'VALIDATION_ERROR')
    if start and end and start > end:
        return api_response(400, False, 'Course start must not be after course end.', None, 'VALIDATION_ERROR')
    if data['studentCode'] and get_one('SELECT id FROM sis_student_records WHERE studentCode = ?', (data['studentCode'],)):
        return api_response(409, False, 'Student code already exists.', None, 'DUPLICATE_STUDENT_CODE')

    record_id = f"SIS-{data['userId']}"
    now = datetime.utcnow().isoformat() + 'Z'
    run_query('''INSERT INTO sis_student_records (id,userId,studentCode,fullName,academicStatus,courseStartDate,courseEndDate,currentTermActive,hasCurrentSchedule,registeredPermanentAddress,faculty,source,recordStatus,createdAt,updatedAt,updatedBy)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''', (
        record_id, data['userId'], data['studentCode'], data['fullName'], data.get('academicStatus'),
        data.get('courseStartDate'), data.get('courseEndDate'), data.get('currentTermActive'), data.get('hasCurrentSchedule'),
        data.get('registeredPermanentAddress'), data.get('faculty'), 'INTERNAL_SIS_ADMIN', data.get('recordStatus') or 'ACTIVE', now, now, user.get('id')
    ))
    record = get_one('SELECT * FROM sis_student_records WHERE id = ?', (record_id,))
    await db_service.log_audit({'action': 'ADMIN_SIS_RECORD_CREATED', 'actor': user, 'caseId': None,
        'input': {'recordId': record_id, 'userId': data['userId'], 'studentCode': data['studentCode']},
        'result': 'SUCCESS', 'reason': 'Admin created an authoritative internal SIS record.'})
    return api_response(201, True, 'SIS record created.', {'record': record})


@router.get('/api/admin/sis/{record_id}')
async def get_sis_record(record_id: str, user: dict = Depends(require_roles('ADMIN'))):
    record = get_one('SELECT * FROM sis_student_records WHERE id = ?', (record_id,))
    return api_response(200 if record else 404, bool(record), 'SIS record loaded.' if record else 'SIS record not found.', {'record': record} if record else None)

@router.put('/api/admin/sis/{record_id}')
async def update_sis_record(record_id: str, req: SisUpdateRequest, user: dict = Depends(require_roles('ADMIN'))):
    record = get_one('SELECT * FROM sis_student_records WHERE id = ?', (record_id,))
    if not record: return api_response(404, False, 'SIS record not found.', None, 'NOT_FOUND')
    data = req.dict()
    data['studentCode'] = data['studentCode'].strip().upper() if data.get('studentCode') else None
    data['fullName'] = data['fullName'].strip()
    if not data['fullName']: return api_response(400, False, 'Full name is required.', None, 'VALIDATION_ERROR')
    if data.get('academicStatus') not in (None, 'ACTIVE','SUSPENDED','WITHDRAWN','GRADUATED','LEAVE_OF_ABSENCE','UNKNOWN'):
        return api_response(400, False, 'Invalid academic status.', None, 'VALIDATION_ERROR')
    try:
        start = datetime.strptime(data['courseStartDate'], '%Y-%m-%d').date() if data.get('courseStartDate') else None
        end = datetime.strptime(data['courseEndDate'], '%Y-%m-%d').date() if data.get('courseEndDate') else None
    except ValueError: return api_response(400, False, 'Course dates must use YYYY-MM-DD.', None, 'VALIDATION_ERROR')
    if start and end and start > end: return api_response(400, False, 'Course start must not be after course end.', None, 'VALIDATION_ERROR')
    if data['studentCode']:
        duplicate = get_one('SELECT id FROM sis_student_records WHERE studentCode = ? AND id <> ?', (data['studentCode'], record_id))
        if duplicate: return api_response(409, False, 'Student code already exists.', None, 'DUPLICATE_STUDENT_CODE')
    changed = {key: {'old': record.get(key), 'new': value} for key, value in data.items() if record.get(key) != value}
    if changed:
        values = [data[k] for k in data] + [datetime.utcnow().isoformat()+'Z', user.get('id'), record_id]
        run_query('UPDATE sis_student_records SET studentCode=?, fullName=?, academicStatus=?, courseStartDate=?, courseEndDate=?, currentTermActive=?, hasCurrentSchedule=?, registeredPermanentAddress=?, faculty=?, recordStatus=?, updatedAt=?, updatedBy=? WHERE id=?', tuple(values))
        await db_service.log_audit({'action':'ADMIN_SIS_RECORD_UPDATED','actor':user,'caseId':None,'input':{'recordId':record_id,'studentCode':data['studentCode'],'changedFields':changed},'result':'SUCCESS','reason':'Admin updated authoritative institutional SIS record.'})
    updated = get_one('SELECT * FROM sis_student_records WHERE id = ?', (record_id,))
    return api_response(200, True, 'SIS record updated.', {'record': updated})


@router.delete('/api/admin/sis/{record_id}')
async def delete_sis_record(record_id: str, user: dict = Depends(require_roles('ADMIN'))):
    """Remove only the internal SIS registry entry; the user account remains."""
    record = get_one('SELECT * FROM sis_student_records WHERE id = ?', (record_id,))
    if not record:
        return api_response(404, False, 'SIS record not found.', None, 'NOT_FOUND')

    run_query('DELETE FROM sis_student_records WHERE id = ?', (record_id,))
    await db_service.log_audit({
        'action': 'ADMIN_SIS_RECORD_DELETED',
        'actor': user,
        'caseId': None,
        'input': {'recordId': record_id, 'studentCode': record.get('studentCode'), 'fullName': record.get('fullName')},
        'result': 'SUCCESS',
        'reason': 'Admin removed an internal SIS registry record; the user account was retained.'
    })
    return api_response(200, True, 'SIS record deleted. The student account was not deleted.', {'recordId': record_id})


@router.get("/api/admin/users")
async def get_admin_users(user: dict = Depends(require_roles('ADMIN'))):
    cache_identity = {'view': 'directory'}
    cached = await get_cached_json('admin-users', cache_identity)
    if cached is not None:
        return api_response(200, True, 'Cached user directory.', cached)
    users = await db_service.get_users()
    clean_users = [{k: v for k, v in u.items() if k != 'password'} for u in users]
    result = {
        'users': clean_users,
        'total': len(clean_users)
    }
    await set_cached_json('admin-users', cache_identity, result, 20)
    return api_response(200, True, 'Lấy danh sách người dùng thành công.', result)


@router.post("/api/admin/users/create")
async def admin_create_user(req: CreateAdminUserRequest, user: dict = Depends(require_roles('ADMIN'))):
    username = req.username.strip() if req.username else ''
    password = req.password if req.password else ''
    if not username or not password or len(password) < 6:
        return api_response(400, False, 'Tên đăng nhập và mật khẩu (tối thiểu 6 ký tự) là bắt buộc.', None, 'VALIDATION_ERROR')

    existing = await db_service.get_user_by_username(username)
    if existing:
        return api_response(409, False, 'Tên đăng nhập này đã được sử dụng.', None, 'USERNAME_EXISTS')

    created = await db_service.create_user(req.dict())
    if created and created.get('role') == 'STUDENT':
        now = datetime.utcnow().isoformat() + 'Z'
        run_query('''INSERT INTO sis_student_records (id,userId,studentCode,fullName,academicStatus,courseStartDate,courseEndDate,currentTermActive,hasCurrentSchedule,registeredPermanentAddress,faculty,source,recordStatus,createdAt,updatedAt,updatedBy)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (userId) DO NOTHING''', (
            f"SIS-{created['id']}", created['id'], created.get('studentCode'), created['fullName'], None,
            None, None, False, False, None, created.get('department'), 'ADMIN_ACCOUNT_PROVISIONING',
            'ACTIVE', now, now, user.get('id')
        ))
        await db_service.log_audit({
            'action': 'ADMIN_SIS_RECORD_PROVISIONED', 'actor': user, 'caseId': None,
            'input': {'userId': created['id'], 'recordId': f"SIS-{created['id']}", 'studentCode': created.get('studentCode')},
            'result': 'SUCCESS', 'reason': 'A blank SIS record was provisioned automatically with the new student account.'
        })
    clean_user = {k: v for k, v in (created or {}).items() if k != 'password'}
    return api_response(201, True, f"Tạo tài khoản {req.fullName} ({req.role}) thành công.", {'user': clean_user, **clean_user})


@router.put("/api/admin/users/{user_id}/role")
async def update_user_role_endpoint(
    user_id: str,
    req: UpdateRoleRequest,
    user: dict = Depends(require_roles('ADMIN'))
):
    if req.role not in ('STUDENT', 'REVIEWER', 'ADMIN'):
        return api_response(400, False, 'Vai trò không hợp lệ. Chỉ chấp nhận STUDENT, REVIEWER, ADMIN.', None, 'INVALID_ROLE')

    updated = await db_service.update_user_role(user_id, req.role, user)
    if not updated:
        return api_response(404, False, 'Không tìm thấy người dùng.', None, 'NOT_FOUND')

    clean_user = {k: v for k, v in updated.items() if k != 'password'}
    return api_response(200, True, f"Cập nhật vai trò sang {req.role} thành công.", clean_user)


@router.get("/api/admin/users/export-csv")
@router.get("/api/admin/users/export")
async def export_users_csv(user: dict = Depends(require_roles('ADMIN'))):
    users = await db_service.get_users()
    csv_str = generate_users_csv(users)
    filename = f"EDUASSISTANT_Nguoi_Dung_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_str.encode('utf-8'),
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


from app.services.escalation_policy_service import get_confidence_threshold, get_threshold_history
import json

@router.get("/api/admin/stats")
@router.get("/api/admin/system/metrics")
async def get_system_metrics(user: dict = Depends(require_roles('ADMIN'))):
    cache_identity = {'view': 'dashboard'}
    cached = await get_cached_json('admin-stats', cache_identity)
    if cached is not None:
        return api_response(200, True, 'Cached system metrics.', cached)

    # Aggregate in PostgreSQL so the dashboard never loads full tables merely
    # to calculate counters and chart data.
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat().replace('+00:00', 'Z')
    dashboard = await db_service.get_admin_dashboard_statistics(recent_cutoff)
    statuses = ('SUBMITTED', 'UNDER_REVIEW', 'REQUIRES_SUPPLEMENT', 'RESUBMITTED', 'APPROVED', 'REJECTED')
    categories = ('TUITION_DISCOUNT', 'ACADEMIC_SCHOLARSHIP', 'COMMUNITY_SERVICE', 'EMERGENCY_AID')
    priorities = ('URGENT', 'HIGH', 'MEDIUM', 'LOW')
    escalation_reasons = (
        'OWNERSHIP_UNCLEAR', 'FACT_UNKNOWN', 'DATA_CONFLICT',
        'AUTHORITY_REQUIRED', 'POLICY_OUT_OF_SCOPE'
    )
    def grouped(rows, key):
        return {row.get(key): int(row.get('count') or 0) for row in rows if row.get(key) is not None}

    case_summary = dashboard.get('cases', {})
    audit_summary = dashboard.get('audits', {})
    status_counts = grouped(dashboard.get('statuses', []), 'status')
    category_counts = grouped(dashboard.get('categories', []), 'category')
    priority_counts = grouped(dashboard.get('priorities', []), 'priority')
    role_counts = grouped(dashboard.get('roles', []), 'role')
    escalation_counts = grouped(dashboard.get('escalations', []), 'reason')

    status_breakdown = {status: status_counts.get(status, 0) for status in statuses}
    category_breakdown = {category: category_counts.get(category, 0) for category in categories}
    priority_breakdown = {priority: priority_counts.get(priority, 0) for priority in priorities}
    role_breakdown = {role: role_counts.get(role, 0) for role in ('STUDENT', 'REVIEWER', 'ADMIN')}
    escalation_reasons_breakdown = {reason: escalation_counts.get(reason, 0) for reason in escalation_reasons}
    total_cases = int(case_summary.get('total_cases') or 0)
    approved_cases = int(case_summary.get('approved_cases') or 0)
    rejected_cases = int(case_summary.get('rejected_cases') or 0)

    total_uploads = 0
    total_upload_size = 0
    if os.path.exists(UPLOAD_DIR):
        for f in os.listdir(UPLOAD_DIR):
            fp = os.path.join(UPLOAD_DIR, f)
            if os.path.isfile(fp):
                total_uploads += 1
                total_upload_size += os.path.getsize(fp)

    # Đếm Human Overrides & Reviewer Feedback từ Audit Trail
    # Đọc kết quả benchmark thật nếu có (không bịa số)
    bm_json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'benchmark', 'results', 'latest.json')
    benchmark_metrics = {
        'decisionAccuracy': 'Not measured yet',
        'missedEscalationRate': 'Not measured yet',
        'unnecessaryEscalationRate': 'Not measured yet',
        'automationRate': 'Not measured yet',
        'lastBenchmarkRun': None
    }

    if os.path.exists(bm_json_path):
        try:
            with open(bm_json_path, 'r', encoding='utf-8') as f:
                bm_data = json.load(f)
            m = bm_data.get('metrics', {})
            benchmark_metrics = {
                'decisionAccuracy': f"{m.get('decisionAccuracy')}%",
                'missedEscalationRate': f"{m.get('missedEscalationRate')}%",
                'unnecessaryEscalationRate': f"{m.get('unnecessaryEscalationRate')}%",
                'automationRate': f"{m.get('automationRate')}%",
                'lastBenchmarkRun': bm_data.get('timestamp')
            }
        except Exception:
            pass

    result = {
        'totalUsers': int(dashboard.get('users', {}).get('total_users') or 0),
        'totalCases': total_cases,
        'todayCasesCount': int(case_summary.get('today_cases_count') or 0),
        'pendingCases': int(case_summary.get('pending_cases') or 0),
        'approvedCases': approved_cases,
        'rejectedCases': rejected_cases,
        'approvalRate': round((approved_cases / total_cases) * 100) if total_cases else 0,
        'statusBreakdown': status_breakdown,
        'categoryBreakdown': category_breakdown,
        'priorityBreakdown': priority_breakdown,
        'roleBreakdown': role_breakdown,
        'autoApprovedCases': int(case_summary.get('auto_approved_cases') or 0),
        'escalatedCases': int(case_summary.get('escalated_cases') or 0),
        'escalationReasonsBreakdown': escalation_reasons_breakdown,
        'recentCases': dashboard.get('recentCases', []),
        'totalAudits': int(audit_summary.get('total_audits') or 0),
        'totalUploads': total_uploads,
        'uploadStorageSizeMB': round(total_upload_size / (1024 * 1024), 2),
        'aiMode': get_ai_mode(),
        'systemStatus': 'ONLINE',
        'currentEscalationThreshold': get_confidence_threshold(),
        'totalHumanOverrides': int(audit_summary.get('total_human_overrides') or 0),
        'totalReviewerFeedback': int(audit_summary.get('total_reviewer_feedback') or 0),
        'missedEscalationFeedbackCount': int(audit_summary.get('missed_escalation_feedback_count') or 0),
        'unnecessaryEscalationFeedbackCount': int(audit_summary.get('unnecessary_escalation_feedback_count') or 0),
        'correctFeedbackCount': int(audit_summary.get('correct_feedback_count') or 0),
        'benchmarkMetrics': benchmark_metrics,
        'serverTime': datetime.utcnow().isoformat() + 'Z'
    }
    await set_cached_json('admin-stats', cache_identity, result, 20)
    return api_response(200, True, 'Lấy chỉ số hệ thống thành công.', result)
