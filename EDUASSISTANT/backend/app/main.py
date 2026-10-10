import os
import sys
import time
import secrets
from datetime import datetime

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import CSRF_COOKIE_NAME, PORT
from app.core.redis_client import close_redis
from app.db.database import close_database_pool
from app.core.responses import api_response, custom_http_exception_handler
from app.routers import (
    auth,
    cases,
    evidence,
    audits,
    admin,
    ai,
    notifications,
    health,
    verify,
    judge
)

app = FastAPI(
    title="EduAssistant Enterprise Backend Engine",
    description="Hệ thống Thẩm định Học vụ Tự động Đa phân hệ",
    version="3.0.0"
)

# CORS: permit the deployed Cloudflare Pages application and local development.
# Keep credentials enabled for the token refresh flow, therefore origins must be
# listed explicitly rather than using a wildcard.
allowed_origins = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://edu-sp.pages.dev",
}
configured_frontend = os.environ.get("FRONTEND_URL", "")
if configured_frontend.strip():
    allowed_origins.add(configured_frontend.strip().rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    # Cloudflare Pages uses a unique subdomain for each preview deployment.
    allow_origin_regex=r"https://[a-z0-9-]+\.edu-sp\.pages\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CSRF_EXEMPT_PATHS = {'/api/login', '/api/register', '/api/auth/2fa/login'}


@app.middleware('http')
async def csrf_protection(request: Request, call_next):
    if (
        request.method in {'POST', 'PUT', 'PATCH', 'DELETE'}
        and request.url.path.startswith('/api/')
        and request.url.path not in CSRF_EXEMPT_PATHS
        and (request.cookies.get('edu_access') or request.cookies.get('edu_refresh'))
    ):
        csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
        csrf_header = request.headers.get('X-CSRF-Token')
        if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
            return api_response(403, False, 'CSRF validation failed.', None, 'CSRF_INVALID')
    return await call_next(request)

# Exception handlers
app.add_exception_handler(HTTPException, custom_http_exception_handler)


@app.on_event("shutdown")
async def close_optional_redis_connection():
    await close_redis()
    close_database_pool()


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Return a CORS-compatible JSON error instead of an opaque browser error."""
    print(f"[Unhandled error] {request.method} {request.url.path}: {type(exc).__name__}: {exc}")
    return api_response(
        500,
        False,
        "Máy chủ gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại.",
        None,
        "INTERNAL_SERVER_ERROR",
    )


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000)
    print(f"[{datetime.now().strftime('%I:%M:%S %p')}] {request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)")
    return response


# Include modular routers
app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(evidence.router)
app.include_router(audits.router)
app.include_router(admin.router)
app.include_router(ai.router)
app.include_router(notifications.router)
app.include_router(health.router)
app.include_router(verify.router)
app.include_router(judge.router)

# Serve frontend build artifacts if present
frontend_dist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend', 'dist')
if os.path.exists(frontend_dist_dir):
    app.mount("/", StaticFiles(directory=frontend_dist_dir, html=True), name="frontend")
