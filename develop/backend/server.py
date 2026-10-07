"""
============================================================================
CASEFLOW AI - UNIFIED ENTERPRISE BACKEND SERVER ENGINE (PYTHON FASTAPI)
============================================================================
Máy chủ Backend Python duy nhất hợp nhất toàn bộ 3 phân hệ nghiệp vụ:
  🔐 PHÂN HỆ 1: AUTHENTICATION & ACCESS CONTROL (JWT, Bcrypt, 2FA TOTP, RBAC)
  📝 PHÂN HỆ 2: CASE SUBMISSION & MULTIMODAL AI OCR WORKFLOW (Rule Engine)
  🛡️ PHÂN HỆ 3: AUDIT TRAIL & SECURITY MONITORING (IDOR Guard, SQLite)
============================================================================
"""

import os
import sys

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import time
import json
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Request, Response, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
import jwt
import bcrypt
import pyotp
import qrcode
import io
import base64
from dotenv import load_dotenv

# Tải file cấu hình .env
env_paths = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'),
    '.env'
]
for p in env_paths:
    if os.path.exists(p):
        load_dotenv(p)

# Import các modules dùng chung
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.database import init_database
from shared.db import db_service, DEPARTMENT_MAP
from shared.upload_service import (
    UPLOAD_DIR,
    validate_file_buffer,
    process_and_save_file,
    process_and_save_avatar
)
from shared.ai_service import (
    get_ai_mode,
    set_ai_mode,
    extract_case_data,
    sanitize_json_string
)
from shared.ocr_service import extract_document_entities
from shared.report_service import (
    generate_users_csv,
    generate_cases_csv,
    generate_cases_table_html,
    generate_decision_html,
    generate_audits_csv
)
from shared.rule_engine import evaluate_case, ESCALATION_CONFIG

# Khởi tạo FastAPI app
app = FastAPI(
    title="CaseFlow AI Enterprise Backend Engine",
    description="Hệ thống Thẩm định Học vụ Tự động Đa phân hệ",
    version="3.0.0"
)

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cấu hình JWT & Bí mật
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    if os.environ.get('NODE_ENV') == 'production' or os.environ.get('ENV') == 'production':
        raise RuntimeError('FATAL: JWT_SECRET environment variable must be explicitly defined in production!')
    JWT_SECRET = 'caseflow_sec_jwt_' + secrets.token_hex(32)

REFRESH_SECRET = os.environ.get('REFRESH_SECRET')
if not REFRESH_SECRET:
    if os.environ.get('NODE_ENV') == 'production' or os.environ.get('ENV') == 'production':
        raise RuntimeError('FATAL: REFRESH_SECRET environment variable must be explicitly defined in production!')
    REFRESH_SECRET = 'caseflow_sec_ref_' + secrets.token_hex(32)

PORT = int(os.environ.get('PORT', 3001))

# ============================================================================
# 1. RATE LIMITING & HELPER FUNCTIONS
# ============================================================================
login_attempts = {}
MAX_ATTEMPTS = 5
LOCKOUT_MS = 5 * 60 * 1000


def check_rate_limit(key: str) -> dict:
    entry = login_attempts.get(key)
    if not entry:
        return {'allowed': True}
    now_ts = time.time() * 1000
    if entry.get('lockedUntil') and now_ts < entry['lockedUntil']:
        remaining = int((entry['lockedUntil'] - now_ts) / 1000)
        return {'allowed': False, 'remainingSeconds': remaining}
    if entry.get('lockedUntil') and now_ts >= entry['lockedUntil']:
        login_attempts.pop(key, None)
        return {'allowed': True}
    return {'allowed': True}


def record_failed_attempt(key: str):
    entry = login_attempts.get(key, {'count': 0, 'lockedUntil': None})
    entry['count'] += 1
    if entry['count'] >= MAX_ATTEMPTS:
        entry['lockedUntil'] = time.time() * 1000 + LOCKOUT_MS
    login_attempts[key] = entry


def clear_rate_limit(key: str):
    login_attempts.pop(key, None)


def api_response(status_code: int, success: bool, message: str, data: Any = None, error: Any = None):
    return JSONResponse(
        status_code=status_code,
        content={
            'success': success,
            'statusCode': status_code,
            'message': message,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'data': data,
            'error': error
        }
    )


@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    err_code = 'ERROR'
    msg = str(exc.detail)
    if isinstance(exc.detail, dict):
        msg = exc.detail.get('message', str(exc.detail))
        err_code = exc.detail.get('error', 'ERROR')
    elif exc.status_code == 401:
        err_code = 'UNAUTHORIZED'
    elif exc.status_code == 403:
        err_code = 'FORBIDDEN'
    elif exc.status_code == 404:
        err_code = 'NOT_FOUND'

    return JSONResponse(
        status_code=exc.status_code,
        content={
            'success': False,
            'statusCode': exc.status_code,
            'message': msg,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'data': None,
            'error': err_code
        }
    )


# ============================================================================
# 2. AUTHENTICATION & RBAC DEPENDENCIES
# ============================================================================
async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get('Authorization') or request.headers.get('x-access-token')
    raw_token = None
    if auth_header:
        raw_token = auth_header[7:] if auth_header.startswith('Bearer ') else auth_header
    elif 'token' in request.query_params:
        raw_token = request.query_params['token']

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'success': False, 'message': 'Thiếu Token trong Authorization header hoặc query param token.', 'error': 'UNAUTHORIZED'}
        )

    try:
        decoded = jwt.decode(raw_token, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'success': False, 'message': 'Token không hợp lệ hoặc đã hết hạn.', 'error': 'INVALID_TOKEN'}
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


# ============================================================================
# 3. ROUTE LOGGING & HEALTH CHECK
# ============================================================================
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000)
    print(f"[{datetime.now().strftime('%I:%M:%S %p')}] {request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)")
    return response


@app.get("/api/health")
async def health_check():
    return {
        'status': 'healthy',
        'server': 'CaseFlow AI Python Enterprise Engine',
        'version': '3.0.0',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'modules': {
            'jwtAuth': 'Active & Secure',
            'twoFactorTOTP': 'Active (No-Backdoor)',
            'geminiAI': f"Mode: {get_ai_mode()}",
            'ruleEngine': 'Active (5 Strict Reasons)',
            'database': 'SQLite Single Source of Truth'
        }
    }


# ============================================================================
# 4. AUTHENTICATION ENDPOINTS (PART 1)
# ============================================================================
class LoginRequest(BaseModel):
    username: str
    password: str
    twoFactorCode: Optional[str] = None
    otpCode: Optional[str] = None


@app.post("/api/login")
async def login(req: LoginRequest):
    username = req.username.strip() if req.username else ''
    password = req.password if req.password else ''
    two_factor_code = req.twoFactorCode or req.otpCode

    limiter = check_rate_limit(username.lower())
    if not limiter['allowed']:
        return api_response(429, False, f"Tài khoản đang bị tạm khóa do nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau {limiter['remainingSeconds']} giây.", None, 'RATE_LIMIT_EXCEEDED')

    user = await db_service.get_user_by_username(username)
    if not user:
        record_failed_attempt(username.lower())
        await db_service.log_audit({
            'action': 'AUTH_LOGIN_FAILED',
            'actor': {'id': None, 'username': username, 'role': 'GUEST', 'name': 'Khách'},
            'input': {'username': username},
            'result': 'FAILED',
            'reason': 'Tên đăng nhập không tồn tại trong hệ thống'
        })
        return api_response(401, False, 'Tên đăng nhập hoặc mật khẩu không chính xác.', None, 'INVALID_CREDENTIALS')

    is_match = bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8'))
    if not is_match:
        record_failed_attempt(username.lower())
        await db_service.log_audit({
            'action': 'AUTH_LOGIN_FAILED',
            'actor': {'id': user['id'], 'username': user['username'], 'role': user['role'], 'name': user['fullName']},
            'input': {'username': username},
            'result': 'FAILED',
            'reason': 'Nhập sai mật khẩu tài khoản'
        })
        return api_response(401, False, 'Tên đăng nhập hoặc mật khẩu không chính xác.', None, 'INVALID_CREDENTIALS')

    clear_rate_limit(username.lower())

    # 2FA TOTP Challenge
    if user.get('twoFactorEnabled'):
        if not two_factor_code:
            return api_response(200, True, 'Tài khoản yêu cầu mã xác thực 2 bước (2FA).', {'require2FA': True, 'requires2FA': True, 'userId': user['id']})

        secret = user.get('twoFactorSecret')
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

    return api_response(200, True, 'Đăng nhập thành công.', {
        'token': access_token,
        'accessToken': access_token,
        'refreshToken': refresh_token,
        'user': user_data
    })


class RegisterRequest(BaseModel):
    username: str
    password: str
    fullName: Optional[str] = None
    email: Optional[str] = None
    studentCode: Optional[str] = None
    role: Optional[str] = 'STUDENT'
    department: Optional[str] = None
    mustChangePassword: Optional[bool] = False


@app.post("/api/register")
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

    return api_response(201, True, 'Đăng ký tài khoản sinh viên thành công.', {
        'token': access_token,
        'accessToken': access_token,
        'refreshToken': refresh_token,
        'user': user_data
    })


class RefreshRequest(BaseModel):
    refreshToken: str


@app.post("/api/auth/refresh")
async def refresh_token_endpoint(req: RefreshRequest):
    ref_token = req.refreshToken.strip() if req.refreshToken else ''
    if not ref_token:
        return api_response(400, False, 'Thiếu Refresh Token.', None, 'MISSING_REFRESH_TOKEN')

    stored = await db_service.find_refresh_token(ref_token)
    if not stored:
        return api_response(401, False, 'Refresh Token không hợp lệ hoặc đã bị thu hồi.', None, 'INVALID_REFRESH_TOKEN')

    user = await db_service.get_user_by_id(stored['userId'])
    if not user:
        await db_service.delete_refresh_token(ref_token)
        return api_response(401, False, 'Tài khoản không tồn tại.', None, 'USER_NOT_FOUND')

    await db_service.delete_refresh_token(ref_token)

    new_token_payload = {
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'fullName': user['fullName'],
        'studentCode': user.get('studentCode'),
        'department': user.get('department'),
        'mustChangePassword': bool(user.get('mustChangePassword')),
        'exp': datetime.utcnow() + timedelta(hours=8)
    }
    new_access_token = jwt.encode(new_token_payload, JWT_SECRET, algorithm='HS256')
    new_refresh_token = secrets.token_hex(32)
    new_refresh_expires = (datetime.utcnow() + timedelta(days=7)).isoformat() + 'Z'
    await db_service.save_refresh_token(user['id'], new_refresh_token, new_refresh_expires)

    return api_response(200, True, 'Làm mới phiên đăng nhập thành công.', {
        'token': new_access_token,
        'accessToken': new_access_token,
        'refreshToken': new_refresh_token
    })


@app.post("/api/auth/logout")
async def logout(req: Optional[RefreshRequest] = None):
    if req and req.refreshToken:
        await db_service.delete_refresh_token(req.refreshToken)
    return api_response(200, True, 'Đăng xuất thành công.')


@app.get("/api/auth/me")
async def get_current_user_profile(user: dict = Depends(get_current_user)):
    user_db = await db_service.get_user_by_id(user['id'])
    if not user_db:
        return api_response(404, False, 'Không tìm thấy người dùng.', None, 'NOT_FOUND')
    clean_user = {k: v for k, v in user_db.items() if k != 'password'}
    return api_response(200, True, 'Lấy thông tin tài khoản thành công.', clean_user)


class ChangePasswordRequest(BaseModel):
    oldPassword: str
    newPassword: str


@app.post("/api/auth/change-password")
async def change_password(req: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    res = await db_service.change_user_password(user['id'], req.oldPassword, req.newPassword, user)
    if not res['success']:
        return api_response(400, False, res['message'], None, 'PASSWORD_CHANGE_FAILED')
    return api_response(200, True, 'Đổi mật khẩu thành công. Các phiên đăng nhập khác đã được thu hồi an toàn.')


@app.post("/api/auth/2fa/generate")
async def generate_2fa(user: dict = Depends(get_current_user)):
    user_db = await db_service.get_user_by_id(user['id'])
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    otpauth_url = totp.provisioning_uri(name=user_db['username'], issuer_name='CaseFlow AI (University Portal)')

    qr_img = qrcode.make(otpauth_url)
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format='PNG')
    qr_data_url = f"data:image/png;base64,{base64.b64encode(qr_buf.getvalue()).decode('utf-8')}"

    await db_service.save_2fa_secret(user['id'], secret)

    return api_response(200, True, 'Tạo mã bí mật 2FA thành công.', {
        'secret': secret,
        'qrCodeUrl': qr_data_url,
        'otpauthUrl': otpauth_url
    })


class Enable2FARequest(BaseModel):
    token: Optional[str] = None
    otpCode: Optional[str] = None


@app.post("/api/auth/2fa/enable")
async def enable_2fa(req: Enable2FARequest, user: dict = Depends(get_current_user)):
    user_db = await db_service.get_user_by_id(user['id'])
    secret = user_db.get('twoFactorSecret')
    if not secret:
        return api_response(400, False, 'Chưa tạo mã bí mật 2FA. Vui lòng gọi /api/auth/2fa/generate trước.', None, 'NO_SECRET')

    totp = pyotp.TOTP(secret)
    token_str = str(req.token or req.otpCode or '').strip()
    is_valid = totp.verify(token_str, valid_window=1)

    if not is_valid:
        return api_response(400, False, 'Mã TOTP 6 số không hợp lệ hoặc đã hết hạn.', None, 'INVALID_TOKEN')

    await db_service.set_2fa_status(user['id'], True)
    return api_response(200, True, 'Kích hoạt xác thực 2 bước (2FA) thành công.')


@app.post("/api/auth/2fa/disable")
async def disable_2fa(user: dict = Depends(get_current_user)):
    await db_service.set_2fa_status(user['id'], False)
    return api_response(200, True, 'Đã tắt xác thực 2 bước.')


# ============================================================================
# 5. CASES & EVIDENCE ENDPOINTS (PART 2)
# ============================================================================
@app.get("/api/cases")
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


@app.get("/api/cases/{case_id}")
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


class CreateCaseRequest(BaseModel):
    title: str
    category: str
    description: Optional[str] = ''
    priority: Optional[str] = 'MEDIUM'
    evidenceFiles: Optional[List[Any]] = []
    assignedDepartment: Optional[str] = None
    deadline: Optional[str] = None


@app.post("/api/cases")
async def create_case_endpoint(req: CreateCaseRequest, user: dict = Depends(get_current_user)):
    if user['role'] != 'STUDENT' and user['role'] != 'ADMIN':
        return api_response(403, False, 'Chỉ sinh viên mới được quyền tạo hồ sơ học vụ.', None, 'FORBIDDEN')

    case_dict = req.dict()
    student_user = await db_service.get_user_by_id(user['id'])

    ai_res = await extract_case_data(case_dict, user)
    ai_extraction = ai_res.get('data', {})

    rule_verdict = evaluate_case(case_dict, ai_extraction, student_user)

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
    return api_response(201, True, 'Tạo hồ sơ học vụ thành công.', {'case': created, **created})


class ReviewCaseRequest(BaseModel):
    action: Optional[str] = None
    decision: Optional[str] = None
    reason: Optional[str] = ''
    assignedDepartment: Optional[str] = None


@app.post("/api/cases/{case_id}/review")
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

    return api_response(200, True, f"Thẩm định hồ sơ #{case_id} thành công ({next_status}).", {'case': updated, **updated})


@app.get("/api/cases/{case_id}/comments")
async def get_case_comments(case_id: str, user: dict = Depends(get_current_user)):
    target_case = await db_service.get_case_by_id(case_id)
    if not target_case:
        return api_response(404, False, f"Không tìm thấy hồ sơ #{case_id}.", None, 'NOT_FOUND')

    if user['role'] == 'STUDENT' and target_case['studentId'] != user['id']:
        return api_response(403, False, 'Bạn không có quyền xem bình luận trên hồ sơ của sinh viên khác.', None, 'FORBIDDEN')

    comments = await db_service.get_comments(case_id)
    return api_response(200, True, 'Lấy danh sách bình luận thành công.', comments)


class AddCommentRequest(BaseModel):
    content: str


@app.post("/api/cases/{case_id}/comments")
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


@app.get("/api/cases/{case_id}/export-decision")
async def export_decision(case_id: str, request: Request, user: dict = Depends(get_current_user)):
    target_case = await db_service.get_case_by_id(case_id)
    if not target_case:
        return api_response(404, False, 'Không tìm thấy hồ sơ.', None, 'NOT_FOUND')

    if user['role'] == 'STUDENT' and target_case['studentId'] != user['id']:
        return api_response(403, False, 'Bạn không có quyền truy cập quyết định này.', None, 'FORBIDDEN')

    base_url = str(request.base_url).rstrip('/')
    html_content = generate_decision_html(target_case, base_url)
    return HTMLResponse(content=html_content)


@app.get("/api/cases/verify/{case_id}")
async def verify_case_public(case_id: str):
    verification_data = await db_service.get_case_for_verification(case_id)
    if not verification_data:
        return api_response(404, False, 'Không tìm thấy hồ sơ để xác thực.', None, 'NOT_FOUND')
    return api_response(200, True, 'Tra cứu xác thực chứng nhận học vụ số hóa thành công.', verification_data)


# ============================================================================
# 6. UPLOAD & FILE SERVING (MAGIC BYTES & EVIDENCE ACCESS CONTROL)
# ============================================================================
@app.post("/api/upload/evidence")
async def upload_evidence_endpoint(
    evidence: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    file_bytes = await evidence.read()
    try:
        saved_file = await process_and_save_file(file_bytes, evidence.filename, user, db_service)
    except Exception as e:
        return api_response(400, False, str(e), None, 'UPLOAD_ERROR')

    user_db = await db_service.get_user_by_id(user['id'])
    ocr_res = await extract_document_entities(file_bytes, evidence.filename, user_db)
    
    ocr_is_live = 'Gemini' in ocr_res.get('provider', '')
    await db_service.save_evidence_upload({
        'fileName': saved_file['fileName'],
        'ownerId': user['id'],
        'metadata': saved_file['metadata'],
        'ocrData': ocr_res.get('data'),
        'ocrProvider': ocr_res.get('provider'),
        'ocrIsLive': ocr_is_live
    })

    saved_file['ocrData'] = ocr_res.get('data')
    saved_file['ocrProvider'] = ocr_res.get('provider')

    return api_response(201, True, 'Tải lên và phân tích OCR minh chứng thành công.', saved_file)


@app.post("/api/upload/avatar")
async def upload_avatar_endpoint(
    avatar: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    file_bytes = await avatar.read()
    try:
        saved_avatar = await process_and_save_avatar(file_bytes, avatar.filename, user, db_service)
        await db_service.update_user_profile(user['id'], {'avatar': saved_avatar['fileUrl']}, user)
    except Exception as e:
        return api_response(400, False, str(e), None, 'AVATAR_ERROR')

    return api_response(200, True, 'Cập nhật ảnh đại diện thành công.', saved_avatar)


@app.get("/api/evidence/{filename}")
async def serve_evidence(filename: str, user: dict = Depends(get_current_user)):
    sanitized_filename = os.path.basename(filename)
    file_path = os.path.join(UPLOAD_DIR, sanitized_filename)

    if user['role'] == 'STUDENT':
        owned_upload = await db_service.get_evidence_upload(sanitized_filename, user['id'])
        student_cases = await db_service.get_cases({'studentId': user['id']})
        attached_to_owned_case = any(
            any(f.get('fileName') == sanitized_filename or (f.get('fileUrl') and sanitized_filename in f.get('fileUrl'))
                for f in c.get('evidenceFiles', []))
            for c in student_cases
        )

        if not owned_upload and not attached_to_owned_case:
            await db_service.log_audit({
                'action': 'UNAUTHORIZED_FILE_ACCESS_ATTEMPT',
                'actor': {'id': user['id'], 'username': user['username'], 'role': user['role'], 'name': user['fullName']},
                'input': {'requestedFile': sanitized_filename},
                'result': 'BLOCKED',
                'reason': f"Sinh viên {user['username']} cố gắng truy cập trái phép tệp minh chứng {sanitized_filename}"
            })
            return api_response(403, False, 'Bạn không có quyền truy cập tệp minh chứng này.', None, 'FORBIDDEN')

    if not os.path.exists(file_path):
        return api_response(404, False, 'Không tìm thấy tệp minh chứng.', None, 'NOT_FOUND')

    media_type = 'image/webp' if sanitized_filename.endswith('.webp') else 'application/pdf'
    return FileResponse(file_path, media_type=media_type)


@app.get("/api/avatar/{filename}")
async def serve_avatar(filename: str):
    sanitized_filename = os.path.basename(filename)
    file_path = os.path.join(UPLOAD_DIR, sanitized_filename)
    if not os.path.exists(file_path):
        return api_response(404, False, 'Không tìm thấy ảnh đại diện.', None, 'NOT_FOUND')
    return FileResponse(file_path, media_type='image/webp')


# ============================================================================
# 7. AUDIT TRAIL & EXPORT ENDPOINTS (PART 3)
# ============================================================================
@app.get("/api/audits")
async def get_audits(
    action: Optional[str] = None,
    caseId: Optional[str] = None,
    actorRole: Optional[str] = None,
    date: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    filter_dict = {}

    if (user.get('role') or '').upper() == 'STUDENT':
        student_cases = await db_service.get_cases({'studentId': user['id']})
        owned_case_ids = [c['id'] for c in student_cases]
        filter_dict['studentVisibleFor'] = {
            'studentId': user['id'],
            'caseIds': owned_case_ids
        }
    else:
        if action and action != 'ALL':
            filter_dict['action'] = action
        if caseId:
            filter_dict['caseId'] = caseId
        if actorRole and actorRole != 'ALL':
            filter_dict['actorRole'] = actorRole

    if date:
        filter_dict['date'] = date

    audits = await db_service.get_audits(filter_dict)
    return api_response(200, True, 'Lấy danh sách nhật ký kiểm toán thành công.', {'audits': audits, 'total': len(audits)})


@app.get("/api/audits/export")
async def export_audits_csv(user: dict = Depends(require_roles('REVIEWER', 'ADMIN'))):
    audits = await db_service.get_audits({})
    csv_str = generate_audits_csv(audits)
    filename = f"CaseFlow_Audit_Trail_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_str.encode('utf-8'),
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


@app.get("/api/cases/export/csv")
async def export_cases_csv(user: dict = Depends(require_roles('REVIEWER', 'ADMIN'))):
    cases = await db_service.get_cases({})
    csv_str = generate_cases_csv(cases)
    filename = f"CaseFlow_Danh_Sach_Ho_So_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_str.encode('utf-8'),
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


@app.get("/api/cases/export/table")
async def export_cases_table(user: dict = Depends(require_roles('REVIEWER', 'ADMIN'))):
    cases = await db_service.get_cases({})
    html_content = generate_cases_table_html(cases)
    return HTMLResponse(content=html_content)


# ============================================================================
# 8. ADMIN & SYSTEM METRICS ENDPOINTS
# ============================================================================
@app.get("/api/admin/users")
async def get_admin_users(user: dict = Depends(require_roles('ADMIN'))):
    users = await db_service.get_users()
    clean_users = [{k: v for k, v in u.items() if k != 'password'} for u in users]
    return api_response(200, True, 'Lấy danh sách người dùng thành công.', clean_users)


class UpdateRoleRequest(BaseModel):
    role: str


@app.put("/api/admin/users/{user_id}/role")
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


@app.get("/api/admin/users/export")
async def export_users_csv(user: dict = Depends(require_roles('ADMIN'))):
    users = await db_service.get_users()
    csv_str = generate_users_csv(users)
    filename = f"CaseFlow_Nguoi_Dung_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_str.encode('utf-8'),
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


@app.get("/api/admin/system/metrics")
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


@app.get("/api/ai/status")
async def get_ai_status(user: dict = Depends(require_roles('ADMIN'))):
    api_key = os.environ.get('GEMINI_API_KEY')
    has_key = bool(api_key and len(api_key.strip()) > 10)
    return api_response(200, True, 'Lấy trạng thái cấu hình AI thành công.', {
        'aiMode': get_ai_mode(),
        'hasApiKey': has_key,
        'models': ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
        'defaultModel': 'gemini-2.5-flash',
        'failSafeEnabled': True
    })


class SetAiModeRequest(BaseModel):
    mode: str


@app.post("/api/ai/mode")
async def set_ai_mode_endpoint(req: SetAiModeRequest, user: dict = Depends(require_roles('ADMIN'))):
    if set_ai_mode(req.mode):
        return api_response(200, True, f"Chuyển đổi AI Engine sang chế độ {req.mode} thành công.", {'mode': req.mode})
    return api_response(400, False, 'Chế độ AI không hợp lệ. Chỉ chấp nhận live, mock, cache.', None, 'INVALID_MODE')


# ============================================================================
# 9. NOTIFICATIONS ENDPOINTS
# ============================================================================
@app.get("/api/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    notifs = await db_service.get_notifications(user['id'])
    return api_response(200, True, 'Lấy thông báo thành công.', notifs)


@app.put("/api/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user: dict = Depends(get_current_user)):
    await db_service.mark_notification_as_read(notif_id, user['id'])
    return api_response(200, True, 'Đã đánh dấu thông báo là đã đọc.')


@app.put("/api/notifications/read-all")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    await db_service.mark_all_notifications_as_read(user['id'])
    return api_response(200, True, 'Đã đánh dấu tất cả thông báo là đã đọc.')


# ============================================================================
# 10. FRONTEND STATIC ASSETS SERVING
# ============================================================================
frontend_dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'dist')
if os.path.exists(frontend_dist_dir):
    app.mount("/", StaticFiles(directory=frontend_dist_dir, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    print(f"""
╔══════════════════════════════════════════════════════════════════════════╗
║             🚀 CASEFLOW AI - ENTERPRISE PYTHON ENGINE 3.0                ║
╠══════════════════════════════════════════════════════════════════════════╣
║  • Status: ONLINE & SQLite Single Source of Truth Verified               ║
║  • Port: {PORT:<55} ║
║  • Base URL: http://localhost:{PORT}/api                                  ║
║  • Swagger Docs: http://localhost:{PORT}/docs                            ║
╚══════════════════════════════════════════════════════════════════════════╝
""")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
