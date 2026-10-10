"""
============================================================================
EDUASSISTANT - VERIFY HARNESS ROUTER
============================================================================
Cung cấp endpoint chạy bộ kiểm chuẩn xác định (One-click Verify Harness)
dành riêng cho Giám khảo và Kiểm thử hệ thống:
  - POST /api/verify/run
============================================================================
"""

from fastapi import APIRouter
from app.core.responses import api_response
from app.services.verify_harness_service import run_verify_harness

router = APIRouter(tags=["Verify Harness"])


@router.post("/api/verify/run")
@router.get("/api/verify/run")
async def execute_verify_harness_endpoint():
    """
    Thực thi bộ Verify Harness in-memory kiểm chuẩn toàn diện 9 tình huống:
      1. Routine Valid Case
      2. Formatting-only variation
      3. Missing address field
      4. Temporary address
      5. Permanent address conflict
      6. Academic/authority case
      7. Policy out of scope
      8. Ownership mismatch
      9. AI fallback / fail-safe
    """
    result = run_verify_harness()
    return api_response(200, True, 'Chạy Verify Harness kiểm chuẩn quy tắc thành công.', result)
