"""
============================================================================
CASEFLOW AI - DATABASE SERVICE (PYTHON SQLITE MODULE)
============================================================================
Module quản lý cơ sở dữ liệu SQLite duy nhất (Single Source of Truth) cho
toàn bộ hệ thống CaseFlow AI.
============================================================================
"""

import os
import sys

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import json
import sqlite3
import secrets
import bcrypt
from datetime import datetime

def get_db_path():
    base_dir = os.environ.get('DATA_DIR', os.path.dirname(os.path.abspath(__file__)))
    if not os.path.exists(base_dir):
        os.makedirs(base_dir, exist_ok=True)
    return os.path.join(base_dir, 'caseflow.sqlite')

DB_PATH = get_db_path()

def get_data_json_path():
    data_dir = os.environ.get('DATA_DIR')
    if data_dir and os.path.exists(os.path.join(data_dir, 'data.json')):
        return os.path.join(data_dir, 'data.json')
    shared_data = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.json')
    if os.path.exists(shared_data):
        return shared_data
    root_data = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data.json')
    if os.path.exists(root_data):
        return root_data
    return shared_data

DATA_JSON_PATH = get_data_json_path()


def get_db_connection():
    """Khởi tạo và trả về kết nối SQLite với row_factory dạng sqlite3.Row."""
    conn = sqlite3.connect(get_db_path(), timeout=30.0, check_same_thread=False)
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    conn.row_factory = sqlite3.Row
    return conn


# Đối tượng kết nối chính
db = get_db_connection()


def run_query(sql, params=()):
    """Thực thi câu lệnh SQL INSERT/UPDATE/DELETE và commit."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        last_id = cursor.lastrowid
        rowcount = cursor.rowcount
        cursor.close()
        return {'lastrowid': last_id, 'changes': rowcount}
    finally:
        conn.close()


def get_one(sql, params=()):
    """Lấy 1 bản ghi duy nhất."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        row = cursor.fetchone()
        cursor.close()
        return dict(row) if row else None
    finally:
        conn.close()


def get_all(sql, params=()):
    """Lấy danh sách tất cả các bản ghi thỏa mãn điều kiện."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        cursor.close()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def init_database():
    """
    Khởi tạo cấu trúc bảng Relational Schemas và thực hiện Data Migration
    an toàn từ data.json (nếu có) hoặc tạo Admin mặc định bảo mật.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Bảng Users (Người dùng & Phân quyền)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            fullName TEXT NOT NULL,
            studentCode TEXT,
            email TEXT,
            role TEXT NOT NULL,
            department TEXT,
            avatar TEXT,
            bio TEXT,
            twoFactorEnabled INTEGER DEFAULT 0,
            twoFactorSecret TEXT,
            mustChangePassword INTEGER DEFAULT 0,
            createdAt TEXT,
            updatedAt TEXT
        )
    """)

    # 2. Bảng Cases (Hồ sơ học vụ)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cases (
            id TEXT PRIMARY KEY,
            studentId TEXT NOT NULL,
            studentName TEXT NOT NULL,
            studentCode TEXT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            priority TEXT DEFAULT 'MEDIUM',
            description TEXT,
            status TEXT NOT NULL,
            reviewResult TEXT,
            supplementHistory TEXT,
            aiExtraction TEXT,
            evidenceFiles TEXT,
            deadline TEXT,
            assignedDepartment TEXT,
            digitalSignature TEXT,
            createdAt TEXT,
            updatedAt TEXT,
            FOREIGN KEY (studentId) REFERENCES users(id)
        )
    """)

    # 3. Bảng Audits (Nhật ký kiểm toán)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audits (
            id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            caseId TEXT,
            actorId TEXT,
            actorName TEXT,
            actorRole TEXT,
            actorUsername TEXT,
            reason TEXT,
            timestamp TEXT
        )
    """)

    # 4. Bảng Comments (Bình luận & Phản hồi)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            caseId TEXT NOT NULL,
            authorId TEXT NOT NULL,
            authorName TEXT NOT NULL,
            authorRole TEXT NOT NULL,
            authorAvatar TEXT,
            content TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (caseId) REFERENCES cases(id)
        )
    """)

    # 5. Bảng Notifications (Thông báo)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'INFO',
            caseId TEXT,
            isRead INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id)
        )
    """)

    # 6. Bảng Refresh Tokens (Xác thực & Xoay vòng Token)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expiresAt TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id)
        )
    """)

    # 7. Bảng Evidence Uploads (Quản lý quyền sở hữu & OCR minh chứng)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS evidence_uploads (
            fileName TEXT PRIMARY KEY,
            ownerId TEXT NOT NULL,
            metadata TEXT NOT NULL,
            ocrData TEXT,
            ocrProvider TEXT,
            ocrIsLive INTEGER NOT NULL DEFAULT 0,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (ownerId) REFERENCES users(id)
        )
    """)

    conn.commit()

    # Kiểm tra số lượng người dùng
    cursor.execute("SELECT COUNT(*) as count FROM users")
    user_count = cursor.fetchone()['count']
    is_prod = os.environ.get('NODE_ENV') == 'production' or os.environ.get('ENV') == 'production'

    if user_count == 0:
        if is_prod:
            # Chế độ Production: Tạo tài khoản Admin ngẫu nhiên an toàn
            initial_admin_password = secrets.token_hex(12)
            hashed_admin_password = bcrypt.hashpw(initial_admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            admin_id = f"admin-root-{int(datetime.now().timestamp() * 1000)}"
            now_iso = datetime.utcnow().isoformat() + 'Z'

            cursor.execute("""
                INSERT INTO users (id, username, password, fullName, studentCode, email, role, department, avatar, twoFactorEnabled, twoFactorSecret, mustChangePassword, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                admin_id,
                'admin',
                hashed_admin_password,
                'Super Administrator',
                None,
                'admin@caseflow.ai',
                'ADMIN',
                'Ban Giám Hiệu & Quản Trị Hệ Thống',
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                0,
                None,
                1,
                now_iso,
                now_iso
            ))
            conn.commit()
            print(f"""
╔══════════════════════════════════════════════════════════════════════════╗
║  🔑 INITIAL ADMIN CREDENTIALS GENERATED (PRODUCTION SECURE MODE)         ║
╠══════════════════════════════════════════════════════════════════════════╣
║  • Username : admin                                                      ║
║  • Password : {initial_admin_password}                               ║
║  • Notice   : mustChangePassword=1 đã kích hoạt. Đổi MK sau đăng nhập!   ║
╚══════════════════════════════════════════════════════════════════════════╝
""")
        elif os.path.exists(DATA_JSON_PATH):
            try:
                with open(DATA_JSON_PATH, 'r', encoding='utf-8') as f:
                    raw = json.load(f)

                if 'users' in raw:
                    for u in raw['users']:
                        raw_pass = u.get('password', 'password123')
                        if raw_pass.startswith('$2a$') or raw_pass.startswith('$2b$'):
                            hashed_pass = raw_pass
                        else:
                            hashed_pass = bcrypt.hashpw(raw_pass.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

                        now_iso = datetime.utcnow().isoformat() + 'Z'
                        cursor.execute("""
                            INSERT OR REPLACE INTO users (id, username, password, fullName, studentCode, email, role, department, avatar, twoFactorEnabled, twoFactorSecret, mustChangePassword, createdAt, updatedAt)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            u['id'],
                            u['username'],
                            hashed_pass,
                            u['fullName'],
                            u.get('studentCode'),
                            u.get('email', f"{u['username']}@caseflow.ai"),
                            u['role'],
                            u.get('department', 'Trường Đại Học'),
                            u.get('avatar', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'),
                            1 if u.get('twoFactorEnabled') else 0,
                            u.get('twoFactorSecret'),
                            0,
                            u.get('createdAt', now_iso),
                            u.get('updatedAt', now_iso)
                        ))

                if 'cases' in raw:
                    for c in raw['cases']:
                        now_iso = datetime.utcnow().isoformat() + 'Z'
                        cursor.execute("""
                            INSERT OR REPLACE INTO cases (id, studentId, studentName, studentCode, title, category, priority, description, status, reviewResult, supplementHistory, aiExtraction, evidenceFiles, deadline, assignedDepartment, digitalSignature, createdAt, updatedAt)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            c['id'],
                            c['studentId'],
                            c['studentName'],
                            c.get('studentCode'),
                            c['title'],
                            c['category'],
                            c.get('priority', 'MEDIUM'),
                            c.get('description', ''),
                            c['status'],
                            json.dumps(c.get('reviewResult')) if c.get('reviewResult') else None,
                            json.dumps(c.get('supplementHistory')) if c.get('supplementHistory') else None,
                            json.dumps(c.get('aiExtraction')) if c.get('aiExtraction') else None,
                            json.dumps(c.get('evidenceFiles')) if c.get('evidenceFiles') else None,
                            c.get('deadline'),
                            c.get('assignedDepartment'),
                            c.get('digitalSignature'),
                            c.get('createdAt', now_iso),
                            c.get('updatedAt', now_iso)
                        ))

                if 'audits' in raw:
                    for a in raw['audits']:
                        now_iso = datetime.utcnow().isoformat() + 'Z'
                        actor = a.get('actor', {})
                        cursor.execute("""
                            INSERT OR REPLACE INTO audits (id, action, caseId, actorId, actorName, actorRole, actorUsername, reason, timestamp)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            a.get('id', f"aud_{int(datetime.now().timestamp() * 1000)}"),
                            a['action'],
                            a.get('caseId'),
                            actor.get('id'),
                            actor.get('name'),
                            actor.get('role'),
                            actor.get('username'),
                            a.get('reason', ''),
                            a.get('timestamp', now_iso)
                        ))

                conn.commit()
                print('[Database Migration] Hoàn tất nạp dữ liệu môi trường phát triển thành công!')
            except Exception as e:
                print(f'[Database Migration] Lỗi di chuyển dữ liệu: {e}')
                raise e

    # Quét và băm bcrypt mật khẩu thô còn sót
    cursor.execute("SELECT id, password FROM users")
    all_users = cursor.fetchall()
    for u in all_users:
        pwd = u['password']
        if pwd and not (pwd.startswith('$2a$') or pwd.startswith('$2b$')):
            hashed = bcrypt.hashpw(pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cursor.execute("UPDATE users SET password = ? WHERE id = ?", (hashed, u['id']))
    conn.commit()

    # Quét và liên kết quyền sở hữu minh chứng
    upload_dir = os.path.join(os.environ.get('DATA_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')), 'uploads')
    cursor.execute("SELECT studentId, evidenceFiles FROM cases")
    existing_cases = cursor.fetchall()
    for c in existing_cases:
        try:
            ev_files = json.loads(c['evidenceFiles']) if c['evidenceFiles'] else []
        except Exception:
            continue
        for file_item in ev_files:
            file_name = file_item.get('fileName') or (file_item.get('fileUrl', '').split('?')[0].split('/')[-1])
            if not file_name or not os.path.exists(os.path.join(upload_dir, file_name)):
                continue
            cursor.execute("""
                INSERT OR IGNORE INTO evidence_uploads (fileName, ownerId, metadata, ocrData, ocrProvider, ocrIsLive, createdAt)
                VALUES (?, ?, ?, NULL, NULL, 0, ?)
            """, (
                file_name,
                c['studentId'],
                json.dumps(file_item.get('metadata', {})),
                datetime.utcnow().isoformat() + 'Z'
            ))
    print(f"[Database] SQLite Database kết nối thành công tại: {get_db_path()}")


# Tự động khởi tạo cấu trúc CSDL
init_database()
