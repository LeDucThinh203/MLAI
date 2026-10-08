"""PostgreSQL-only persistence layer."""
import json
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
import bcrypt
from psycopg import connect
from psycopg.rows import dict_row

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
ACTIVE_ENGINE = "postgresql"
DB_SERVER = "Render PostgreSQL"
DB_NAME = "eduassistant_db"
_KEYS = {"fullname":"fullName","studentid":"studentId","studentname":"studentName","studentcode":"studentCode","twofactorenabled":"twoFactorEnabled","twofactorsecret":"twoFactorSecret","mustchangepassword":"mustChangePassword","reviewresult":"reviewResult","supplementhistory":"supplementHistory","aiextraction":"aiExtraction","evidencefiles":"evidenceFiles","assigneddepartment":"assignedDepartment","digitalsignature":"digitalSignature","reviewerfeedback":"reviewerFeedback","createdat":"createdAt","updatedat":"updatedAt","caseid":"caseId","actorid":"actorId","actorname":"actorName","actorrole":"actorRole","actorusername":"actorUsername","inputdata":"inputData","authorid":"authorId","authorname":"authorName","authorrole":"authorRole","authoravatar":"authorAvatar","userid":"userId","isread":"isRead","expiresat":"expiresAt","filename":"fileName","ownerid":"ownerId","ocrdata":"ocrData","ocrprovider":"ocrProvider","ocrlive":"ocrIsLive","ocrislive":"ocrIsLive"}

def _url():
    if not DATABASE_URL: raise RuntimeError("DATABASE_URL is required for PostgreSQL.")
    return DATABASE_URL
def get_db_connection(): return connect(_url(), row_factory=dict_row)
def _sql(sql): return re.sub(r"\?", "%s", sql)
def _row(row): return None if row is None else {_KEYS.get(k,k):v for k,v in row.items()}
def run_query(sql: str, params: tuple=()) -> Dict[str, Any]:
    with get_db_connection() as c, c.cursor() as q:
        q.execute(_sql(sql), params); return {"lastrowid":None,"changes":q.rowcount}
def get_one(sql: str, params: tuple=()) -> Optional[Dict[str, Any]]:
    with get_db_connection() as c, c.cursor() as q:
        q.execute(_sql(sql), params); return _row(q.fetchone())
def get_all(sql: str, params: tuple=()) -> List[Dict[str, Any]]:
    with get_db_connection() as c, c.cursor() as q:
        q.execute(_sql(sql), params); return [_row(x) for x in q.fetchall()]

def init_database():
    schema = '''
CREATE TABLE IF NOT EXISTS users (id VARCHAR(100) PRIMARY KEY, username VARCHAR(100) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, fullName VARCHAR(255) NOT NULL, studentCode VARCHAR(100), email VARCHAR(255), role VARCHAR(50) NOT NULL, department VARCHAR(255), avatar TEXT, bio TEXT, twoFactorEnabled BOOLEAN NOT NULL DEFAULT FALSE, twoFactorSecret VARCHAR(255), mustChangePassword BOOLEAN NOT NULL DEFAULT FALSE, createdAt VARCHAR(100), updatedAt VARCHAR(100));
CREATE TABLE IF NOT EXISTS cases (id VARCHAR(100) PRIMARY KEY, studentId VARCHAR(100) NOT NULL REFERENCES users(id), studentName VARCHAR(255) NOT NULL, studentCode VARCHAR(100), title VARCHAR(500) NOT NULL, category VARCHAR(100) NOT NULL, priority VARCHAR(50) DEFAULT 'MEDIUM', description TEXT, status VARCHAR(50) NOT NULL, reviewResult TEXT, supplementHistory TEXT, aiExtraction TEXT, evidenceFiles TEXT, deadline VARCHAR(100), assignedDepartment VARCHAR(255), digitalSignature TEXT, reviewerFeedback TEXT, createdAt VARCHAR(100), updatedAt VARCHAR(100));
CREATE TABLE IF NOT EXISTS audits (id VARCHAR(100) PRIMARY KEY, action VARCHAR(100) NOT NULL, caseId VARCHAR(100), actorId VARCHAR(100), actorName VARCHAR(255), actorRole VARCHAR(50), actorUsername VARCHAR(100), inputData TEXT, result TEXT, reason TEXT, timestamp VARCHAR(100));
CREATE TABLE IF NOT EXISTS comments (id VARCHAR(100) PRIMARY KEY, caseId VARCHAR(100) NOT NULL REFERENCES cases(id), authorId VARCHAR(100) NOT NULL, authorName VARCHAR(255) NOT NULL, authorRole VARCHAR(50) NOT NULL, authorAvatar TEXT, content TEXT NOT NULL, createdAt VARCHAR(100) NOT NULL);
CREATE TABLE IF NOT EXISTS notifications (id VARCHAR(100) PRIMARY KEY, userId VARCHAR(100) NOT NULL REFERENCES users(id), title VARCHAR(255) NOT NULL, message TEXT NOT NULL, type VARCHAR(50) DEFAULT 'INFO', caseId VARCHAR(100), isRead BOOLEAN NOT NULL DEFAULT FALSE, createdAt VARCHAR(100) NOT NULL);
CREATE TABLE IF NOT EXISTS refresh_tokens (id VARCHAR(100) PRIMARY KEY, userId VARCHAR(100) NOT NULL REFERENCES users(id), token VARCHAR(255) UNIQUE NOT NULL, expiresAt VARCHAR(100) NOT NULL, createdAt VARCHAR(100) NOT NULL);
CREATE TABLE IF NOT EXISTS evidence_uploads (fileName VARCHAR(255) PRIMARY KEY, ownerId VARCHAR(100) NOT NULL REFERENCES users(id), metadata TEXT NOT NULL, ocrData TEXT, ocrProvider VARCHAR(100), ocrIsLive BOOLEAN NOT NULL DEFAULT FALSE, createdAt VARCHAR(100) NOT NULL);
'''
    with get_db_connection() as c, c.cursor() as q:
        for statement in schema.split(';'):
            if statement.strip(): q.execute(statement)
        # Audit history is read newest-first and filtered repeatedly by these
        # fields.  These indexes keep pagination queries from scanning the
        # complete audit table as the log grows.
        q.execute('CREATE INDEX IF NOT EXISTS idx_audits_timestamp ON audits (timestamp DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_audits_action_timestamp ON audits (action, timestamp DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_audits_role_timestamp ON audits (actorRole, timestamp DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_audits_case_timestamp ON audits (caseId, timestamp DESC)')
        q.execute('CREATE INDEX IF NOT EXISTS idx_audits_actor_timestamp ON audits (actorId, timestamp DESC)')
        q.execute('SELECT COUNT(*) AS count FROM users')
        if q.fetchone()['count'] == 0:
            path=os.path.join(os.path.dirname(__file__),'data.json')
            if os.path.exists(path):
                for u in json.load(open(path,encoding='utf-8')).get('users',[]):
                    password=u.get('password','password123')
                    if not password.startswith(('$2a$','$2b$')): password=bcrypt.hashpw(password.encode(),bcrypt.gensalt()).decode()
                    now=datetime.utcnow().isoformat()+'Z'
                    q.execute('INSERT INTO users (id,username,password,fullName,studentCode,email,role,department,avatar,bio,twoFactorEnabled,twoFactorSecret,mustChangePassword,createdAt,updatedAt) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',(u['id'],u['username'],password,u['fullName'],u.get('studentCode'),u.get('email'),u['role'],u.get('department'),u.get('avatar'),u.get('bio'),bool(u.get('twoFactorEnabled')),u.get('twoFactorSecret'),False,u.get('createdAt',now),u.get('updatedAt',now)))
    print('[Database] PostgreSQL ready.')
init_database()
