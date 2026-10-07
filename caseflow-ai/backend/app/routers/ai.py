import os
from fastapi import APIRouter, Depends

from app.services.ai_service import get_ai_mode, set_ai_mode
from app.core.responses import api_response
from app.core.dependencies import get_current_user, require_roles
from app.schemas.admin import SetAiModeRequest

router = APIRouter(tags=["AI Configuration"])


@router.get("/api/system/ai-status")
async def get_system_ai_status(user: dict = Depends(get_current_user)):
    current_mode = get_ai_mode()
    return api_response(200, True, 'Lấy trạng thái AI thành công.', {
        'currentMode': current_mode,
        'aiMode': current_mode
    })


@router.get("/api/ai/status")
async def get_ai_status(user: dict = Depends(require_roles('ADMIN'))):
    api_key = os.environ.get('GEMINI_API_KEY')
    has_key = bool(api_key and len(api_key.strip()) > 10)
    current_mode = get_ai_mode()
    return api_response(200, True, 'Lấy trạng thái cấu hình AI thành công.', {
        'currentMode': current_mode,
        'aiMode': current_mode,
        'hasApiKey': has_key,
        'models': ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
        'defaultModel': 'gemini-2.5-flash',
        'failSafeEnabled': True
    })


@router.post("/api/system/ai-mode")
@router.post("/api/ai/mode")
async def set_ai_mode_endpoint(req: SetAiModeRequest, user: dict = Depends(require_roles('ADMIN'))):
    if set_ai_mode(req.mode):
        return api_response(200, True, f"Chuyển đổi AI Engine sang chế độ {req.mode} thành công.", {
            'mode': req.mode,
            'currentMode': req.mode
        })
    return api_response(400, False, 'Chế độ AI không hợp lệ. Chỉ chấp nhận live, mock, cache.', None, 'INVALID_MODE')
