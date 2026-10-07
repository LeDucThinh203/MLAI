"""
============================================================================
CASEFLOW AI - DATABASE ENGINE (ENTERPRISE SQL SERVER & SQLITE DUAL SUPPORT)
============================================================================
Module quản lý cơ sở dữ liệu cho toàn bộ hệ thống CaseFlow AI:
  - Hỗ trợ Microsoft SQL Server 2022/2025 (Doanh nghiệp, Production)
  - Hỗ trợ SQLite (Nhẹ, Portable, Automated Test Suites)
============================================================================
"""

import os
import sys
import json
import sqlite3
import secrets
import bcrypt
from datetime import datetime
from typing import Optional, List, Dict, Any

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from app.config import (
    DB_TYPE,
    DB_SERVER,
    DB_NAME,
    DB_PORT,
    DB_TRUSTED_CONNECTION,
    DB_DRIVER,
    DB_TRUST_SERVER_CERTIFICATE,
    DB_ENCRYPT,
    DB_USER,
    DB_PASSWORD,
)

# Thử nạp pyodbc nếu có
try:
    import pyodbc
    HAS_PYODBC = True
except ImportError:
    pyodbc = None  # type: ignore
    HAS_PYODBC = False


# ==============================================================================
# 1. PATHS & CONFIGURATION HELPERS
# ==============================================================================

def get_db_path() -> str:
    data_dir = os.environ.get('DATA_DIR')
    if data_dir:
        if not os.path.exists(data_dir):
            os.makedirs(data_dir, exist_ok=True)
        return os.path.join(data_dir, 'caseflow.sqlite')
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, 'caseflow.sqlite')


DB_PATH = get_db_path()


def get_data_json_path() -> str:
    data_dir = os.environ.get('DATA_DIR')
    if data_dir and os.path.exists(os.path.join(data_dir, 'data.json')):
        return os.path.join(data_dir, 'data.json')
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, 'data.json')


DATA_JSON_PATH = get_data_json_path()


# ==============================================================================
# 2. CONNECTION MANAGERS
# ==============================================================================

def get_sqlite_connection() -> sqlite3.Connection:
    """Khởi tạo và trả về kết nối SQLite với WAL mode."""
    conn = sqlite3.connect(get_db_path(), timeout=30.0, check_same_thread=False)
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    conn.row_factory = sqlite3.Row
    return conn


def _get_best_odbc_driver() -> str:
    if not HAS_PYODBC or not pyodbc:
        return DB_DRIVER
    try:
        installed = pyodbc.drivers()
    except Exception:
        return DB_DRIVER
    candidates = [
        DB_DRIVER,
        'ODBC Driver 18 for SQL Server',
        'ODBC Driver 17 for SQL Server',
        'SQL Server Native Client 11.0',
        'SQL Server'
    ]
    for c in candidates:
        if c in installed:
            return c
    return DB_DRIVER


def get_mssql_connection():
    """Khởi tạo kết nối Microsoft SQL Server qua pyodbc."""
    if not HAS_PYODBC or not pyodbc:
        raise RuntimeError("Thư viện pyodbc chưa được cài đặt trong môi trường Python.")

    driver = _get_best_odbc_driver()
    if DB_TRUSTED_CONNECTION:
        conn_str = (
            f"DRIVER={{{driver}}};"
            f"SERVER={DB_SERVER};"
            f"DATABASE={DB_NAME};"
            f"Trusted_Connection=yes;"
            f"TrustServerCertificate={'yes' if DB_TRUST_SERVER_CERTIFICATE else 'no'};"
            f"Encrypt={'yes' if DB_ENCRYPT else 'no'};"
        )
    else:
        conn_str = (
            f"DRIVER={{{driver}}};"
            f"SERVER={DB_SERVER},{DB_PORT};"
            f"DATABASE={DB_NAME};"
            f"UID={DB_USER};"
            f"PWD={DB_PASSWORD};"
            f"TrustServerCertificate={'yes' if DB_TRUST_SERVER_CERTIFICATE else 'no'};"
            f"Encrypt={'yes' if DB_ENCRYPT else 'no'};"
        )
    return pyodbc.connect(conn_str, timeout=10)


# Quyết định Database Engine hoạt động (MSSQL hoặc SQLite)
# Nếu DATA_DIR được chỉ định (như khi chạy runner test bảo mật tạm thời), ưu tiên SQLite
def determine_active_engine() -> str:
    if os.environ.get('DATA_DIR'):
        return 'sqlite'
    if DB_TYPE == 'mssql' and HAS_PYODBC:
        try:
            conn = get_mssql_connection()
            conn.close()
            return 'mssql'
        except Exception as e:
            print(f"[Database Warning] Không thể kết nối SQL Server ({DB_SERVER}): {e}. Chuyển sang SQLite dự phòng.")
            return 'sqlite'
    return 'sqlite'


ACTIVE_ENGINE = determine_active_engine()


# ==============================================================================
# 3. QUERY EXECUTORS
# ==============================================================================

def run_query(sql: str, params: tuple = ()) -> Dict[str, Any]:
    """Thực thi câu lệnh SQL INSERT/UPDATE/DELETE và commit."""
    if ACTIVE_ENGINE == 'mssql':
        conn = get_mssql_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            conn.commit()
            rowcount = cursor.rowcount
            cursor.close()
            return {'lastrowid': None, 'changes': rowcount}
        finally:
            conn.close()
    else:
        conn = get_sqlite_connection()
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


def get_one(sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    """Lấy 1 bản ghi duy nhất dưới dạng dict."""
    if ACTIVE_ENGINE == 'mssql':
        conn = get_mssql_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            if not row:
                cursor.close()
                return None
            cols = [col[0] for col in cursor.description]
            cursor.close()
            return dict(zip(cols, row))
        finally:
            conn.close()
    else:
        conn = get_sqlite_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            cursor.close()
            return dict(row) if row else None
        finally:
            conn.close()


def get_all(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """Lấy danh sách tất cả các bản ghi thỏa mãn điều kiện dưới dạng list[dict]."""
    if ACTIVE_ENGINE == 'mssql':
        conn = get_mssql_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            if not rows:
                cursor.close()
                return []
            cols = [col[0] for col in cursor.description]
            cursor.close()
            return [dict(zip(cols, r)) for r in rows]
        finally:
            conn.close()
    else:
        conn = get_sqlite_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            cursor.close()
            return [dict(r) for r in rows]
        finally:
            conn.close()


# Đối tượng kết nối tương thích ngược
get_db_connection = get_sqlite_connection if ACTIVE_ENGINE == 'sqlite' else get_mssql_connection
db = get_db_connection()


# ==============================================================================
# 4. INITIALIZATION & SCHEMAS
# ==============================================================================

def init_database_mssql():
    """Khởi tạo bảng và dữ liệu trong Microsoft SQL Server."""
    conn = get_mssql_connection()
    cursor = conn.cursor()

    # Xử lý trường hợp bảng cũ Cases tồn tại
    cursor.execute("""
        IF OBJECT_ID(N'dbo.Cases', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.legacy_Cases', N'U') IS NULL
        BEGIN
            EXEC sp_rename 'dbo.Cases', 'legacy_Cases';
        END
    """)
    conn.commit()

    # 1. users
    cursor.execute("""
        IF OBJECT_ID(N'dbo.users', N'U') IS NULL
        CREATE TABLE dbo.users (
            id NVARCHAR(100) PRIMARY KEY,
            username NVARCHAR(100) UNIQUE NOT NULL,
            password NVARCHAR(255) NOT NULL,
            fullName NVARCHAR(255) NOT NULL,
            studentCode NVARCHAR(100),
            email NVARCHAR(255),
            role NVARCHAR(50) NOT NULL,
            department NVARCHAR(255),
            avatar NVARCHAR(MAX),
            bio NVARCHAR(MAX),
            twoFactorEnabled INT DEFAULT 0,
            twoFactorSecret NVARCHAR(255),
            mustChangePassword INT DEFAULT 0,
            createdAt NVARCHAR(100),
            updatedAt NVARCHAR(100)
        );
    """)

    # 2. cases
    cursor.execute("""
        IF OBJECT_ID(N'dbo.cases', N'U') IS NULL
        CREATE TABLE dbo.cases (
            id NVARCHAR(100) PRIMARY KEY,
            studentId NVARCHAR(100) NOT NULL,
            studentName NVARCHAR(255) NOT NULL,
            studentCode NVARCHAR(100),
            title NVARCHAR(500) NOT NULL,
            category NVARCHAR(100) NOT NULL,
            priority NVARCHAR(50) DEFAULT 'MEDIUM',
            description NVARCHAR(MAX),
            status NVARCHAR(50) NOT NULL,
            reviewResult NVARCHAR(MAX),
            supplementHistory NVARCHAR(MAX),
            aiExtraction NVARCHAR(MAX),
            evidenceFiles NVARCHAR(MAX),
            deadline NVARCHAR(100),
            assignedDepartment NVARCHAR(255),
            digitalSignature NVARCHAR(MAX),
            createdAt NVARCHAR(100),
            updatedAt NVARCHAR(100),
            CONSTRAINT FK_cases_users FOREIGN KEY (studentId) REFERENCES dbo.users(id)
        );
    """)

    # 3. audits
    cursor.execute("""
        IF OBJECT_ID(N'dbo.audits', N'U') IS NULL
        CREATE TABLE dbo.audits (
            id NVARCHAR(100) PRIMARY KEY,
            action NVARCHAR(100) NOT NULL,
            caseId NVARCHAR(100),
            actorId NVARCHAR(100),
            actorName NVARCHAR(255),
            actorRole NVARCHAR(50),
            actorUsername NVARCHAR(100),
            reason NVARCHAR(MAX),
            timestamp NVARCHAR(100)
        );
    """)

    # 4. comments
    cursor.execute("""
        IF OBJECT_ID(N'dbo.comments', N'U') IS NULL
        CREATE TABLE dbo.comments (
            id NVARCHAR(100) PRIMARY KEY,
            caseId NVARCHAR(100) NOT NULL,
            authorId NVARCHAR(100) NOT NULL,
            authorName NVARCHAR(255) NOT NULL,
            authorRole NVARCHAR(50) NOT NULL,
            authorAvatar NVARCHAR(MAX),
            content NVARCHAR(MAX) NOT NULL,
            createdAt NVARCHAR(100) NOT NULL,
            CONSTRAINT FK_comments_cases FOREIGN KEY (caseId) REFERENCES dbo.cases(id)
        );
    """)

    # 5. notifications
    cursor.execute("""
        IF OBJECT_ID(N'dbo.notifications', N'U') IS NULL
        CREATE TABLE dbo.notifications (
            id NVARCHAR(100) PRIMARY KEY,
            userId NVARCHAR(100) NOT NULL,
            title NVARCHAR(255) NOT NULL,
            message NVARCHAR(MAX) NOT NULL,
            type NVARCHAR(50) DEFAULT 'INFO',
            caseId NVARCHAR(100),
            isRead INT DEFAULT 0,
            createdAt NVARCHAR(100) NOT NULL,
            CONSTRAINT FK_notifications_users FOREIGN KEY (userId) REFERENCES dbo.users(id)
        );
    """)

    # 6. refresh_tokens
    cursor.execute("""
        IF OBJECT_ID(N'dbo.refresh_tokens', N'U') IS NULL
        CREATE TABLE dbo.refresh_tokens (
            id NVARCHAR(100) PRIMARY KEY,
            userId NVARCHAR(100) NOT NULL,
            token NVARCHAR(255) UNIQUE NOT NULL,
            expiresAt NVARCHAR(100) NOT NULL,
            createdAt NVARCHAR(100) NOT NULL,
            CONSTRAINT FK_refresh_tokens_users FOREIGN KEY (userId) REFERENCES dbo.users(id)
        );
    """)

    # 7. evidence_uploads
    cursor.execute("""
        IF OBJECT_ID(N'dbo.evidence_uploads', N'U') IS NULL
        CREATE TABLE dbo.evidence_uploads (
            fileName NVARCHAR(255) PRIMARY KEY,
            ownerId NVARCHAR(100) NOT NULL,
            metadata NVARCHAR(MAX) NOT NULL,
            ocrData NVARCHAR(MAX),
            ocrProvider NVARCHAR(100),
            ocrIsLive INT NOT NULL DEFAULT 0,
            createdAt NVARCHAR(100) NOT NULL,
            CONSTRAINT FK_evidence_uploads_users FOREIGN KEY (ownerId) REFERENCES dbo.users(id)
        );
    """)
    conn.commit()

    # Kiểm tra số lượng người dùng trong SQL Server
    cursor.execute("SELECT COUNT(*) FROM dbo.users")
    user_count = cursor.fetchone()[0]

    # Nếu bảng trống và có file SQLite, tự động đồng bộ từ SQLite sang SQL Server
    sqlite_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'caseflow.sqlite')
    if user_count == 0 and os.path.exists(sqlite_file):
        try:
            s_conn = sqlite3.connect(sqlite_file)
            s_conn.row_factory = sqlite3.Row
            s_cur = s_conn.cursor()

            s_cur.execute("SELECT * FROM users")
            for u in s_cur.fetchall():
                cursor.execute("""
                    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = ?)
                    INSERT INTO dbo.users (id, username, password, fullName, studentCode, email, role, department, avatar, bio, twoFactorEnabled, twoFactorSecret, mustChangePassword, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    u['id'], u['id'], u['username'], u['password'], u['fullName'], u['studentCode'], u['email'],
                    u['role'], u['department'], u['avatar'], u['bio'],
                    int(u['twoFactorEnabled'] or 0), u['twoFactorSecret'], int(u['mustChangePassword'] or 0),
                    u['createdAt'], u['updatedAt']
                ))

            s_cur.execute("SELECT * FROM cases")
            for c in s_cur.fetchall():
                cursor.execute("""
                    IF NOT EXISTS (SELECT 1 FROM dbo.cases WHERE id = ?)
                    INSERT INTO dbo.cases (id, studentId, studentName, studentCode, title, category, priority, description, status, reviewResult, supplementHistory, aiExtraction, evidenceFiles, deadline, assignedDepartment, digitalSignature, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    c['id'], c['id'], c['studentId'], c['studentName'], c['studentCode'], c['title'], c['category'],
                    c['priority'], c['description'], c['status'], c['reviewResult'], c['supplementHistory'],
                    c['aiExtraction'], c['evidenceFiles'], c['deadline'], c['assignedDepartment'],
                    c['digitalSignature'], c['createdAt'], c['updatedAt']
                ))

            conn.commit()
            s_conn.close()
            print("[Database Sync] Đã đồng bộ toàn bộ tài khoản và hồ sơ học vụ từ SQLite vào SQL Server thành công!")
        except Exception as e:
            print(f"[Database Sync] Lỗi đồng bộ SQLite -> MSSQL: {e}")

    cursor.close()
    conn.close()
    print(f"[Database] Microsoft SQL Server kết nối thành công: {DB_SERVER} -> CSDL [{DB_NAME}]")


def init_database_sqlite():
    """Khởi tạo cấu trúc bảng SQLite."""
    conn = get_sqlite_connection()
    cursor = conn.cursor()

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

    cursor.execute("SELECT COUNT(*) as count FROM users")
    user_count = cursor.fetchone()['count']
    if user_count == 0 and os.path.exists(DATA_JSON_PATH):
        try:
            with open(DATA_JSON_PATH, 'r', encoding='utf-8') as f:
                raw = json.load(f)
            if 'users' in raw:
                for u in raw['users']:
                    raw_pass = u.get('password', 'password123')
                    hashed_pass = raw_pass if (raw_pass.startswith('$2a$') or raw_pass.startswith('$2b$')) else bcrypt.hashpw(raw_pass.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                    now_iso = datetime.utcnow().isoformat() + 'Z'
                    cursor.execute("""
                        INSERT OR REPLACE INTO users (id, username, password, fullName, studentCode, email, role, department, avatar, twoFactorEnabled, twoFactorSecret, mustChangePassword, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        u['id'], u['username'], hashed_pass, u['fullName'], u.get('studentCode'),
                        u.get('email', f"{u['username']}@caseflow.ai"), u['role'],
                        u.get('department', 'Trường Đại Học'),
                        u.get('avatar', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'),
                        1 if u.get('twoFactorEnabled') else 0, u.get('twoFactorSecret'), 0,
                        u.get('createdAt', now_iso), u.get('updatedAt', now_iso)
                    ))
            conn.commit()
        except Exception as e:
            print(f"[Database Seed] Lỗi nạp data.json: {e}")

    cursor.close()
    conn.close()
    print(f"[Database] SQLite Database kết nối thành công tại: {get_db_path()}")


def init_database():
    """Khởi tạo cơ sở dữ liệu theo Database Engine đang kích hoạt."""
    if ACTIVE_ENGINE == 'mssql':
        init_database_mssql()
    else:
        init_database_sqlite()


# Tự động kích hoạt khi nạp module
init_database()
