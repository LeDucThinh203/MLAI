import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Response

from app.db.db import db_service
from app.services.report_service import generate_users_csv
from app.services.upload_service import UPLOAD_DIR
from app.services.ai_service import get_ai_mode
from app.core.responses import api_response
from app.core.dependencies import require_roles
from app.schemas.admin import UpdateRoleRequest, CreateAdminUserRequest

router = APIRouter(tags=["Admin"])


@router.get("/api/admin/users")
async def get_admin_users(user: dict = Depends(require_roles('ADMIN'))):
    users = await db_service.get_users()
    clean_users = [{k: v for k, v in u.items() if k != 'password'} for u in users]
    return api_response(200, True, 'Lấy danh sách người dùng thành công.', {
        'users': clean_users,
        'total': len(clean_users)
    })


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

    return api_response(200, True, 'Lấy chỉ số hệ thống thành công.', {
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
    })
