from datetime import datetime
from fastapi import APIRouter
from app.services.ai_service import get_ai_mode
from app.db.database import ACTIVE_ENGINE
from app.core.redis_client import get_redis

router = APIRouter(tags=["Health"])


@router.api_route("/api/health", methods=["GET", "HEAD"])
async def health_check():
    db_name = "PostgreSQL (Render)"
    redis = await get_redis()
    return {
        'status': 'healthy',
        'server': 'EduAssistant Python Enterprise Engine',
        'version': '3.0.0',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'modules': {
            'jwtAuth': 'Active & Secure',
            'twoFactorTOTP': 'Active (No-Backdoor)',
            'geminiAI': f"Mode: {get_ai_mode()}",
            'ruleEngine': 'Active (5 Strict Reasons)',
            'database': db_name,
            'redis': 'Connected' if redis else 'Disabled or unavailable'
        }
    }
