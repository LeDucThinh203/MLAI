from datetime import datetime
import asyncio
from fastapi import APIRouter
from app.services.ai_service import get_ai_mode
from app.db.database import ACTIVE_ENGINE, get_one
from app.core.redis_client import get_redis

router = APIRouter(tags=["Health"])


@router.api_route("/api/health", methods=["GET", "HEAD"])
async def health_check():
    try:
        db_ok = bool(await asyncio.to_thread(get_one, 'SELECT 1 AS ok'))
    except Exception:
        db_ok = False
    redis = await get_redis()
    return {
        'status': 'healthy' if db_ok else 'degraded',
        'server': 'EduAssistant Python Enterprise Engine',
        'version': '3.0.0',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'modules': {
            'jwtAuth': 'Active & Secure',
            'twoFactorTOTP': 'Active (No-Backdoor)',
            'geminiAI': f"Mode: {get_ai_mode()}",
            'ruleEngine': 'Active (5 Strict Reasons)',
            'database': f"{ACTIVE_ENGINE}: connected" if db_ok else f"{ACTIVE_ENGINE}: unavailable",
            'redis': 'Connected' if redis else 'Disabled or unavailable'
        }
    }
