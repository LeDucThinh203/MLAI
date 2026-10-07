from datetime import datetime
from fastapi import APIRouter
from app.services.ai_service import get_ai_mode
from app.db.database import ACTIVE_ENGINE, DB_SERVER, DB_NAME

router = APIRouter(tags=["Health"])


@router.get("/api/health")
async def health_check():
    db_name = f"Microsoft SQL Server 2025 ({DB_SERVER} -> [{DB_NAME}])" if ACTIVE_ENGINE == 'mssql' else "SQLite Single Source of Truth"
    return {
        'status': 'healthy',
        'server': 'CaseFlow AI Python Enterprise Engine',
        'version': '3.0.0',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'modules': {
            'jwtAuth': 'Active & Secure',
            'twoFactorTOTP': 'Active (No-Backdoor)',
            'geminiAI': f"Mode: {get_ai_mode()}",
            'ruleEngine': 'Active (5 Strict Reasons)',
            'database': db_name
        }
    }
