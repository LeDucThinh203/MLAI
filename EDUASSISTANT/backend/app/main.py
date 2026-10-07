import os
import sys
import time
from datetime import datetime

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import PORT
from app.core.responses import custom_http_exception_handler
from app.routers import (
    auth,
    cases,
    evidence,
    audits,
    admin,
    ai,
    notifications,
    health
)

app = FastAPI(
    title="EduAssistant Enterprise Backend Engine",
    description="Hệ thống Thẩm định Học vụ Tự động Đa phân hệ",
    version="3.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(HTTPException, custom_http_exception_handler)


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

# Serve frontend build artifacts if present
frontend_dist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend', 'dist')
if os.path.exists(frontend_dist_dir):
    app.mount("/", StaticFiles(directory=frontend_dist_dir, html=True), name="frontend")
