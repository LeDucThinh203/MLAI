import os
import sys
import secrets
from dotenv import load_dotenv

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)
project_root = os.path.dirname(backend_root)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Nạp file .env từ thư mục gốc hoặc thư mục hiện tại
env_paths = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'),
    '.env'
]
for p in env_paths:
    if os.path.exists(p):
        load_dotenv(p)

# Cấu hình JWT & Secrets
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

# Cấu hình Cơ sở dữ liệu (SQL Server & SQLite)
DB_TYPE = os.environ.get('DB_TYPE', 'mssql').strip().lower()
DB_SERVER = os.environ.get('DB_SERVER', 'THINH\\SQL2025').strip()
DB_NAME = os.environ.get('DB_NAME', 'CaseFlowAI').strip()
DB_PORT = os.environ.get('DB_PORT', '1433').strip()
DB_TRUSTED_CONNECTION = os.environ.get('DB_TRUSTED_CONNECTION', 'yes').strip().lower() in ('yes', 'true', '1')
DB_DRIVER = os.environ.get('DB_DRIVER', 'ODBC Driver 18 for SQL Server').strip()
DB_TRUST_SERVER_CERTIFICATE = os.environ.get('DB_TRUST_SERVER_CERTIFICATE', 'yes').strip().lower() in ('yes', 'true', '1')
DB_ENCRYPT = os.environ.get('DB_ENCRYPT', 'yes').strip().lower() in ('yes', 'true', '1')
DB_USER = os.environ.get('DB_USER', '').strip()
DB_PASSWORD = os.environ.get('DB_PASSWORD', '').strip()
