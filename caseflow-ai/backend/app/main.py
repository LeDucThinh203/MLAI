from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import logger
from app.api.router import api_router
from app.api.routes.health import router as health_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CaseFlow AI Backend starting up...")
    yield
    logger.info("CaseFlow AI Backend shutting down...")

app = FastAPI(
    title="CaseFlow AI - The Escalation Referee",
    description="Automate the routine. Escalate the uncertain. Keep humans accountable.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware
origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Direct health endpoint at root /health
app.include_router(health_router)

# Mount all business routes under /api
app.include_router(api_router, prefix="/api")
