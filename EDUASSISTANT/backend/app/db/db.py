"""
============================================================================
CASEFLOW AI - DATABASE BUSINESS SERVICE (PYTHON MODULE)
============================================================================
Module tầng nghiệp vụ thao tác dữ liệu:
  - Quản lý người dùng, mật khẩu Bcrypt, đổi mật khẩu & thu hồi refresh token
  - Xác thực 2 bước (2FA Google Authenticator TOTP)
  - Quản lý hồ sơ học vụ, lọc đa tiêu chí, ký số HMAC-SHA256
  - Quản lý nhật ký kiểm toán (Audit Trail) với phân quyền cô lập bảo mật
  - Quản lý bình luận, thông báo hệ thống và tra cứu xác thực văn bản
============================================================================
"""

import os
import sys

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import json
import hmac
import hashlib
import secrets
import bcrypt
from datetime import datetime
from app.db.database import run_query, get_one, get_all, get_dashboard_statistics
from app.realtime import case_event_hub
from app.core.cache import bump_cache_version

DEFAULT_AUDIT_PAGE_SIZE = 10
MIN_AUDIT_PAGE_SIZE = 5
MAX_AUDIT_PAGE_SIZE = 100

DEPARTMENT_MAP = {
    'TUITION_DISCOUNT': 'Phòng Kế hoạch - Tài chính',
    'ACADEMIC_SCHOLARSHIP': 'Phòng Công tác Sinh viên',
    'GRADE_APPEAL': 'Phòng Quản lý Đào tạo',
    'COMMUNITY_SERVICE': 'Văn phòng Đoàn - Hội Sinh viên',
    'GENERAL': 'Phòng Công tác Sinh viên'
}


def get_signature_key() -> str:
    """Lấy khóa bí mật tạo chữ ký số HMAC-SHA256."""
    key = os.environ.get('SIGNATURE_KEY')
    if not key or len(key.strip()) < 16:
        if os.environ.get('NODE_ENV') == 'production' or os.environ.get('ENV') == 'production':
            raise RuntimeError('FATAL: Biến môi trường SIGNATURE_KEY chưa được cấu hình hoặc quá ngắn trong Production.')
        return 'caseflow_university_dev_sign_key_2026_x889'
    return key.strip()


def parse_json_field(val, fallback=None):
    """Giải mã an toàn trường JSON từ cơ sở dữ liệu."""
    if val is None:
        return fallback
    if isinstance(val, (dict, list)):
        return val
    try:
        return json.loads(val)
    except Exception:
        return fallback


def format_case_row(row: dict) -> dict:
    """Định dạng bản ghi hồ sơ từ SQLite sang Object hoàn chỉnh."""
    if not row:
        return None
    ai_ext = parse_json_field(row.get('aiExtraction'), None)
    res = dict(row)
    res['priority'] = row.get('priority') or 'MEDIUM'
    res['evidenceFiles'] = parse_json_field(row.get('evidenceFiles'), [])
    res['reviewResult'] = parse_json_field(row.get('reviewResult'), None)
    res['supplementHistory'] = parse_json_field(row.get('supplementHistory'), None)
    res['aiExtraction'] = ai_ext
    res['escalation'] = ai_ext.get('escalation') if isinstance(ai_ext, dict) else None
    res['ruleEngine'] = ai_ext.get('ruleEngine') if isinstance(ai_ext, dict) else None
    res['reviewerFeedback'] = parse_json_field(row.get('reviewerFeedback'), [])
    return res


def format_audit_row(row: dict) -> dict:
    """Định dạng bản ghi nhật ký kiểm toán."""
    if not row:
        return None
    raw_input = row.get('inputData')
    input_val = {}
    if raw_input:
        if isinstance(raw_input, (dict, list)):
            input_val = raw_input
        elif isinstance(raw_input, str):
            try:
                input_val = json.loads(raw_input)
            except Exception:
                input_val = raw_input

    return {
        'id': row.get('id'),
        'timestamp': row.get('timestamp'),
        'action': row.get('action'),
        'actor': {
            'id': row.get('actorId'),
            'name': row.get('actorName'),
            'role': row.get('actorRole'),
            'username': row.get('actorUsername')
        },
        'caseId': row.get('caseId'),
        'input': input_val,
        'result': row.get('result') or 'SUCCESS',
        'reason': row.get('reason')
    }


class DatabaseService:
    """Service thao tác CSDL CaseFlow AI."""

    # ================= USERS =================
    @staticmethod
    async def get_users():
        rows = get_all('SELECT * FROM users ORDER BY createdAt DESC')
        return [
            {**u, 'twoFactorEnabled': bool(u.get('twoFactorEnabled')), 'mustChangePassword': bool(u.get('mustChangePassword'))}
            for u in rows
        ]

    @staticmethod
    async def get_user_by_username(username: str):
        if not username:
            return None
        row = get_one('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', (username.strip(),))
        if not row:
            return None
        return {**row, 'twoFactorEnabled': bool(row.get('twoFactorEnabled')), 'mustChangePassword': bool(row.get('mustChangePassword'))}

    @staticmethod
    async def get_user_by_id(user_id: str):
        if not user_id:
            return None
        row = get_one('SELECT * FROM users WHERE id = ?', (user_id,))
        if not row:
            return None
        return {**row, 'twoFactorEnabled': bool(row.get('twoFactorEnabled')), 'mustChangePassword': bool(row.get('mustChangePassword'))}

    @staticmethod
    async def create_user(data: dict):
        username = data.get('username', '').strip()
        role = (data.get('role') or 'STUDENT').upper()
        is_student = role == 'STUDENT'
        raw_password = data.get('password') or 'password123'
        
        user_id = f"usr_{role.lower()}_{str(int(datetime.now().timestamp() * 1000))[-4:]}_{secrets.token_hex(2)}"
        
        if raw_password.startswith('$2a$') or raw_password.startswith('$2b$'):
            hashed_password = raw_password
        else:
            hashed_password = bcrypt.hashpw(raw_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        student_code = None
        if is_student:
            student_code = data.get('studentCode').strip().upper() if data.get('studentCode') else f"SV2026-{secrets.randbelow(9000) + 1000}"

        full_name = (data.get('fullName') or username).strip()
        email = data.get('email').strip() if data.get('email') else f"{username}@caseflow.ai"
        department = data.get('department').strip() if data.get('department') else 'Khoa Công Nghệ Thông Tin'
        avatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
        bio = 'Người dùng hệ thống CaseFlow AI.'
        must_change_pwd = bool(data.get('mustChangePassword'))
        now_iso = datetime.utcnow().isoformat() + 'Z'

        run_query("""
            INSERT INTO users (id, username, password, fullName, studentCode, email, role, department, avatar, bio, twoFactorEnabled, twoFactorSecret, mustChangePassword, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id, username, hashed_password, full_name, student_code, email,
            role, department, avatar, bio, False, None, must_change_pwd, now_iso, now_iso
        ))

        new_user = await DatabaseService.get_user_by_id(user_id)

        student_code_suffix = f" (MSSV: {new_user['studentCode']})" if new_user.get('studentCode') else ""
        await DatabaseService.log_audit({
            'action': 'AUTH_REGISTER',
            'actor': {'id': new_user['id'], 'username': new_user['username'], 'role': new_user['role'], 'name': new_user['fullName']},
            'input': {'username': new_user['username'], 'role': new_user['role'], 'studentCode': new_user['studentCode'], 'department': new_user['department']},
            'result': 'SUCCESS',
            'reason': f"Đăng ký tài khoản mới thành công với vai trò {new_user['role']}{student_code_suffix}"
        })

        await bump_cache_version('admin-stats')
        await bump_cache_version('admin-users')
        return new_user

    @staticmethod
    async def update_user_role(user_id: str, new_role: str, actor: dict):
        target_user = await DatabaseService.get_user_by_id(user_id)
        if not target_user:
            return None

        old_role = target_user['role']
        updated_at = datetime.utcnow().isoformat() + 'Z'

        run_query('UPDATE users SET role = ?, updatedAt = ? WHERE id = ?', (new_role, updated_at, user_id))

        await DatabaseService.log_audit({
            'action': 'ADMIN_ROLE_UPDATED',
            'actor': {'id': actor.get('id'), 'username': actor.get('username'), 'role': actor.get('role'), 'name': actor.get('fullName')},
            'input': {'userId': user_id, 'oldRole': old_role, 'newRole': new_role},
            'result': 'SUCCESS',
            'reason': f"Quản trị viên đã thay đổi quyền của tài khoản {target_user['username']} từ {old_role} thành {new_role}"
        })

        await bump_cache_version('admin-stats')
        await bump_cache_version('admin-users')
        return await DatabaseService.get_user_by_id(user_id)

    @staticmethod
    async def update_user_profile(user_id: str, profile_data: dict, actor: dict):
        target_user = await DatabaseService.get_user_by_id(user_id)
        if not target_user:
            return None

        full_name = profile_data.get('fullName').strip() if profile_data.get('fullName') and str(profile_data.get('fullName')).strip() else target_user['fullName']
        bio = profile_data.get('bio').strip() if profile_data.get('bio') is not None else target_user.get('bio', '')
        avatar = profile_data.get('avatar').strip() if profile_data.get('avatar') and str(profile_data.get('avatar')).strip() else target_user.get('avatar')
        department = profile_data.get('department').strip() if profile_data.get('department') and str(profile_data.get('department')).strip() else target_user.get('department')
        email = profile_data.get('email').strip() if profile_data.get('email') and str(profile_data.get('email')).strip() else target_user.get('email')
        
        student_code = target_user.get('studentCode')
        if target_user.get('role') == 'STUDENT' and profile_data.get('studentCode'):
            student_code = profile_data.get('studentCode').strip().upper()

        updated_at = datetime.utcnow().isoformat() + 'Z'

        run_query("""
            UPDATE users SET fullName = ?, bio = ?, avatar = ?, department = ?, email = ?, studentCode = ?, updatedAt = ? WHERE id = ?
        """, (full_name, bio, avatar, department, email, student_code, updated_at, user_id))

        await DatabaseService.log_audit({
            'action': 'USER_PROFILE_UPDATED',
            'actor': {'id': actor.get('id'), 'username': actor.get('username'), 'role': actor.get('role'), 'name': full_name},
            'input': {'userId': user_id, 'fullName': full_name, 'email': email, 'bio': bio},
            'result': 'SUCCESS',
            'reason': f"Người dùng {target_user['username']} đã cập nhật thông tin hồ sơ cá nhân và giới thiệu bản thân."
        })

        return await DatabaseService.get_user_by_id(user_id)

    @staticmethod
    async def change_user_password(user_id: str, old_password: str, new_password: str, actor: dict):
        target_user = await DatabaseService.get_user_by_id(user_id)
        if not target_user:
            return {'success': False, 'message': 'Người dùng không tồn tại.'}

        # Kiểm tra mật khẩu cũ
        stored_hash = target_user['password'].encode('utf-8')
        if not bcrypt.checkpw(old_password.encode('utf-8'), stored_hash):
            await DatabaseService.log_audit({
                'action': 'USER_PASSWORD_CHANGE_FAILED',
                'actor': {'id': actor.get('id'), 'username': actor.get('username'), 'role': actor.get('role'), 'name': actor.get('fullName')},
                'input': {'userId': user_id},
                'result': 'FAILED',
                'reason': 'Nhập sai mật khẩu hiện tại khi thực hiện đổi mật khẩu.'
            })
            return {'success': False, 'message': 'Mật khẩu hiện tại không chính xác. Vui lòng thử lại.'}

        if not new_password or len(new_password) < 6:
            return {'success': False, 'message': 'Mật khẩu mới phải có độ dài từ 6 ký tự trở lên.'}

        hashed_new = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        updated_at = datetime.utcnow().isoformat() + 'Z'

        run_query('UPDATE users SET password = ?, mustChangePassword = FALSE, updatedAt = ? WHERE id = ?', (hashed_new, updated_at, user_id))
        
        # Thu hồi toàn bộ refresh token
        await DatabaseService.revoke_all_user_refresh_tokens(user_id)

        await DatabaseService.log_audit({
            'action': 'USER_PASSWORD_CHANGED',
            'actor': {'id': actor.get('id'), 'username': actor.get('username'), 'role': actor.get('role'), 'name': actor.get('fullName')},
            'input': {'userId': user_id},
            'result': 'SUCCESS',
            'reason': f"Người dùng {target_user['username']} đã thay đổi mật khẩu thành công. Các phiên đăng nhập khác đã được thu hồi an toàn."
        })

        updated_user = await DatabaseService.get_user_by_id(user_id)
        return {'success': True, 'user': updated_user}

    @staticmethod
    async def delete_user(user_id: str, actor: dict):
        target_user = await DatabaseService.get_user_by_id(user_id)
        if not target_user:
            return False

        run_query('DELETE FROM users WHERE id = ?', (user_id,))
        await DatabaseService.revoke_all_user_refresh_tokens(user_id)

        await DatabaseService.log_audit({
            'action': 'USER_ACCOUNT_DELETED',
            'actor': {'id': actor.get('id'), 'username': actor.get('username'), 'role': actor.get('role'), 'name': actor.get('fullName')},
            'input': {'deletedUserId': user_id, 'username': target_user['username']},
            'result': 'SUCCESS',
            'reason': f"Tài khoản người dùng {target_user['username']} ({target_user['fullName']}) đã bị xóa khỏi hệ thống."
        })

        return True

    # ================= 2FA =================
    @staticmethod
    async def save_2fa_secret(user_id: str, secret: str):
        run_query('UPDATE users SET twoFactorSecret = ? WHERE id = ?', (secret, user_id))
        return await DatabaseService.get_user_by_id(user_id)

    @staticmethod
    async def set_2fa_status(user_id: str, enabled: bool):
        target_user = await DatabaseService.get_user_by_id(user_id)
        if not target_user:
            return None

        secret_val = target_user.get('twoFactorSecret') if enabled else None
        run_query('UPDATE users SET twoFactorEnabled = ?, twoFactorSecret = ? WHERE id = ?', (enabled, secret_val, user_id))

        await DatabaseService.log_audit({
            'action': '2FA_ENABLED' if enabled else '2FA_DISABLED',
            'actor': {'id': target_user['id'], 'username': target_user['username'], 'role': target_user['role'], 'name': target_user['fullName']},
            'input': {'twoFactorEnabled': enabled},
            'result': 'SUCCESS',
            'reason': 'Bật bảo mật xác thực 2 bước (2FA Google Authenticator) thành công' if enabled else 'Đã tắt xác thực 2 bước'
        })

        return await DatabaseService.get_user_by_id(user_id)

    # ================= REFRESH TOKENS =================
    @staticmethod
    async def save_refresh_token(user_id: str, token: str, expires_at: str):
        token_id = f"rt_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(3)}"
        now_iso = datetime.utcnow().isoformat() + 'Z'
        run_query("""
            INSERT INTO refresh_tokens (id, userId, token, expiresAt, createdAt)
            VALUES (?, ?, ?, ?, ?)
        """, (token_id, user_id, token, expires_at, now_iso))

    @staticmethod
    async def find_refresh_token(token: str):
        return get_one('SELECT * FROM refresh_tokens WHERE token = ?', (token,))

    @staticmethod
    async def get_refresh_token(token: str):
        return get_one('SELECT * FROM refresh_tokens WHERE token = ?', (token,))

    @staticmethod
    async def delete_refresh_token(token: str):
        return run_query('DELETE FROM refresh_tokens WHERE token = ?', (token,))

    @staticmethod
    async def revoke_all_user_refresh_tokens(user_id: str):
        return run_query('DELETE FROM refresh_tokens WHERE userId = ?', (user_id,))

    # ================= ACCESS TOKEN DENYLIST =================
    @staticmethod
    async def revoke_access_token(jti: str, expires_at: str):
        now_iso = datetime.utcnow().isoformat() + 'Z'
        run_query('DELETE FROM revoked_access_tokens WHERE expiresAt <= ?', (now_iso,))
        return run_query("""
            INSERT INTO revoked_access_tokens (jti, expiresAt, createdAt)
            VALUES (?, ?, ?)
            ON CONFLICT (jti) DO NOTHING
        """, (jti, expires_at, now_iso))

    @staticmethod
    async def is_access_token_revoked(jti: str):
        now_iso = datetime.utcnow().isoformat() + 'Z'
        return get_one(
            'SELECT jti FROM revoked_access_tokens WHERE jti = ? AND expiresAt > ?',
            (jti, now_iso)
        ) is not None

    # ================= EVIDENCE UPLOADS =================
    @staticmethod
    async def save_evidence_upload(data: dict):
        file_name = data.get('fileName')
        owner_id = data.get('ownerId')
        metadata = json.dumps(data.get('metadata', {}))
        ocr_data = json.dumps(data.get('ocrData')) if data.get('ocrData') else None
        ocr_provider = data.get('ocrProvider')
        # PostgreSQL BOOLEAN must receive a Python bool, not SQLite-style 0/1.
        ocr_is_live = bool(data.get('ocrIsLive'))
        now_iso = datetime.utcnow().isoformat() + 'Z'

        existing = get_one('SELECT fileName FROM evidence_uploads WHERE fileName = ?', (file_name,))
        if existing:
            run_query("""
                UPDATE evidence_uploads
                SET metadata = ?, ocrData = ?, ocrProvider = ?, ocrIsLive = ?
                WHERE fileName = ? AND ownerId = ?
            """, (metadata, ocr_data, ocr_provider, ocr_is_live, file_name, owner_id))
        else:
            run_query("""
                INSERT INTO evidence_uploads (fileName, ownerId, metadata, ocrData, ocrProvider, ocrIsLive, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (file_name, owner_id, metadata, ocr_data, ocr_provider, ocr_is_live, now_iso))

        return await DatabaseService.get_evidence_upload(file_name, owner_id)

    @staticmethod
    async def get_evidence_upload(file_name: str, owner_id: str):
        row = get_one('SELECT * FROM evidence_uploads WHERE fileName = ? AND ownerId = ?', (file_name, owner_id))
        if not row:
            return None
        res = dict(row)
        res['metadata'] = parse_json_field(row.get('metadata'), {})
        res['ocrData'] = parse_json_field(row.get('ocrData'), None)
        res['ocrIsLive'] = bool(row.get('ocrIsLive'))
        return res

    # ================= CASES =================
    @staticmethod
    async def get_cases(filter_dict: dict = None):
        if filter_dict is None:
            filter_dict = {}

        sql = 'SELECT * FROM cases WHERE 1=1'
        params = []

        if filter_dict.get('studentId'):
            sql += ' AND studentId = ?'
            params.append(filter_dict['studentId'])

        if filter_dict.get('status') and filter_dict['status'] != 'ALL':
            sql += ' AND status = ?'
            params.append(filter_dict['status'])

        if filter_dict.get('category') and filter_dict['category'] != 'ALL':
            sql += ' AND category = ?'
            params.append(filter_dict['category'])

        if filter_dict.get('department') and filter_dict['department'] != 'ALL':
            sql += ' AND assignedDepartment = ?'
            params.append(filter_dict['department'])

        sql += ' ORDER BY createdAt DESC'
        rows = get_all(sql, tuple(params))
        return [format_case_row(r) for r in rows]

    @staticmethod
    async def get_admin_dashboard_statistics(recent_cutoff: str):
        data = get_dashboard_statistics(recent_cutoff)
        data['recentCases'] = [format_case_row(case) for case in data.get('recentCases', [])]
        return data

    @staticmethod
    async def get_case_by_id(case_id: str):
        if not case_id:
            return None
        row = get_one('SELECT * FROM cases WHERE id = ?', (case_id,))
        return format_case_row(row)

    @staticmethod
    async def get_case_with_student(case_id: str):
        """Load a case and its owner in one indexed INNER JOIN."""
        if not case_id:
            return None, None
        row = get_one("""
            SELECT c.*, u.id AS joined_student_id, u.username AS joined_student_username,
                   u.fullName AS joined_student_full_name, u.studentCode AS joined_student_code,
                   u.department AS joined_student_department
            FROM cases c
            INNER JOIN users u ON u.id = c.studentId
            WHERE c.id = ?
        """, (case_id,))
        if not row:
            return None, None
        student = {
            'id': row.pop('joined_student_id', None),
            'username': row.pop('joined_student_username', None),
            'fullName': row.pop('joined_student_full_name', None),
            'studentCode': row.pop('joined_student_code', None),
            'department': row.pop('joined_student_department', None),
        }
        return format_case_row(row), student

    @staticmethod
    async def create_case(case_data: dict, actor: dict):
        student_user = await DatabaseService.get_user_by_id(actor.get('id'))
        student_code = actor.get('studentCode') or (student_user.get('studentCode') if student_user else None) or 'SV2026-9921'
        category = case_data.get('category') or 'GENERAL'
        assigned_dept = case_data.get('assignedDepartment') or DEPARTMENT_MAP.get(category, 'Phòng Công tác Sinh viên')
        deadline_date = case_data.get('deadline') or datetime.utcnow().isoformat() + 'Z'

        random_suffix = secrets.token_hex(3).upper()
        case_id = f"CASE-{datetime.now().year}-{str(int(datetime.now().timestamp() * 1000))[-4:]}{random_suffix}"
        created_at = datetime.utcnow().isoformat() + 'Z'
        updated_at = created_at

        digital_signature = None
        status = case_data.get('status', 'SUBMITTED')
        if status == 'APPROVED':
            sign_payload = f"{case_id}:{student_code}:{actor.get('fullName') or actor.get('username')}:APPROVED:{created_at}"
            digital_signature = hmac.new(get_signature_key().encode('utf-8'), sign_payload.encode('utf-8'), hashlib.sha256).hexdigest()

        ai_payload = {
            **(case_data.get('aiExtraction') or {}),
            'ruleEngine': case_data.get('ruleEngine'),
            'escalation': case_data.get('escalation')
        }

        run_query("""
            INSERT INTO cases (id, studentId, studentName, studentCode, title, category, priority, assignedDepartment, deadline, digitalSignature, description, status, reviewResult, supplementHistory, aiExtraction, evidenceFiles, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            case_id,
            actor.get('id'),
            actor.get('fullName') or actor.get('username'),
            student_code,
            case_data.get('title'),
            category,
            case_data.get('priority', 'MEDIUM'),
            assigned_dept,
            deadline_date,
            digital_signature,
            case_data.get('description', ''),
            status,
            json.dumps(case_data.get('reviewResult')) if case_data.get('reviewResult') else None,
            None,
            json.dumps(ai_payload),
            json.dumps(case_data.get('evidenceFiles', [])),
            created_at,
            updated_at
        ))

        created_case = await DatabaseService.get_case_by_id(case_id)

        audit_action = 'CASE_AUTO_APPROVED' if created_case['status'] == 'APPROVED' else ('CASE_ESCALATED' if case_data.get('escalation') else 'CASE_SUBMITTED')
        audit_reason = (
            f"[Rule Engine] Tự động phê duyệt hồ sơ #{created_case['id']} theo Quy chế Đào tạo"
            if created_case['status'] == 'APPROVED'
            else (
                f"[Rule Engine] Leo thang xét duyệt hồ sơ #{created_case['id']} do [{case_data.get('escalation', {}).get('reason')}]: {case_data.get('escalation', {}).get('explanation')}"
                if case_data.get('escalation')
                else f"Sinh viên đã tạo mới hồ sơ #{created_case['id']} (Điều phối: {created_case['assignedDepartment']})"
            )
        )

        await DatabaseService.log_audit({
            'action': audit_action,
            'actor': {'id': actor.get('id'), 'username': actor.get('username'), 'role': actor.get('role'), 'name': actor.get('fullName') or actor.get('username')},
            'caseId': created_case['id'],
            'input': {
                'title': created_case['title'],
                'category': created_case['category'],
                'priority': created_case['priority'],
                'status': created_case['status'],
                'escalationReason': case_data.get('escalation', {}).get('reason') if case_data.get('escalation') else None,
                'assignedDepartment': created_case['assignedDepartment']
            },
            'result': 'SUCCESS',
            'reason': audit_reason
        })

        # Tạo thông báo cho Reviewer & Admin
        staff_users = get_all("SELECT id FROM users WHERE role IN ('REVIEWER', 'ADMIN')")
        for staff in staff_users:
            await DatabaseService.create_notification({
                'userId': staff['id'],
                'title': f"Hồ sơ mới #{created_case['id']} cần thẩm định",
                'message': f"Sinh viên {created_case['studentName']} đã nộp: \"{created_case['title']}\" ({created_case['assignedDepartment']}).",
                'type': 'WARNING' if created_case['priority'] in ('HIGH', 'URGENT') else 'INFO',
                'caseId': created_case['id']
            })

        await bump_cache_version('cases')
        await bump_cache_version('admin-stats')
        return created_case

    @staticmethod
    async def update_case_status(case_id: str, status: str, actor: dict, reason: str = '', extra_fields: dict = None):
        if extra_fields is None:
            extra_fields = {}

        target_case = await DatabaseService.get_case_by_id(case_id)
        if not target_case:
            return None

        old_status = target_case['status']
        updated_at = datetime.utcnow().isoformat() + 'Z'

        review_result = extra_fields.get('reviewResult', target_case.get('reviewResult'))
        supplement_history = extra_fields.get('supplementHistory', target_case.get('supplementHistory'))
        evidence_files = extra_fields.get('evidenceFiles', target_case.get('evidenceFiles'))
        assigned_dept = extra_fields.get('assignedDepartment', target_case.get('assignedDepartment'))
        reviewer_feedback = extra_fields.get('reviewerFeedback', target_case.get('reviewerFeedback'))

        digital_signature = target_case.get('digitalSignature')
        if status == 'APPROVED':
            sign_payload = f"{target_case['id']}:{target_case.get('studentCode')}:{target_case.get('studentName')}:APPROVED:{updated_at}"
            digital_signature = hmac.new(get_signature_key().encode('utf-8'), sign_payload.encode('utf-8'), hashlib.sha256).hexdigest()

        run_query("""
            UPDATE cases SET status = ?, reviewResult = ?, supplementHistory = ?, evidenceFiles = ?, assignedDepartment = ?, digitalSignature = ?, reviewerFeedback = ?, updatedAt = ? WHERE id = ?
        """, (
            status,
            json.dumps(review_result) if review_result else None,
            json.dumps(supplement_history) if supplement_history else None,
            json.dumps(evidence_files) if evidence_files else None,
            assigned_dept,
            digital_signature,
            json.dumps(reviewer_feedback) if reviewer_feedback else None,
            updated_at,
            case_id
        ))

        updated_case = await DatabaseService.get_case_by_id(case_id)

        await DatabaseService.log_audit({
            'action': f"CASE_STATUS_{status}",
            'actor': {'id': actor.get('id'), 'username': actor.get('username'), 'role': actor.get('role'), 'name': actor.get('fullName') or actor.get('username')},
            'caseId': target_case['id'],
            'input': {'previousStatus': old_status, 'newStatus': status, 'assignedDepartment': updated_case['assignedDepartment']},
            'result': 'SUCCESS',
            'reason': reason or f"Cập nhật trạng thái hồ sơ từ {old_status} sang {status}"
        })

        if target_case.get('studentId'):
            status_title_map = {
                'APPROVED': '✅ Hồ sơ đã được PHÊ DUYỆT',
                'REJECTED': '❌ Hồ sơ đã bị TỪ CHỐI',
                'REQUIRES_SUPPLEMENT': '⚠️ Yêu cầu BỔ SUNG MINH CHỨNG',
                'UNDER_REVIEW': '🔍 Hồ sơ đang được xử lý',
                'STOPPED': '⛔ Tiến trình xử lý hồ sơ đã bị DỪNG'
            }
            await DatabaseService.create_notification({
                'userId': target_case['studentId'],
                'title': status_title_map.get(status, f"Cập nhật hồ sơ #{target_case['id']}"),
                'message': f"Ghi chú cán bộ: \"{reason}\"" if reason else f"Trạng thái hồ sơ của bạn hiện là {status}.",
                'type': 'SUCCESS' if status == 'APPROVED' else ('ERROR' if status == 'REJECTED' else 'WARNING'),
                'caseId': target_case['id']
            })

        await bump_cache_version('cases')
        await bump_cache_version('admin-stats')
        event = {'type': 'case_updated', 'case': updated_case}
        await case_event_hub.broadcast(event, roles={'REVIEWER', 'ADMIN'})
        if target_case.get('studentId'):
            await case_event_hub.broadcast(event, user_ids={target_case['studentId']})

        return updated_case

    # ================= VERIFICATION =================
    @staticmethod
    async def get_case_for_verification(case_id: str):
        c = await DatabaseService.get_case_by_id(case_id)
        if not c:
            return None

        stored_sig = c.get('digitalSignature')
        has_stored_sig = isinstance(stored_sig, str) and len(stored_sig) == 64 and all(ch in '0123456789abcdefABCDEF' for ch in stored_sig)
        
        verified = False
        if has_stored_sig and c.get('status') == 'APPROVED':
            expected_payload = f"{c['id']}:{c.get('studentCode')}:{c.get('studentName')}:APPROVED:{c.get('updatedAt')}"
            expected_sig = hmac.new(get_signature_key().encode('utf-8'), expected_payload.encode('utf-8'), hashlib.sha256).hexdigest()
            verified = hmac.compare_digest(expected_sig.lower(), stored_sig.lower())

        review = c.get('reviewResult') or {}

        return {
            'verified': verified,
            'caseId': c['id'],
            'studentName': c['studentName'],
            'studentCode': c.get('studentCode'),
            'title': c['title'],
            'category': c['category'],
            'status': c['status'],
            'assignedDepartment': c.get('assignedDepartment') or DEPARTMENT_MAP.get(c.get('category'), 'Trường Đại Học'),
            'submittedAt': c.get('createdAt'),
            'reviewedAt': review.get('reviewedAt') or c.get('updatedAt'),
            'reviewerName': review.get('reviewerName') or 'Hội đồng Thẩm định Tự động',
            'reviewerRole': review.get('reviewerRole') or 'SYSTEM_VERIFIED',
            'reviewerDepartment': review.get('reviewerDepartment') or c.get('assignedDepartment'),
            'digitalSignature': stored_sig if has_stored_sig else None,
            'decisionNote': (
                review.get('reason') or 'Chữ ký quyết định được xác thực hợp lệ.'
                if verified
                else 'Không xác thực được chứng nhận: hồ sơ chưa được duyệt hoặc chữ ký số không hợp lệ.'
            )
        }

    # ================= COMMENTS =================
    @staticmethod
    async def get_comments(case_id: str):
        rows = get_all('SELECT * FROM comments WHERE caseId = ? ORDER BY createdAt ASC', (case_id,))
        return rows

    @staticmethod
    async def get_case_with_comments(case_id: str):
        """Load the case required for access control and its comments in one LEFT JOIN."""
        if not case_id:
            return None, []
        rows = get_all("""
            SELECT c.*, cm.id AS comment_id, cm.caseId AS comment_case_id,
                   cm.authorId AS comment_author_id, cm.authorName AS comment_author_name,
                   cm.authorRole AS comment_author_role, cm.authorAvatar AS comment_author_avatar,
                   cm.content AS comment_content, cm.createdAt AS comment_created_at
            FROM cases c
            LEFT JOIN comments cm ON cm.caseId = c.id
            WHERE c.id = ?
            ORDER BY cm.createdAt ASC
        """, (case_id,))
        if not rows:
            return None, []

        comment_columns = {key for key in rows[0] if key.startswith('comment_')}
        case_row = {key: value for key, value in rows[0].items() if key not in comment_columns}
        comments = [
            {
                'id': row['comment_id'],
                'caseId': row['comment_case_id'],
                'authorId': row['comment_author_id'],
                'authorName': row['comment_author_name'],
                'authorRole': row['comment_author_role'],
                'authorAvatar': row['comment_author_avatar'],
                'content': row['comment_content'],
                'createdAt': row['comment_created_at'],
            }
            for row in rows if row.get('comment_id')
        ]
        return format_case_row(case_row), comments

    @staticmethod
    async def add_comment(case_id: str, author: dict, content: str, target_case: dict = None):
        target_case = target_case or await DatabaseService.get_case_by_id(case_id)
        if not target_case:
            return None

        comment_id = f"cmt_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(2)}"
        author_name = author.get('fullName') or author.get('username')
        created_at = datetime.utcnow().isoformat() + 'Z'

        run_query("""
            INSERT INTO comments (id, caseId, authorId, authorName, authorRole, authorAvatar, content, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (comment_id, case_id, author.get('id'), author_name, author.get('role'), author.get('avatar'), content.strip(), created_at))

        new_comment = {
            'id': comment_id,
            'caseId': case_id,
            'authorId': author.get('id'),
            'authorName': author_name,
            'authorRole': author.get('role'),
            'authorAvatar': author.get('avatar'),
            'content': content.strip(),
            'createdAt': created_at
        }

        await DatabaseService.log_audit({
            'action': 'CASE_COMMENT_ADDED',
            'actor': {'id': author.get('id'), 'username': author.get('username'), 'role': author.get('role'), 'name': author_name},
            'caseId': case_id,
            'input': {'commentId': comment_id, 'preview': content[:50]},
            'result': 'SUCCESS',
            'reason': f"{author_name} ({author.get('role')}) đã bình luận trên hồ sơ #{case_id}"
        })

        if author.get('role') == 'STUDENT':
            staff_users = get_all("SELECT id FROM users WHERE role IN ('REVIEWER', 'ADMIN')")
            for staff in staff_users:
                await DatabaseService.create_notification({
                    'userId': staff['id'],
                    'title': f"💬 Bình luận mới trên #{case_id}",
                    'message': f"Sinh viên {author_name}: \"{content[:80]}\"",
                    'type': 'INFO',
                    'caseId': case_id
                })
        else:
            if target_case.get('studentId') and target_case['studentId'] != author.get('id'):
                await DatabaseService.create_notification({
                    'userId': target_case['studentId'],
                    'title': f"💬 Cán bộ đã phản hồi trên hồ sơ #{case_id}",
                    'message': f"{author_name} ({author.get('role')}): \"{content[:80]}\"",
                    'type': 'INFO',
                    'caseId': case_id
                })

        return new_comment

    # ================= NOTIFICATIONS =================
    @staticmethod
    async def get_notifications(user_id: str):
        rows = get_all('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC', (user_id,))
        return rows

    @staticmethod
    async def create_notification(data: dict):
        notif_id = f"notif_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(2)}"
        now_iso = datetime.utcnow().isoformat() + 'Z'
        run_query("""
            INSERT INTO notifications (id, userId, title, message, type, caseId, isRead, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, FALSE, ?)
        """, (
            notif_id,
            data['userId'],
            data['title'],
            data['message'],
            data.get('type', 'INFO'),
            data.get('caseId'),
            now_iso
        ))
        notification = {
            'id': notif_id,
            'userId': data['userId'],
            'title': data['title'],
            'message': data['message'],
            'type': data.get('type', 'INFO'),
            'caseId': data.get('caseId'),
            'isRead': False,
            'createdAt': now_iso
        }
        await case_event_hub.broadcast({'type': 'notification_created', 'notification': notification}, user_ids={data['userId']})
        await bump_cache_version(f"notifications:{data['userId']}")
        return notification

    @staticmethod
    async def mark_notification_as_read(notif_id: str, user_id: str):
        res = run_query('UPDATE notifications SET isRead = TRUE WHERE id = ? AND userId = ?', (notif_id, user_id))
        if res['changes'] > 0:
            await bump_cache_version(f"notifications:{user_id}")
        return res['changes'] > 0

    @staticmethod
    async def mark_all_notifications_as_read(user_id: str):
        run_query('UPDATE notifications SET isRead = TRUE WHERE userId = ?', (user_id,))
        await bump_cache_version(f"notifications:{user_id}")
        return True

    # ================= AUDITS =================
    @staticmethod
    async def get_audits(filter_dict: dict = None):
        if filter_dict is None:
            filter_dict = {}

        sql = 'SELECT * FROM audits WHERE 1=1'
        params = []

        if filter_dict.get('action') and filter_dict['action'] != 'ALL':
            sql += ' AND action = ?'
            params.append(filter_dict['action'])

        if filter_dict.get('caseId'):
            sql += ' AND caseId = ?'
            params.append(filter_dict['caseId'])

        if filter_dict.get('actorRole') and filter_dict['actorRole'] != 'ALL':
            sql += ' AND actorRole = ?'
            params.append(filter_dict['actorRole'])

        if filter_dict.get('studentVisibleFor'):
            sv = filter_dict['studentVisibleFor']
            student_id = sv.get('studentId')
            case_ids = sv.get('caseIds', [])
            if case_ids:
                sql += " AND (caseId = ANY(?) OR (caseId IS NULL AND actorId = ?))"
                params.append(case_ids)
                params.append(student_id)
            else:
                sql += ' AND (caseId IS NULL AND actorId = ?)'
                params.append(student_id)
        elif filter_dict.get('actorId'):
            sql += ' AND actorId = ?'
            params.append(filter_dict['actorId'])

        if filter_dict.get('date'):
            sql += ' AND timestamp LIKE ?'
            params.append(f"{filter_dict['date']}%")

        sql += ' ORDER BY timestamp DESC'
        rows = get_all(sql, tuple(params))
        return [format_audit_row(r) for r in rows]

    @staticmethod
    async def get_audits_page(filter_dict: dict = None, page: int = 1, page_size: int = DEFAULT_AUDIT_PAGE_SIZE):
        """Return one audit page and its total without loading the full audit trail."""
        filter_dict = filter_dict or {}
        where = ' WHERE 1=1'
        params = []
        if filter_dict.get('action') and filter_dict['action'] != 'ALL':
            where += ' AND action = ?'; params.append(filter_dict['action'])
        if filter_dict.get('caseId'):
            where += ' AND caseId = ?'; params.append(filter_dict['caseId'])
        if filter_dict.get('actorRole') and filter_dict['actorRole'] != 'ALL':
            where += ' AND actorRole = ?'; params.append(filter_dict['actorRole'])
        if filter_dict.get('studentVisibleFor'):
            visible = filter_dict['studentVisibleFor']; case_ids = visible.get('caseIds', [])
            if case_ids:
                where += " AND (caseId = ANY(?) OR (caseId IS NULL AND actorId = ?))"
                params.append(case_ids); params.append(visible.get('studentId'))
            else:
                where += ' AND (caseId IS NULL AND actorId = ?)'; params.append(visible.get('studentId'))
        elif filter_dict.get('actorId'):
            where += ' AND actorId = ?'; params.append(filter_dict['actorId'])
        if filter_dict.get('date'):
            where += ' AND timestamp LIKE ?'; params.append(f"{filter_dict['date']}%")
        if filter_dict.get('dateFrom'):
            where += ' AND timestamp >= ?'; params.append(f"{filter_dict['dateFrom']}T00:00:00")
        if filter_dict.get('search'):
            term = f"%{filter_dict['search'].strip().lower()}%"
            where += " AND (LOWER(action) LIKE ? OR LOWER(COALESCE(caseId, '')) LIKE ? OR LOWER(COALESCE(actorName, '')) LIKE ? OR LOWER(COALESCE(actorUsername, '')) LIKE ? OR LOWER(COALESCE(reason, '')) LIKE ?)"
            params.extend([term] * 5)

        total = (get_one('SELECT COUNT(id) AS count FROM audits' + where, tuple(params)) or {}).get('count', 0)
        safe_page = max(1, int(page))
        safe_size = min(MAX_AUDIT_PAGE_SIZE, max(MIN_AUDIT_PAGE_SIZE, int(page_size)))
        total_pages = max(1, (total + safe_size - 1) // safe_size)
        safe_page = min(safe_page, total_pages)
        # The audit viewer never displays request payloads. Avoid transferring
        # potentially large JSON in inputData for every history row.
        rows = get_all('SELECT id, action, caseId, actorId, actorName, actorRole, actorUsername, result, reason, timestamp FROM audits' + where + ' ORDER BY timestamp DESC LIMIT ? OFFSET ?', tuple(params + [safe_size, (safe_page - 1) * safe_size]))
        return {'audits': [format_audit_row(row) for row in rows], 'total': total, 'page': safe_page, 'pageSize': safe_size, 'totalPages': total_pages, 'hasPrevious': safe_page > 1, 'hasNext': safe_page < total_pages}

    @staticmethod
    async def log_audit(data: dict):
        audit_id = f"AUDIT-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"
        timestamp = datetime.utcnow().isoformat() + 'Z'
        safe_actor = data.get('actor') or {'id': 'ANONYMOUS', 'username': 'guest', 'role': 'GUEST', 'name': 'Khách vãng lai'}

        input_data = data.get('input', {})
        input_json = json.dumps(input_data, ensure_ascii=False) if isinstance(input_data, (dict, list)) else (str(input_data) if input_data is not None else None)
        result_val = str(data.get('result', 'SUCCESS'))

        run_query("""
            INSERT INTO audits (id, action, caseId, actorId, actorName, actorRole, actorUsername, inputData, result, reason, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            audit_id,
            data.get('action'),
            data.get('caseId'),
            safe_actor.get('id'),
            safe_actor.get('name'),
            safe_actor.get('role'),
            safe_actor.get('username'),
            input_json,
            result_val,
            data.get('reason', ''),
            timestamp
        ))

        return {
            'id': audit_id,
            'timestamp': timestamp,
            'action': data.get('action'),
            'actor': safe_actor,
            'caseId': data.get('caseId'),
            'input': input_data,
            'result': result_val,
            'reason': data.get('reason', '')
        }


# Khởi tạo singleton db_service
db_service = DatabaseService()
