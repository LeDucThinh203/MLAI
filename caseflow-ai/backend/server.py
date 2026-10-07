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

# Đảm bảo thư mục backend và workspace luôn nằm trong sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
workspace_dir = os.path.dirname(backend_dir)
if workspace_dir not in sys.path:
    sys.path.insert(0, workspace_dir)

import uvicorn
from app.main import app
from app.config import PORT
from app.db.database import ACTIVE_ENGINE, DB_SERVER, DB_NAME

__all__ = ["app"]

if __name__ == "__main__":
    db_status = f"SQL Server 2025 ({DB_SERVER} -> [{DB_NAME}])" if ACTIVE_ENGINE == 'mssql' else "SQLite Engine"
    print(f"""
╔══════════════════════════════════════════════════════════════════════════╗
║             🚀 CASEFLOW AI - ENTERPRISE PYTHON ENGINE 3.0                ║
╠══════════════════════════════════════════════════════════════════════════╣
║  • Database Engine: {db_status:<50} ║
║  • Port: {PORT:<59} ║
║  • Base URL: http://localhost:{PORT}/api                                  ║
║  • Swagger Docs: http://localhost:{PORT}/docs                            ║
╚══════════════════════════════════════════════════════════════════════════╝
""")
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=False)
