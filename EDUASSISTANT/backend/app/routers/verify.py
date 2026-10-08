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
    Thực thi bộ Verify Harness in-memory kiểm chuẩn toàn diện 6 ca nghiệp vụ:
      1. Routine Valid Case
      2. FACT_UNKNOWN Case
      3. DATA_CONFLICT Case
      4. AUTHORITY_REQUIRED Case
      5. POLICY_OUT_OF_SCOPE Case
      6. OWNERSHIP_UNCLEAR Case
    """
    result = run_verify_harness()
    return api_response(200, True, 'Chạy Verify Harness kiểm chuẩn quy tắc thành công.', result)
