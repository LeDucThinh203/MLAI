from fastapi import Request, Depends, HTTPException, status
import jwt
from app.config import ACCESS_COOKIE_NAME, JWT_SECRET
from app.db.db import db_service


async def get_current_user(request: Request) -> dict:
    raw_token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not raw_token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            raw_token = auth_header[7:].strip()

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'success': False, 'message': 'Thiếu cookie xác thực.', 'error': 'UNAUTHORIZED'}
        )

    try:
        decoded = jwt.decode(raw_token, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'success': False, 'message': 'Token không hợp lệ hoặc đã hết hạn.', 'error': 'INVALID_TOKEN'}
        )

    if decoded.get('jti') and await db_service.is_access_token_revoked(decoded['jti']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'success': False, 'message': 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.', 'error': 'TOKEN_REVOKED'}
        )

    user = await db_service.get_user_by_id(decoded.get('id'))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'success': False, 'message': 'Tài khoản của phiên đăng nhập không còn tồn tại.', 'error': 'INVALID_USER'}
        )

    user_info = {
        **decoded,
        'role': user['role'],
        'mustChangePassword': bool(user.get('mustChangePassword')),
        'fullName': user['fullName'],
        'username': user['username'],
        'studentCode': user.get('studentCode'),
        'department': user.get('department'),
        'avatar': user.get('avatar')
    }

    allowed_paths = ['/auth/change-password', '/auth/me', '/auth/logout', '/api/auth/change-password', '/api/auth/me', '/api/auth/logout']
    curr_path = request.url.path
    if user_info['mustChangePassword'] and not any(curr_path.endswith(p) or p in curr_path for p in allowed_paths):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={'success': False, 'message': 'Tài khoản của bạn đang có yêu cầu bắt buộc đổi mật khẩu trước khi thực hiện các tác vụ khác.', 'error': 'PASSWORD_CHANGE_REQUIRED'}
        )

    return user_info


def require_roles(*allowed_roles: str):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get('role') not in allowed_roles:
            await db_service.log_audit({
                'action': 'ACCESS_FORBIDDEN_ATTEMPT',
                'actor': {'id': current_user.get('id'), 'username': current_user.get('username'), 'role': current_user.get('role'), 'name': current_user.get('fullName')},
                'input': {'requiredRoles': list(allowed_roles)},
                'result': 'BLOCKED',
                'reason': f"User có role {current_user.get('role')} cố gắng truy cập endpoint yêu cầu [{', '.join(allowed_roles)}]"
            })
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={'success': False, 'message': f"Truy cập bị từ chối! Yêu cầu quyền: [{', '.join(allowed_roles)}].", 'error': 'FORBIDDEN'}
            )
        return current_user
    return role_checker
