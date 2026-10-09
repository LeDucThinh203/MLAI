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

# Authentication cookies are inaccessible to JavaScript, preventing token theft
# through browser storage when an XSS vulnerability is present.
APP_ENV = os.environ.get('APP_ENV', os.environ.get('ENV', os.environ.get('NODE_ENV', 'development'))).lower()
COOKIE_SECURE = os.environ.get('COOKIE_SECURE', str(APP_ENV == 'production')).lower() == 'true'
COOKIE_SAMESITE = os.environ.get('COOKIE_SAMESITE', 'none' if COOKIE_SECURE else 'lax').lower()
if COOKIE_SAMESITE == 'none' and not COOKIE_SECURE:
    raise RuntimeError('COOKIE_SAMESITE=none requires COOKIE_SECURE=true')
COOKIE_DOMAIN = os.environ.get('COOKIE_DOMAIN') or None
ACCESS_COOKIE_NAME = 'edu_access'
REFRESH_COOKIE_NAME = 'edu_refresh'
CSRF_COOKIE_NAME = 'edu_csrf'

# Optional shared cache. Leave empty to retain the safe in-memory fallback.
REDIS_URL = os.environ.get('REDIS_URL', '').strip()
REDIS_KEY_PREFIX = os.environ.get('REDIS_KEY_PREFIX', 'eduassistant').strip() or 'eduassistant'

# PostgreSQL is the sole supported database engine.
DATABASE_URL = os.environ.get('DATABASE_URL', '').strip()
