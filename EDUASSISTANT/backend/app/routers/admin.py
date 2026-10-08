import os
from collections import Counter
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
    users = await db_service.get_users()
    cases = await db_service.get_cases({})
    audits = await db_service.get_audits({})

    # The Admin Portal needs its chart data pre-aggregated.  Always include
    # every supported key so an empty group renders as 0 instead of missing.
    statuses = ('SUBMITTED', 'UNDER_REVIEW', 'REQUIRES_SUPPLEMENT', 'RESUBMITTED', 'APPROVED', 'REJECTED')
    categories = ('TUITION_DISCOUNT', 'ACADEMIC_SCHOLARSHIP', 'COMMUNITY_SERVICE', 'EMERGENCY_AID')
    priorities = ('URGENT', 'HIGH', 'MEDIUM', 'LOW')
    escalation_reasons = (
        'OWNERSHIP_UNCLEAR', 'FACT_UNKNOWN', 'DATA_CONFLICT',
        'AUTHORITY_REQUIRED', 'POLICY_OUT_OF_SCOPE'
    )
    status_counts = Counter(case.get('status') for case in cases)
    category_counts = Counter(case.get('category') for case in cases)
    priority_counts = Counter(case.get('priority') or 'MEDIUM' for case in cases)
    role_counts = Counter(account.get('role') for account in users)

    escalation_counts = Counter()
    auto_approved_cases = 0
    escalated_cases = 0
    for case in cases:
        rule_engine = case.get('ruleEngine') or {}
        escalation = case.get('escalation') or {}
        decision = rule_engine.get('decision')
        reason = escalation.get('reason') or rule_engine.get('escalationReason')
        if decision == 'AUTO_APPROVE':
            auto_approved_cases += 1
        if decision == 'ESCALATE_TO_HUMAN' or reason:
            escalated_cases += 1
        if reason:
            escalation_counts[reason] += 1

    recent_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    today_cases_count = 0
    for case in cases:
        created_at = case.get('createdAt')
        if not created_at:
            continue
        try:
            created_time = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            if created_time.tzinfo is None:
                created_time = created_time.replace(tzinfo=timezone.utc)
            if created_time >= recent_cutoff:
                today_cases_count += 1
        except (TypeError, ValueError):
            # Legacy rows with malformed dates must not break the dashboard.
            continue

    status_breakdown = {status: status_counts[status] for status in statuses}
    category_breakdown = {category: category_counts[category] for category in categories}
    priority_breakdown = {priority: priority_counts[priority] for priority in priorities}
    role_breakdown = {role: role_counts[role] for role in ('STUDENT', 'REVIEWER', 'ADMIN')}
    escalation_reasons_breakdown = {reason: escalation_counts[reason] for reason in escalation_reasons}
    approved_cases = status_breakdown['APPROVED']
    rejected_cases = status_breakdown['REJECTED']
    total_cases = len(cases)

    total_uploads = 0
    total_upload_size = 0
    if os.path.exists(UPLOAD_DIR):
        for f in os.listdir(UPLOAD_DIR):
            fp = os.path.join(UPLOAD_DIR, f)
            if os.path.isfile(fp):
                total_uploads += 1
                total_upload_size += os.path.getsize(fp)

    # Đếm Human Overrides & Reviewer Feedback từ Audit Trail
    total_human_overrides = sum(1 for a in audits if a.get('action') == 'HUMAN_OVERRIDE')
    feedback_audits = [a for a in audits if a.get('action') == 'REVIEWER_FEEDBACK_SUBMITTED']
    total_reviewer_feedback = len(feedback_audits)
    missed_escalation_feedback_count = sum(1 for a in feedback_audits if (a.get('input') or {}).get('feedbackType') == 'MISSED_ESCALATION')
    unnecessary_escalation_feedback_count = sum(1 for a in feedback_audits if (a.get('input') or {}).get('feedbackType') == 'UNNECESSARY_ESCALATION')
    correct_feedback_count = sum(1 for a in feedback_audits if (a.get('input') or {}).get('feedbackType') == 'CORRECT')

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
        'totalUsers': len(users),
        'totalCases': total_cases,
        'todayCasesCount': today_cases_count,
        'pendingCases': status_breakdown['SUBMITTED'] + status_breakdown['UNDER_REVIEW'] + status_breakdown['RESUBMITTED'],
        'approvedCases': approved_cases,
        'rejectedCases': rejected_cases,
        'approvalRate': round((approved_cases / total_cases) * 100) if total_cases else 0,
        'statusBreakdown': status_breakdown,
        'categoryBreakdown': category_breakdown,
        'priorityBreakdown': priority_breakdown,
        'roleBreakdown': role_breakdown,
        'autoApprovedCases': auto_approved_cases,
        'escalatedCases': escalated_cases,
        'escalationReasonsBreakdown': escalation_reasons_breakdown,
        'recentCases': cases[:5],
        'totalAudits': len(audits),
        'totalUploads': total_uploads,
        'uploadStorageSizeMB': round(total_upload_size / (1024 * 1024), 2),
        'aiMode': get_ai_mode(),
        'systemStatus': 'ONLINE',
        'currentEscalationThreshold': get_confidence_threshold(),
        'totalHumanOverrides': total_human_overrides,
        'totalReviewerFeedback': total_reviewer_feedback,
        'missedEscalationFeedbackCount': missed_escalation_feedback_count,
        'unnecessaryEscalationFeedbackCount': unnecessary_escalation_feedback_count,
        'correctFeedbackCount': correct_feedback_count,
        'benchmarkMetrics': benchmark_metrics,
        'serverTime': datetime.utcnow().isoformat() + 'Z'
    })
