"""PostgreSQL persistence layer with a bounded application connection pool."""
import json
import os
import re
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse
import bcrypt
from app.config import (
    DATABASE_URL,
    DB_POOL_MAX_IDLE_SECONDS,
    DB_POOL_MAX_SIZE,
    DB_POOL_MIN_SIZE,
    DB_POOL_TIMEOUT_SECONDS,
    SEED_DEMO_DATA,
)

try:
    from psycopg.rows import dict_row  # type: ignore
except ImportError:
    dict_row = None

try:
    from psycopg_pool import ConnectionPool  # type: ignore
except ImportError:
    ConnectionPool = None  # type: ignore[assignment,misc]

_connection_pool = None
_connection_pool_lock = threading.Lock()
_database_host = urlparse(DATABASE_URL).hostname if DATABASE_URL else None
DB_SERVER = "Neon PostgreSQL" if _database_host and _database_host.endswith(".neon.tech") else "PostgreSQL"
ACTIVE_ENGINE = DB_SERVER
DB_NAME = "eduassistant_db"

_KEYS = {
    "fullname": "fullName", "studentid": "studentId", "studentname": "studentName",
    "studentcode": "studentCode", "twofactorenabled": "twoFactorEnabled",
    "twofactorsecret": "twoFactorSecret", "mustchangepassword": "mustChangePassword",
    "reviewresult": "reviewResult", "supplementhistory": "supplementHistory",
    "aiextraction": "aiExtraction", "evidencefiles": "evidenceFiles",
    "assigneddepartment": "assignedDepartment", "digitalsignature": "digitalSignature",
    "reviewerfeedback": "reviewerFeedback", "createdat": "createdAt", "updatedat": "updatedAt",
    "caseid": "caseId", "actorid": "actorId", "actorname": "actorName",
    "actorrole": "actorRole", "actorusername": "actorUsername", "inputdata": "inputData",
    "authorid": "authorId", "authorname": "authorName", "authorrole": "authorRole",
    "authoravatar": "authorAvatar", "userid": "userId", "isread": "isRead",
    "expiresat": "expiresAt", "filename": "fileName", "ownerid": "ownerId",
    "ocrdata": "ocrData", "ocrprovider": "ocrProvider", "ocrlive": "ocrIsLive",
    "ocrislive": "ocrIsLive", "studentclaim": "studentClaim",
    "institutionalfacts": "institutionalFacts", "addressanalysis": "addressAnalysis",
    "academicstatus": "academicStatus", "coursestartdate": "courseStartDate",
    "courseenddate": "courseEndDate", "currenttermactive": "currentTermActive",
    "hascurrentschedule": "hasCurrentSchedule", "registeredpermanentaddress": "registeredPermanentAddress",
    "faculty": "faculty", "recordstatus": "recordStatus", "updatedby": "updatedBy",
    "sourcetype": "sourceType", "verificationstatus": "verificationStatus",
    "verifiedby": "verifiedBy", "verifiedat": "verifiedAt",
    "currentthreshold": "currentThreshold", "minthreshold": "minThreshold",
    "maxthreshold": "maxThreshold", "stepsize": "stepSize",
    "oldthreshold": "oldThreshold", "newthreshold": "newThreshold",
    "reviewerid": "reviewerId", "reviewername": "reviewerName",
    "feedbacktype": "feedbackType"
}


def _url():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is required for PostgreSQL.")
    if _database_host and _database_host.endswith(".neon.tech") and "-pooler." not in _database_host:
        raise RuntimeError("DATABASE_URL must use Neon's pooled endpoint (hostname containing -pooler).")
    return DATABASE_URL


def get_db_connection():
    """Borrow a PostgreSQL connection from the connection pool."""
    global _connection_pool
    if ConnectionPool is None or dict_row is None:
        raise RuntimeError("psycopg and psycopg-pool are required; install backend requirements.")
    if _connection_pool is None:
        with _connection_pool_lock:
            if _connection_pool is None:
                _connection_pool = ConnectionPool(
                    conninfo=_url(),
                    min_size=DB_POOL_MIN_SIZE,
                    max_size=DB_POOL_MAX_SIZE,
                    max_idle=DB_POOL_MAX_IDLE_SECONDS,
                    timeout=DB_POOL_TIMEOUT_SECONDS,
                    kwargs={"row_factory": dict_row, "connect_timeout": 8},
                    open=True,
                )
    pool = _connection_pool
    return pool.connection(timeout=DB_POOL_TIMEOUT_SECONDS)


def close_database_pool() -> None:
    global _connection_pool
    with _connection_pool_lock:
        if _connection_pool is not None:
            _connection_pool.close()
            _connection_pool = None


def _sql(sql: str) -> str:
    return re.sub(r"\?", "%s", sql)


def _row(row):
    if row is None:
        return None
    d = dict(row) if hasattr(row, 'keys') else row
    return {_KEYS.get(k.lower(), k): v for k, v in d.items()}


def run_query(sql: str, params: tuple = ()) -> Dict[str, Any]:
    with get_db_connection() as c, c.cursor() as q:
        q.execute(_sql(sql), params)
        return {"lastrowid": None, "changes": q.rowcount}


def get_one(sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    with get_db_connection() as c, c.cursor() as q:
        q.execute(_sql(sql), params)
        return _row(q.fetchone())


def get_all(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    with get_db_connection() as c, c.cursor() as q:
        q.execute(_sql(sql), params)
        return [_row(x) for x in q.fetchall()]


def get_dashboard_statistics(recent_cutoff: str) -> Dict[str, Any]:
    """Fetch all dashboard metrics in one database round trip."""
    json_case = "COALESCE(NULLIF(aiExtraction, ''), '{}')::jsonb"
    json_audit = "COALESCE(NULLIF(inputData, ''), '{}')::jsonb"
    escalation_reason = (
        f"COALESCE(NULLIF({json_case} -> 'escalation' ->> 'reason', ''), "
        f"NULLIF({json_case} -> 'ruleEngine' ->> 'escalationReason', ''))"
    )

    sql = f"""
        WITH role_counts AS (
            SELECT role, COUNT(id) AS count FROM users GROUP BY role
        ),
        status_counts AS (
            SELECT status, COUNT(id) AS count FROM cases GROUP BY status
        ),
        category_counts AS (
            SELECT category, COUNT(id) AS count FROM cases GROUP BY category
        ),
        priority_counts AS (
            SELECT COALESCE(priority, 'MEDIUM') AS priority, COUNT(id) AS count
            FROM cases GROUP BY COALESCE(priority, 'MEDIUM')
        ),
        escalation_counts AS (
            SELECT {escalation_reason} AS reason, COUNT(id) AS count
            FROM cases
            WHERE {escalation_reason} IS NOT NULL
            GROUP BY {escalation_reason}
        ),
        recent_cases AS (
            SELECT * FROM cases ORDER BY createdAt DESC LIMIT 5
        )
        SELECT
            jsonb_build_object('total_users', (SELECT COUNT(id) FROM users)) AS users,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('role', role, 'count', count) ORDER BY role) FROM role_counts), '[]'::jsonb) AS roles,
            (SELECT jsonb_build_object(
                'total_cases', COUNT(id),
                'today_cases_count', COUNT(id) FILTER (WHERE createdAt >= %s),
                'pending_cases', COUNT(id) FILTER (WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED')),
                'approved_cases', COUNT(id) FILTER (WHERE status = 'APPROVED'),
                'rejected_cases', COUNT(id) FILTER (WHERE status = 'REJECTED'),
                'auto_approved_cases', COUNT(id) FILTER (WHERE {json_case} -> 'ruleEngine' ->> 'decision' = 'AUTO_APPROVE'),
                'escalated_cases', COUNT(id) FILTER (WHERE {json_case} -> 'ruleEngine' ->> 'decision' = 'ESCALATE_TO_HUMAN' OR {escalation_reason} IS NOT NULL)
            ) FROM cases) AS cases,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('status', status, 'count', count) ORDER BY status) FROM status_counts), '[]'::jsonb) AS statuses,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('category', category, 'count', count) ORDER BY category) FROM category_counts), '[]'::jsonb) AS categories,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('priority', priority, 'count', count) ORDER BY priority) FROM priority_counts), '[]'::jsonb) AS priorities,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('reason', reason, 'count', count) ORDER BY reason) FROM escalation_counts), '[]'::jsonb) AS escalations,
            COALESCE((SELECT jsonb_agg(to_jsonb(recent_cases)) FROM recent_cases), '[]'::jsonb) AS "recentCases",
            (SELECT jsonb_build_object(
                'total_audits', COUNT(id),
                'total_human_overrides', COUNT(id) FILTER (WHERE action = 'HUMAN_OVERRIDE'),
                'total_reviewer_feedback', COUNT(id) FILTER (WHERE action = 'REVIEWER_FEEDBACK_SUBMITTED'),
                'missed_escalation_feedback_count', COUNT(id) FILTER (WHERE action = 'REVIEWER_FEEDBACK_SUBMITTED' AND {json_audit} ->> 'feedbackType' = 'MISSED_ESCALATION'),
                'unnecessary_escalation_feedback_count', COUNT(id) FILTER (WHERE action = 'REVIEWER_FEEDBACK_SUBMITTED' AND {json_audit} ->> 'feedbackType' = 'UNNECESSARY_ESCALATION'),
                'correct_feedback_count', COUNT(id) FILTER (WHERE action = 'REVIEWER_FEEDBACK_SUBMITTED' AND {json_audit} ->> 'feedbackType' = 'CORRECT')
            ) FROM audits) AS audits
    """

    with get_db_connection() as c, c.cursor() as q:
        q.execute(sql, (recent_cutoff,))
        data = _row(q.fetchone()) or {}

    data['recentCases'] = [_row(row) for row in data.get('recentCases', [])]
    return data


def init_database():
    """Initialize PostgreSQL tables, indexes, and initial users for NVQS deferment."""
    if not DATABASE_URL:
        print("[Database] PostgreSQL initialization deferred (DATABASE_URL is not set).")
        return

    schema = '''
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    fullName VARCHAR(255) NOT NULL,
    studentCode VARCHAR(100),
    email VARCHAR(255),
    role VARCHAR(50) NOT NULL,
    department VARCHAR(255),
    avatar TEXT,
    bio TEXT,
    twoFactorEnabled BOOLEAN NOT NULL DEFAULT FALSE,
    twoFactorSecret VARCHAR(255),
    mustChangePassword BOOLEAN NOT NULL DEFAULT FALSE,
    academicStatus VARCHAR(50) DEFAULT 'ACTIVE',
    courseStartDate VARCHAR(50),
    courseEndDate VARCHAR(50),
    currentTermActive BOOLEAN DEFAULT TRUE,
    hasCurrentSchedule BOOLEAN DEFAULT TRUE,
    registeredPermanentAddress TEXT,
    faculty VARCHAR(255),
    createdAt VARCHAR(100),
    updatedAt VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(100) PRIMARY KEY,
    studentId VARCHAR(100) NOT NULL REFERENCES users(id),
    studentName VARCHAR(255) NOT NULL,
    studentCode VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    category VARCHAR(100) NOT NULL,
    priority VARCHAR(50) DEFAULT 'MEDIUM',
    description TEXT,
    status VARCHAR(50) NOT NULL,
    reviewResult TEXT,
    supplementHistory TEXT,
    aiExtraction TEXT,
    evidenceFiles TEXT,
    deadline VARCHAR(100),
    assignedDepartment VARCHAR(255),
    digitalSignature TEXT,
    reviewerFeedback TEXT,
    studentClaim TEXT,
    institutionalFacts TEXT,
    addressAnalysis TEXT,
    createdAt VARCHAR(100),
    updatedAt VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS audits (
    id VARCHAR(100) PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    caseId VARCHAR(100),
    actorId VARCHAR(100),
    actorName VARCHAR(255),
    actorRole VARCHAR(50),
    actorUsername VARCHAR(100),
    inputData TEXT,
    result TEXT,
    reason TEXT,
    timestamp VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS comments (
    id VARCHAR(100) PRIMARY KEY,
    caseId VARCHAR(100) NOT NULL REFERENCES cases(id),
    authorId VARCHAR(100) NOT NULL,
    authorName VARCHAR(255) NOT NULL,
    authorRole VARCHAR(50) NOT NULL,
    authorAvatar TEXT,
    content TEXT NOT NULL,
    createdAt VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(100) PRIMARY KEY,
    userId VARCHAR(100) NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO',
    caseId VARCHAR(100),
    isRead BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(100) PRIMARY KEY,
    userId VARCHAR(100) NOT NULL REFERENCES users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    expiresAt VARCHAR(100) NOT NULL,
    createdAt VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS revoked_access_tokens (
    jti VARCHAR(100) PRIMARY KEY,
    expiresAt VARCHAR(100) NOT NULL,
    createdAt VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS evidence_uploads (
    fileName VARCHAR(255) PRIMARY KEY,
    ownerId VARCHAR(100) NOT NULL REFERENCES users(id),
    metadata TEXT NOT NULL,
    ocrData TEXT,
    ocrProvider VARCHAR(100),
    ocrIsLive BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS escalation_policy_state (
    id VARCHAR(100) PRIMARY KEY,
    currentThreshold DOUBLE PRECISION NOT NULL,
    minThreshold DOUBLE PRECISION NOT NULL,
    maxThreshold DOUBLE PRECISION NOT NULL,
    stepSize DOUBLE PRECISION NOT NULL,
    updatedAt VARCHAR(100) NOT NULL,
    updatedBy VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS escalation_threshold_history (
    id VARCHAR(100) PRIMARY KEY,
    caseId VARCHAR(100),
    feedbackType VARCHAR(50) NOT NULL,
    oldThreshold DOUBLE PRECISION NOT NULL,
    newThreshold DOUBLE PRECISION NOT NULL,
    reviewerId VARCHAR(100),
    reviewerName VARCHAR(255),
    note TEXT,
    createdAt VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS sis_student_records (
    id VARCHAR(100) PRIMARY KEY,
    userId VARCHAR(100) UNIQUE NOT NULL REFERENCES users(id),
    studentCode VARCHAR(100) UNIQUE,
    fullName VARCHAR(255) NOT NULL,
    academicStatus VARCHAR(50), courseStartDate VARCHAR(50), courseEndDate VARCHAR(50),
    currentTermActive BOOLEAN, hasCurrentSchedule BOOLEAN,
    registeredPermanentAddress TEXT, faculty VARCHAR(255),
    source VARCHAR(100) NOT NULL DEFAULT 'INTERNAL_SIS_DEMO',
    sourceType VARCHAR(100) NOT NULL DEFAULT 'INTERNAL_DEMO_SIS',
    verificationStatus VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED',
    verifiedBy VARCHAR(100), verifiedAt VARCHAR(100),
    recordStatus VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    createdAt VARCHAR(100) NOT NULL, updatedAt VARCHAR(100) NOT NULL, updatedBy VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS agent_conversations (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    created_at VARCHAR(100) NOT NULL,
    updated_at VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_messages (
    id VARCHAR(100) PRIMARY KEY,
    conversation_id VARCHAR(100) NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_pending_actions (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(100) NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
    tool_name VARCHAR(100) NOT NULL,
    arguments TEXT NOT NULL,
    arguments_hash VARCHAR(64) NOT NULL,
    preview TEXT NOT NULL,
    role_at_request VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL,
    expires_at VARCHAR(100) NOT NULL,
    created_at VARCHAR(100) NOT NULL,
    updated_at VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS rag_documents (
    id VARCHAR(200) PRIMARY KEY,
    source_key VARCHAR(200) NOT NULL,
    source_path VARCHAR(500) NOT NULL,
    title VARCHAR(255) NOT NULL,
    source_type VARCHAR(100) NOT NULL,
    priority DOUBLE PRECISION NOT NULL,
    version VARCHAR(100) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    updated_at VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS rag_chunks (
    id VARCHAR(200) PRIMARY KEY,
    document_id VARCHAR(200) NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    source_key VARCHAR(200) NOT NULL,
    source_path VARCHAR(500) NOT NULL,
    title VARCHAR(255) NOT NULL,
    heading VARCHAR(500) NOT NULL,
    source_type VARCHAR(100) NOT NULL,
    priority DOUBLE PRECISION NOT NULL,
    version VARCHAR(100) NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT,
    embedding_provider VARCHAR(100),
    embedding_model VARCHAR(200),
    embedding_dimension INTEGER,
    created_at VARCHAR(100) NOT NULL
);
'''
    with get_db_connection() as c, c.cursor() as q:
        for statement in schema.split(';'):
            if statement.strip():
                q.execute(statement)

        # Existing databases may predate the academic/SIS fields. CREATE
        # TABLE IF NOT EXISTS does not evolve those tables, so add every field
        # required by the one-time SIS seed before querying it below.
        for statement in (
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS academicStatus VARCHAR(50)',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS courseStartDate VARCHAR(50)',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS courseEndDate VARCHAR(50)',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS currentTermActive BOOLEAN DEFAULT TRUE',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS hasCurrentSchedule BOOLEAN DEFAULT TRUE',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS registeredPermanentAddress TEXT',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS faculty VARCHAR(255)',
            'ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS source VARCHAR(100) NOT NULL DEFAULT \'INTERNAL_SIS_DEMO\'',
            'ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS sourceType VARCHAR(100) NOT NULL DEFAULT \'INTERNAL_DEMO_SIS\'',
            'ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS verificationStatus VARCHAR(50) NOT NULL DEFAULT \'UNVERIFIED\'',
            'ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS verifiedBy VARCHAR(100)',
            'ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS verifiedAt VARCHAR(100)',
            'ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS recordStatus VARCHAR(50) NOT NULL DEFAULT \'ACTIVE\'',
            'ALTER TABLE sis_student_records ADD COLUMN IF NOT EXISTS updatedBy VARCHAR(100)',
        ):
            q.execute(statement)

        q.execute('CREATE INDEX IF NOT EXISTS idx_audits_timestamp ON audits (timestamp DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_audits_action_timestamp ON audits (action, timestamp DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_audits_role_timestamp ON audits (actorRole, timestamp DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_audits_case_timestamp ON audits (caseId, timestamp DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_audits_actor_timestamp ON audits (actorId, timestamp DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases (createdAt DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_cases_student_created ON cases (studentId, createdAt DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_cases_status_created ON cases (status, createdAt DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_cases_category_created ON cases (category, createdAt DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_cases_department_created ON cases (assignedDepartment, createdAt DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (createdAt DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_users_role_created ON users (role, createdAt DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username))')
        q.execute('CREATE INDEX IF NOT EXISTS idx_comments_case_created ON comments (caseId, createdAt DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (userId, createdAt DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (userId, isRead)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_evidence_owner_created ON evidence_uploads (ownerId, createdAt DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_expiry ON refresh_tokens (userId, expiresAt)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_revoked_access_tokens_expiry ON revoked_access_tokens (expiresAt)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_threshold_history_created ON escalation_threshold_history (createdAt DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_sis_academic_status ON sis_student_records (academicStatus)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_sis_faculty ON sis_student_records (faculty)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_updated ON agent_conversations (user_id, updated_at DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_created ON agent_messages (conversation_id, created_at)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_agent_messages_user_created ON agent_messages (user_id, created_at DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_agent_pending_user_status ON agent_pending_actions (user_id, status, expires_at)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_rag_chunks_source_heading ON rag_chunks (source_key, heading)')

        # Khởi tạo bản ghi chính sách ngưỡng thích ứng mặc định
        q.execute("SELECT EXISTS (SELECT 1 FROM escalation_policy_state WHERE id = 'GLOBAL_NVQS_POLICY') AS has_policy")
        if not q.fetchone()['has_policy']:
            now_iso = datetime.utcnow().isoformat() + 'Z'
            q.execute('''
                INSERT INTO escalation_policy_state (
                    id, currentThreshold, minThreshold, maxThreshold, stepSize, updatedAt, updatedBy
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''', ('GLOBAL_NVQS_POLICY', 0.75, 0.65, 0.90, 0.02, now_iso, 'SYSTEM_INIT'))

        q.execute('SELECT EXISTS (SELECT 1 FROM users) AS has_users')
        has_users = q.fetchone()['has_users']
        if SEED_DEMO_DATA and not has_users:
            # Demo accounts and their default credentials are never implicit in production.
            path = os.path.join(os.path.dirname(__file__), 'data.json')
            if os.path.exists(path):
                for u in json.load(open(path, encoding='utf-8')).get('users', []):
                    password = u.get('password')
                    if not isinstance(password, str) or not password:
                        raise ValueError('Seeded demo accounts must define an explicit password.')
                    if not password.startswith(('$2a$', '$2b$')):
                        password = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
                    now = datetime.utcnow().isoformat() + 'Z'
                    q.execute('''
                        INSERT INTO users (
                            id, username, password, fullName, studentCode, email, role,
                            department, avatar, bio, twoFactorEnabled, twoFactorSecret,
                            mustChangePassword, academicStatus, courseStartDate, courseEndDate,
                            currentTermActive, hasCurrentSchedule, registeredPermanentAddress,
                            faculty, createdAt, updatedAt
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (
                        u['id'], u['username'], password, u['fullName'], u.get('studentCode'),
                        u.get('email', f"{u['username']}@eduassistant.edu"), u['role'],
                        u.get('department', 'Khoa Công Nghệ Thông Tin'), u.get('avatar'), u.get('bio'),
                        bool(u.get('twoFactorEnabled')), u.get('twoFactorSecret'), False,
                        u.get('academicStatus'), u.get('courseStartDate'),
                        u.get('courseEndDate'), u.get('currentTermActive'),
                        u.get('hasCurrentSchedule'),
                        u.get('registeredPermanentAddress'),
                        u.get('faculty', u.get('department', 'Khoa Công Nghệ Thông Tin')),
                        u.get('createdAt', now), u.get('updatedAt', now)
                    ))
        # Additive migration: existing student account facts seed the internal
        # demo SIS registry once; legacy user fields remain for compatibility.
        q.execute("""INSERT INTO sis_student_records (id,userId,studentCode,fullName,academicStatus,courseStartDate,courseEndDate,currentTermActive,hasCurrentSchedule,registeredPermanentAddress,faculty,createdAt,updatedAt,updatedBy)
            SELECT 'SIS-' || id,id,studentCode,fullName,academicStatus,courseStartDate,courseEndDate,currentTermActive,hasCurrentSchedule,registeredPermanentAddress,faculty,%s,%s,'SYSTEM_MIGRATION'
            FROM users WHERE role='STUDENT' ON CONFLICT (userId) DO NOTHING""", (datetime.utcnow().isoformat()+'Z', datetime.utcnow().isoformat()+'Z'))

        # Existing production users may have been created before academic fields
        # existed. Backfill only missing facts from the bundled demo source;
        # populated administrator values are never overwritten.
        seed_path = os.path.join(os.path.dirname(__file__), 'data.json')
        if SEED_DEMO_DATA and os.path.exists(seed_path):
            for seeded_user in json.load(open(seed_path, encoding='utf-8')).get('users', []):
                if seeded_user.get('role') != 'STUDENT':
                    continue
                facts = (
                    seeded_user.get('academicStatus'), seeded_user.get('courseStartDate'),
                    seeded_user.get('courseEndDate'), seeded_user.get('currentTermActive'),
                    seeded_user.get('hasCurrentSchedule'), seeded_user.get('registeredPermanentAddress'),
                    seeded_user.get('faculty'), seeded_user.get('id')
                )
                if not any(value is not None for value in facts[:-1]):
                    continue
                q.execute('''UPDATE sis_student_records
                    SET academicStatus = CASE WHEN academicStatus IS NULL OR academicStatus = 'UNKNOWN' THEN %s ELSE academicStatus END,
                        courseStartDate = COALESCE(courseStartDate, %s),
                        courseEndDate = COALESCE(courseEndDate, %s),
                        currentTermActive = COALESCE(currentTermActive, %s),
                        hasCurrentSchedule = COALESCE(hasCurrentSchedule, %s),
                        registeredPermanentAddress = COALESCE(registeredPermanentAddress, %s),
                        faculty = COALESCE(faculty, %s)
                    WHERE userId = %s''', facts)
    print(f'[Database] {DB_SERVER} ready (pool max={DB_POOL_MAX_SIZE}).')


try:
    init_database()
except Exception as e:
    print(f"[Database] Initialization deferred (connection error: {type(e).__name__}).")
