"""
============================================================================
CASEFLOW AI - SEED FULL DEMO SCRIPT (PYTHON MODULE)
============================================================================
Khởi tạo dữ liệu mẫu phong phú: Người dùng mẫu (Sinh viên, Reviewer, Admin),
hồ sơ học vụ đầy đủ các diện, minh chứng WebP và nhật ký kiểm toán.
============================================================================
"""

import os
import sys
import json
import secrets
from datetime import datetime, timedelta
import bcrypt

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.database import run_query, get_all, get_one, DB_PATH
from create_evidence import main as generate_demo_images

DATA_JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'shared', 'data.json')


def seed():
    print("=================================================================")
    print("🌱 CASEFLOW AI - SEEDING FULL DEMO DATABASE (SQLITE & WEBP)")
    print("=================================================================")

    # 1. Tạo các ảnh WebP minh chứng thực
    generate_demo_images()

    # 2. Đọc dữ liệu mẫu từ data.json
    if os.path.exists(DATA_JSON_PATH):
        with open(DATA_JSON_PATH, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)

        # Nạp Users
        users = raw_data.get('users', [])
        for u in users:
            raw_pwd = u.get('password', 'password123')
            if raw_pwd.startswith('$2a$') or raw_pwd.startswith('$2b$'):
                hashed_pwd = raw_pwd
            else:
                hashed_pwd = bcrypt.hashpw(raw_pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            now_iso = datetime.utcnow().isoformat() + 'Z'
            run_query("""
                INSERT OR REPLACE INTO users (id, username, password, fullName, studentCode, email, role, department, avatar, twoFactorEnabled, twoFactorSecret, mustChangePassword, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                u['id'],
                u['username'],
                hashed_pwd,
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

        # Nạp Cases
        cases = raw_data.get('cases', [])
        for c in cases:
            now_iso = datetime.utcnow().isoformat() + 'Z'
            run_query("""
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

        # Nạp Audits
        audits = raw_data.get('audits', [])
        for a in audits:
            now_iso = datetime.utcnow().isoformat() + 'Z'
            actor = a.get('actor', {})
            run_query("""
                INSERT OR REPLACE INTO audits (id, action, caseId, actorId, actorName, actorRole, actorUsername, reason, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                a.get('id', f"aud_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(2)}"),
                a['action'],
                a.get('caseId'),
                actor.get('id'),
                actor.get('name'),
                actor.get('role'),
                actor.get('username'),
                a.get('reason', ''),
                a.get('timestamp', now_iso)
            ))

        print(f"✅ Nạp dữ liệu hoàn tất vào SQLite ({DB_PATH}): {len(users)} users, {len(cases)} cases, {len(audits)} audits.")


if __name__ == '__main__':
    seed()
