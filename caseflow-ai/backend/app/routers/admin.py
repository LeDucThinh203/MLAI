import os
from datetime import datetime
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
    filename = f"CaseFlow_Nguoi_Dung_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_str.encode('utf-8'),
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


@router.get("/api/admin/stats")
@router.get("/api/admin/system/metrics")
async def get_system_metrics(user: dict = Depends(require_roles('ADMIN'))):
    users = await db_service.get_users()
    cases = await db_service.get_cases({})
    audits = await db_service.get_audits({})

    total_uploads = 0
    total_upload_size = 0
    if os.path.exists(UPLOAD_DIR):
        for f in os.listdir(UPLOAD_DIR):
            fp = os.path.join(UPLOAD_DIR, f)
            if os.path.isfile(fp):
                total_uploads += 1
                total_upload_size += os.path.getsize(fp)

    return api_response(200, True, 'Lấy chỉ số hệ thống thành công.', {
        'totalUsers': len(users),
        'totalCases': len(cases),
        'totalAudits': len(audits),
        'totalUploads': total_uploads,
        'uploadStorageSizeMB': round(total_upload_size / (1024 * 1024), 2),
        'aiMode': get_ai_mode(),
        'systemStatus': 'ONLINE',
        'serverTime': datetime.utcnow().isoformat() + 'Z'
    })
