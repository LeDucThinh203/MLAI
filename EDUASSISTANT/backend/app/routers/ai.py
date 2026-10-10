"""
============================================================================
EDUASSISTANT - AI SYSTEM CONFIGURATION & NORMALIZATION ROUTER
============================================================================
Cung cấp các API:
  - GET  /api/system/ai-status: Trạng thái vận hành động cơ AI (Read-only)
  - GET  /api/ai/status: Chi tiết cấu hình AI cho Quản trị viên (Read-only)
  - POST /api/ai/normalize-address: Chuẩn hóa địa chỉ sinh viên bằng Gemini/Deterministic
============================================================================
"""

import os
from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, Depends

from app.core.responses import api_response
from app.core.dependencies import get_current_user, require_roles
from app.schemas.admin import SetAiModeRequest

router = APIRouter(tags=["AI Configuration"])


@router.get("/api/system/ai-status")
@router.get("/api/ai/status")
async def get_system_ai_status(user: dict = Depends(get_current_user)):
    """Trả về trạng thái hoạt động thực tế của Gemini AI (Read-only cho Client)."""
    api_key = os.environ.get('GEMINI_API_KEY')
    is_configured = bool(api_key and len(api_key.strip()) > 10)
    # A configured key is not evidence that a live API call is available.
    current_status = "CONFIGURED" if is_configured else "NOT_CONFIGURED"
    display_label = "Gemini Live" if is_configured else "AI unavailable – Safe Human Review"

    return api_response(200, True, 'Lấy trạng thái AI thành công.', {
        'provider': 'Google Gemini Live API',
        'isConfigured': is_configured,
        'hasApiKey': is_configured,
        'currentMode': 'live' if is_configured else 'fallback',
        'operationalStatus': current_status,
        'displayLabel': display_label,
        'model': 'gemini-2.5-flash',
        'fallbackParser': 'Deterministic Vietnamese Administrative Address Parser',
        'failSafeEnabled': True
    })


@router.post("/api/system/ai-mode")
@router.post("/api/ai/mode")
async def set_ai_mode_endpoint(req: SetAiModeRequest, user: dict = Depends(require_roles('ADMIN'))):
    """
    Deprecated: Production áp dụng tự động cơ chế Gemini Live với Deterministic Safe Fallback.
    Không còn cho phép Client UI tự ý thay đổi mode thủ công.
    """
    return api_response(
        200,
        True,
        "Chế độ AI hiện được quản lý tự động qua cơ chế Fail-Safe (Gemini Live với Deterministic Fallback). Endpoint này đã được deprecated an toàn.",
        {
            'mode': 'live',
            'deprecated': True,
            'failSafeActive': True
        }
    )


class NormalizeAddressRequest(BaseModel):
    rawAddress: str
    addressType: Optional[str] = 'PERMANENT'


@router.post("/api/ai/normalize-address")
async def normalize_address_endpoint(req: NormalizeAddressRequest, user: dict = Depends(get_current_user)):
    """
    Chuẩn hóa địa chỉ thường trú sinh viên:
    - Bóc tách: số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố.
    - Phát hiện trường thiếu (missingFields) và nhập nhằng (ambiguousFields).
    - Tính toán điểm tin cậy bóc tách (AI confidence score).
    - TUYỆT ĐỐI KHÔNG đưa ra phán quyết pháp lý về việc có được tạm hoãn NVQS hay không.
    """
    from app.services.address_ai_service import normalize_student_address
    result = await normalize_student_address(req.rawAddress, req.addressType or 'PERMANENT', user)
    return api_response(200, True, 'Chuẩn hóa địa chỉ thành công.', result)
