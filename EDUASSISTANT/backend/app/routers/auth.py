import os
import sys
import io
import base64
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Request
import jwt
import bcrypt
import pyotp
import qrcode

from app.config import (
    ACCESS_COOKIE_NAME,
    COOKIE_DOMAIN,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    CSRF_COOKIE_NAME,
    JWT_SECRET,
    REFRESH_COOKIE_NAME,
)
from app.core.security import check_rate_limit, record_failed_attempt, clear_rate_limit
from app.core.responses import api_response
from app.core.dependencies import get_current_user
from app.schemas.auth import (
    LoginRequest,
    Login2FARequest,
    RegisterRequest,
    RefreshRequest,
    ChangePasswordRequest,
    UpdateProfileRequest,
    DeleteAccountRequest,
    Enable2FARequest,
)
from app.db.db import db_service

router = APIRouter(tags=["Authentication"])

ACCESS_TOKEN_MAX_AGE = 8 * 60 * 60
REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60


def _set_csrf_cookie(response, csrf_token: str) -> None:
    common = {
        'secure': COOKIE_SECURE,
        'samesite': COOKIE_SAMESITE,
        'domain': COOKIE_DOMAIN,
    }
    response.set_cookie(
        CSRF_COOKIE_NAME, csrf_token, httponly=False,
        max_age=REFRESH_TOKEN_MAX_AGE, path='/', **common
    )


def _issue_auth_cookies(response, access_token: str, refresh_token: str, csrf_token: str) -> None:
    """Store credentials in HttpOnly cookies; never expose them to JavaScript."""
    common = {
        'secure': COOKIE_SECURE,
        'samesite': COOKIE_SAMESITE,
        'domain': COOKIE_DOMAIN,
    }
    response.set_cookie(
        ACCESS_COOKIE_NAME, access_token, httponly=True, max_age=ACCESS_TOKEN_MAX_AGE,
        path='/', **common
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME, refresh_token, httponly=True, max_age=REFRESH_TOKEN_MAX_AGE,
        path='/api/auth', **common
    )
    # This value is intentionally not secret. The frontend receives it in the
    # response body because a cross-origin frontend cannot read the API cookie.
    _set_csrf_cookie(response, csrf_token)


def _clear_auth_cookies(response) -> None:
    common = {'secure': COOKIE_SECURE, 'samesite': COOKIE_SAMESITE, 'domain': COOKIE_DOMAIN}
    response.delete_cookie(ACCESS_COOKIE_NAME, path='/', **common)
    response.delete_cookie(REFRESH_COOKIE_NAME, path='/api/auth', **common)
    response.delete_cookie(CSRF_COOKIE_NAME, path='/', **common)


def _auth_response(status_code: int, message: str, user_data: dict, access_token: str, refresh_token: str):
    csrf_token = secrets.token_urlsafe(32)
    response = api_response(status_code, True, message, {'csrfToken': csrf_token, 'user': user_data})
    _issue_auth_cookies(response, access_token, refresh_token, csrf_token)
    return response


@router.post("/api/login")
async def login(req: LoginRequest):
    username = req.username.strip() if req.username else ''
    password = req.password if req.password else ''
    two_factor_code = req.twoFactorCode or req.otpCode

    limiter = await check_rate_limit(username.lower())
    if not limiter['allowed']:
        return api_response(429, False, f"Tài khoản đang bị tạm khóa do nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau {limiter['remainingSeconds']} giây.", None, 'RATE_LIMIT_EXCEEDED')

    user = await db_service.get_user_by_username(username)
    if not user:
        await record_failed_attempt(username.lower())
        await db_service.log_audit({
            'action': 'AUTH_LOGIN_FAILED',
            'actor': {'id': None, 'username': username, 'role': 'GUEST', 'name': 'Khách'},
            'input': {'username': username},
            'result': 'FAILED',
            'reason': 'Tên đăng nhập không tồn tại trong hệ thống'
        })
        return api_response(401, False, 'Tên đăng nhập hoặc mật khẩu không chính xác.', None, 'INVALID_CREDENTIALS')

    try:
        user_pw = user.get('password', '')
        if user_pw.startswith(('$2a$', '$2b$', '$2y$')):
            is_match = bcrypt.checkpw(password.encode('utf-8'), user_pw.encode('utf-8'))
        else:
            is_match = (password == user_pw)
    except Exception:
        is_match = (password == user.get('password', ''))
    if not is_match:
        await record_failed_attempt(username.lower())
        await db_service.log_audit({
            'action': 'AUTH_LOGIN_FAILED',
            'actor': {'id': user['id'], 'username': user['username'], 'role': user['role'], 'name': user['fullName']},
            'input': {'username': username},
            'result': 'FAILED',
            'reason': 'Nhập sai mật khẩu tài khoản'
        })
        return api_response(401, False, 'Tên đăng nhập hoặc mật khẩu không chính xác.', None, 'INVALID_CREDENTIALS')

    await clear_rate_limit(username.lower())

    # 2FA TOTP Challenge
    if user.get('twoFactorEnabled'):
        if not two_factor_code:
            temp_payload = {
                'id': user['id'],
                'username': user['username'],
                'temp2FA': True,
                'exp': datetime.utcnow() + timedelta(minutes=10)
            }
            temp_token = jwt.encode(temp_payload, JWT_SECRET, algorithm='HS256')
            email = user.get('email', '')
            masked_email = (email[:2] + '***@' + email.split('@')[-1]) if '@' in email else '***'
            return api_response(200, True, 'Tài khoản yêu cầu mã xác thực 2 bước (2FA).', {
                'require2FA': True,
                'requires2FA': True,
                'userId': user['id'],
                'tempToken': temp_token,
                'username': user['username'],
                'maskedEmail': masked_email
            })

        secret = str(user.get('twoFactorSecret') or '')
        totp = pyotp.TOTP(secret)
        is_totp_valid = totp.verify(str(two_factor_code).strip(), valid_window=1)

        if not is_totp_valid:
            await db_service.log_audit({
                'action': 'AUTH_2FA_FAILED',
                'actor': {'id': user['id'], 'username': user['username'], 'role': user['role'], 'name': user['fullName']},
                'input': {'username': username},
                'result': 'FAILED',
                'reason': 'Nhập sai mã 2FA TOTP'
            })
            return api_response(400, False, 'Mã xác thực 2 bước không chính xác hoặc đã hết hạn.', None, 'INVALID_2FA_CODE')

    token_payload = {
        'jti': secrets.token_hex(16),
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'fullName': user['fullName'],
        'studentCode': user.get('studentCode'),
        'department': user.get('department'),
        'mustChangePassword': bool(user.get('mustChangePassword')),
        'exp': datetime.utcnow() + timedelta(hours=8)
    }
    access_token = jwt.encode(token_payload, JWT_SECRET, algorithm='HS256')

    refresh_token = secrets.token_hex(32)
    refresh_expires = (datetime.utcnow() + timedelta(days=7)).isoformat() + 'Z'
    await db_service.save_refresh_token(user['id'], refresh_token, refresh_expires)

    user_data = {
        'id': user['id'],
        'username': user['username'],
        'fullName': user['fullName'],
        'studentCode': user.get('studentCode'),
        'email': user.get('email'),
        'role': user['role'],
        'department': user.get('department'),
        'avatar': user.get('avatar'),
        'bio': user.get('bio'),
        'twoFactorEnabled': bool(user.get('twoFactorEnabled')),
        'mustChangePassword': bool(user.get('mustChangePassword')),
        'createdAt': user.get('createdAt')
    }

    await db_service.log_audit({
        'action': 'AUTH_LOGIN_SUCCESS',
        'actor': {'id': user['id'], 'username': user['username'], 'role': user['role'], 'name': user['fullName']},
        'input': {'username': username, 'role': user['role']},
        'result': 'SUCCESS',
        'reason': f"Đăng nhập thành công vào hệ thống với vai trò {user['role']}"
    })

    return _auth_response(200, 'Đăng nhập thành công.', user_data, access_token, refresh_token)


@router.post("/api/auth/2fa/login")
async def login_2fa_endpoint(req: Login2FARequest):
    user_id = req.userId
    if req.tempToken:
        try:
            decoded = jwt.decode(req.tempToken, JWT_SECRET, algorithms=['HS256'])
            user_id = decoded.get('id')
        except Exception:
            return api_response(401, False, 'Phiên đăng nhập 2FA đã hết hạn. Vui lòng đăng nhập lại.', None, 'EXPIRED_TEMP_TOKEN')

    if not user_id:
        return api_response(400, False, 'Thiếu thông tin xác thực tài khoản.', None, 'MISSING_USER')

    user = await db_service.get_user_by_id(user_id)
    if not user:
        return api_response(404, False, 'Không tìm thấy thông tin tài khoản.', None, 'NOT_FOUND')

    secret = str(user.get('twoFactorSecret') or '')
    totp = pyotp.TOTP(secret)
    is_valid = totp.verify(str(req.otpCode or '').strip(), valid_window=1)

    if not is_valid:
        await db_service.log_audit({
            'action': 'AUTH_2FA_FAILED',
            'actor': {'id': user['id'], 'username': user['username'], 'role': user['role'], 'name': user['fullName']},
            'input': {'username': user['username']},
            'result': 'FAILED',
            'reason': 'Nhập sai mã 2FA TOTP'
        })
        return api_response(400, False, 'Mã OTP không hợp lệ hoặc đã hết hạn!', None, 'INVALID_2FA_CODE')

    token_payload = {
        'jti': secrets.token_hex(16),
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'fullName': user['fullName'],
        'studentCode': user.get('studentCode'),
        'department': user.get('department'),
        'mustChangePassword': bool(user.get('mustChangePassword')),
        'exp': datetime.utcnow() + timedelta(hours=8)
    }
    access_token = jwt.encode(token_payload, JWT_SECRET, algorithm='HS256')

    refresh_token = secrets.token_hex(32)
    refresh_expires = (datetime.utcnow() + timedelta(days=7)).isoformat() + 'Z'
    await db_service.save_refresh_token(user['id'], refresh_token, refresh_expires)

    user_data = {
        'id': user['id'],
        'username': user['username'],
        'fullName': user['fullName'],
        'studentCode': user.get('studentCode'),
        'email': user.get('email'),
        'role': user['role'],
        'department': user.get('department'),
        'avatar': user.get('avatar'),
        'bio': user.get('bio'),
        'twoFactorEnabled': bool(user.get('twoFactorEnabled')),
        'mustChangePassword': bool(user.get('mustChangePassword')),
        'createdAt': user.get('createdAt')
    }

    await db_service.log_audit({
        'action': 'AUTH_LOGIN_SUCCESS',
        'actor': {'id': user['id'], 'username': user['username'], 'role': user['role'], 'name': user['fullName']},
        'input': {'username': user['username'], 'role': user['role']},
        'result': 'SUCCESS',
        'reason': f"Đăng nhập thành công với 2FA TOTP ({user['role']})"
    })

    return _auth_response(200, 'Xác thực OTP thành công.', user_data, access_token, refresh_token)


@router.post("/api/register")
async def register(req: RegisterRequest):
    username = req.username.strip() if req.username else ''
    password = req.password if req.password else ''
    if not username or not password or len(password) < 6:
        return api_response(400, False, 'Tên đăng nhập và mật khẩu (tối thiểu 6 ký tự) là bắt buộc.', None, 'VALIDATION_ERROR')

    existing = await db_service.get_user_by_username(username)
    if existing:
        return api_response(409, False, 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.', None, 'USERNAME_EXISTS')

    user = await db_service.create_user(req.dict())
    
    token_payload = {
        'jti': secrets.token_hex(16),
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'fullName': user['fullName'],
        'studentCode': user.get('studentCode'),
        'department': user.get('department'),
        'mustChangePassword': bool(user.get('mustChangePassword')),
        'exp': datetime.utcnow() + timedelta(hours=8)
    }
    access_token = jwt.encode(token_payload, JWT_SECRET, algorithm='HS256')

    refresh_token = secrets.token_hex(32)
    refresh_expires = (datetime.utcnow() + timedelta(days=7)).isoformat() + 'Z'
    await db_service.save_refresh_token(user['id'], refresh_token, refresh_expires)

    user_data = {
        'id': user['id'],
        'username': user['username'],
        'fullName': user['fullName'],
        'studentCode': user.get('studentCode'),
        'email': user.get('email'),
        'role': user['role'],
        'department': user.get('department'),
        'avatar': user.get('avatar'),
        'twoFactorEnabled': False,
        'mustChangePassword': bool(user.get('mustChangePassword')),
        'createdAt': user.get('createdAt')
    }

    return _auth_response(201, 'Đăng ký tài khoản sinh viên thành công.', user_data, access_token, refresh_token)


@router.post("/api/auth/refresh")
async def refresh_token(request: Request, req: Optional[RefreshRequest] = None):
    refresh_token_val = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token_val:
        return api_response(400, False, 'Refresh Token là bắt buộc.', None, 'VALIDATION_ERROR')

    token_record = await db_service.get_refresh_token(refresh_token_val)
    if not token_record:
        return api_response(401, False, 'Refresh Token không hợp lệ hoặc đã bị thu hồi an toàn.', None, 'INVALID_TOKEN')

    expires_at = datetime.fromisoformat(token_record['expiresAt'].replace('Z', '+00:00'))
    if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) > expires_at:
        await db_service.delete_refresh_token(refresh_token_val)
        return api_response(401, False, 'Refresh Token đã hết hạn.', None, 'EXPIRED_TOKEN')

    user = await db_service.get_user_by_id(token_record['userId'])
    if not user:
        await db_service.delete_refresh_token(refresh_token_val)
        return api_response(401, False, 'Người dùng của phiên đăng nhập không còn tồn tại.', None, 'USER_NOT_FOUND')

    await db_service.delete_refresh_token(refresh_token_val)

    new_refresh_token = secrets.token_hex(32)
    new_expires = (datetime.utcnow() + timedelta(days=7)).isoformat() + 'Z'
    await db_service.save_refresh_token(user['id'], new_refresh_token, new_expires)

    token_payload = {
        'jti': secrets.token_hex(16),
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'fullName': user['fullName'],
        'studentCode': user.get('studentCode'),
        'department': user.get('department'),
        'mustChangePassword': bool(user.get('mustChangePassword')),
        'exp': datetime.utcnow() + timedelta(hours=8)
    }
    new_access_token = jwt.encode(token_payload, JWT_SECRET, algorithm='HS256')

    user_data = {
        'id': user['id'],
        'username': user['username'],
        'fullName': user['fullName'],
        'role': user['role'],
        'department': user.get('department'),
        'studentCode': user.get('studentCode'),
        'avatar': user.get('avatar'),
        'mustChangePassword': bool(user.get('mustChangePassword'))
    }
    return _auth_response(200, 'Làm mới phiên đăng nhập thành công.', user_data, new_access_token, new_refresh_token)


@router.post("/api/auth/logout")
async def logout(request: Request, req: Optional[RefreshRequest] = None):
    refresh_token_val = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_token_val:
        await db_service.delete_refresh_token(refresh_token_val)
    raw_token = request.cookies.get(ACCESS_COOKIE_NAME)
    if raw_token:
        try:
            decoded = jwt.decode(raw_token, JWT_SECRET, algorithms=['HS256'])
            if decoded.get('jti') and decoded.get('exp'):
                expiry = datetime.utcfromtimestamp(decoded['exp']).isoformat() + 'Z'
                await db_service.revoke_access_token(decoded['jti'], expiry)
        except jwt.PyJWTError:
            pass
    response = api_response(200, True, 'Đăng xuất thành công.')
    _clear_auth_cookies(response)
    return response


@router.get("/api/auth/csrf")
async def get_csrf_token(request: Request):
    """Expose the non-secret CSRF value to the allowed frontend origin."""
    if not (request.cookies.get(ACCESS_COOKIE_NAME) or request.cookies.get(REFRESH_COOKIE_NAME)):
        # A first visit has no session. This is an expected state, not an error.
        return api_response(200, True, 'Không có phiên đăng nhập.', {'csrfToken': None, 'hasSession': False})
    csrf_token = request.cookies.get(CSRF_COOKIE_NAME) or secrets.token_urlsafe(32)
    response = api_response(200, True, 'CSRF token đã sẵn sàng.', {'csrfToken': csrf_token, 'hasSession': True})
    _set_csrf_cookie(response, csrf_token)
    return response


@router.get("/api/auth/me")
async def get_current_user_profile(request: Request, user: dict = Depends(get_current_user)):
    user_db = await db_service.get_user_by_id(user['id'])
    if not user_db:
        return api_response(404, False, 'Không tìm thấy người dùng.', None, 'NOT_FOUND')
    clean_user = {k: v for k, v in user_db.items() if k != 'password'}
    csrf_token = request.cookies.get(CSRF_COOKIE_NAME) or secrets.token_urlsafe(32)
    response = api_response(200, True, 'Lấy thông tin tài khoản thành công.', {
        'csrfToken': csrf_token, 'user': clean_user, **clean_user
    })
    _set_csrf_cookie(response, csrf_token)
    return response


@router.put("/api/auth/profile")
async def update_profile(req: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        return api_response(400, False, 'Không có thông tin cần cập nhật.', None, 'NO_DATA')

    updated = await db_service.update_user_profile(user['id'], updates, user)
    clean_user = {k: v for k, v in (updated or {}).items() if k != 'password'}
    return api_response(200, True, 'Cập nhật thông tin thành công!', {'user': clean_user, **clean_user})


@router.put("/api/auth/change-password")
@router.post("/api/auth/change-password")
async def change_password(req: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    res = await db_service.change_user_password(user['id'], req.oldPassword, req.newPassword, user)
    if not res['success']:
        return api_response(400, False, res['message'], None, 'PASSWORD_CHANGE_FAILED')
    return api_response(200, True, 'Đổi mật khẩu thành công. Các phiên đăng nhập khác đã được thu hồi an toàn.')


@router.delete("/api/auth/account")
async def delete_account_endpoint(req: DeleteAccountRequest, user: dict = Depends(get_current_user)):
    user_db = await db_service.get_user_by_id(user['id'])
    if not user_db:
        return api_response(404, False, 'Tài khoản không tồn tại.', None, 'NOT_FOUND')

    if req.password:
        is_match = bcrypt.checkpw(req.password.encode('utf-8'), user_db['password'].encode('utf-8'))
        if not is_match:
            return api_response(400, False, 'Mật khẩu xác nhận không chính xác.', None, 'INVALID_PASSWORD')

    await db_service.delete_user(user['id'], user)
    return api_response(200, True, 'Xóa tài khoản thành công.')


@router.post("/api/auth/2fa/generate")
async def generate_2fa(user: dict = Depends(get_current_user)):
    user_db = await db_service.get_user_by_id(user['id'])
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    otpauth_url = totp.provisioning_uri(name=user_db['username'], issuer_name='EDUASSISTANT (University Portal)')

    qr_img = qrcode.make(otpauth_url)
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf)
    qr_data_url = f"data:image/png;base64,{base64.b64encode(qr_buf.getvalue()).decode('utf-8')}"

    await db_service.save_2fa_secret(user['id'], secret)

    return api_response(200, True, 'Tạo mã bí mật 2FA thành công.', {
        'secret': secret,
        'qrCodeUrl': qr_data_url,
        'otpauthUrl': otpauth_url
    })


@router.post("/api/auth/2fa/enable")
async def enable_2fa(req: Enable2FARequest, user: dict = Depends(get_current_user)):
    user_db = await db_service.get_user_by_id(user['id'])
    secret = user_db.get('twoFactorSecret') or req.secret
    if not secret:
        return api_response(400, False, 'Chưa tạo mã bí mật 2FA. Vui lòng gọi /api/auth/2fa/generate trước.', None, 'NO_SECRET')

    totp = pyotp.TOTP(str(secret).strip())
    token_str = str(req.token or req.otpCode or '').strip()
    is_valid = totp.verify(token_str, valid_window=1)

    if not is_valid:
        return api_response(400, False, 'Mã TOTP 6 số không hợp lệ hoặc đã hết hạn.', None, 'INVALID_TOKEN')

    if req.secret and not user_db.get('twoFactorSecret'):
        await db_service.save_2fa_secret(user['id'], req.secret)

    await db_service.set_2fa_status(user['id'], True)
    return api_response(200, True, 'Kích hoạt xác thực 2 bước (2FA) thành công.')


@router.post("/api/auth/2fa/disable")
async def disable_2fa(req: Optional[Enable2FARequest] = None, user: dict = Depends(get_current_user)):
    await db_service.set_2fa_status(user['id'], False)
    return api_response(200, True, 'Đã tắt xác thực 2 bước.')
