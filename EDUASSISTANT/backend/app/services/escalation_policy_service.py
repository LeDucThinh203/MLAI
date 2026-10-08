"""
============================================================================
EDUASSISTANT - ADAPTIVE ESCALATION THRESHOLD & POLICY SERVICE
============================================================================
Quản lý ngưỡng tin cậy leo thang (Confidence Threshold) thích ứng theo
phản hồi của Chuyên viên thẩm định (Human-in-the-Loop Feedback):
  - Ngưỡng mặc định: 0.75
  - Giới hạn an toàn: [0.65, 0.90]
  - Điều chỉnh xác định (Deterministic adjustment):
      * MISSED_ESCALATION: +0.02 (Thắt chặt tự động hóa, tăng leo thang)
      * UNNECESSARY_ESCALATION: -0.02 (Nới lỏng tự động hóa, giảm leo thang thừa)
      * CORRECT: Giữ nguyên
  - Lưu trữ lịch sử biến động và kiểm toán (Audit Trail)
============================================================================
"""

from datetime import datetime
from typing import List, Dict, Any, Optional

DEFAULT_THRESHOLD = 0.75
MIN_THRESHOLD = 0.65
MAX_THRESHOLD = 0.90
STEP_SIZE = 0.02

# Bộ nhớ trạng thái Runtime
_current_threshold: float = DEFAULT_THRESHOLD
_threshold_history: List[Dict[str, Any]] = [
    {
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'oldThreshold': DEFAULT_THRESHOLD,
        'newThreshold': DEFAULT_THRESHOLD,
        'caseId': 'SYSTEM_INIT',
        'feedback': 'INITIALIZATION',
        'reviewer': 'SYSTEM',
        'reason': 'Khởi tạo ngưỡng tin cậy mặc định cho EDUASSISTANT Escalation Referee.'
    }
]


def get_confidence_threshold() -> float:
    """Lấy ngưỡng tin cậy leo thang hiện tại."""
    global _current_threshold
    return round(_current_threshold, 4)


def set_confidence_threshold(value: float, actor: str = 'ADMIN', reason: str = 'Manual update') -> float:
    """Cập nhật trực tiếp ngưỡng tin cậy (kẹp trong bounds [0.65, 0.90])."""
    global _current_threshold, _threshold_history
    old = _current_threshold
    clamped = max(MIN_THRESHOLD, min(MAX_THRESHOLD, float(value)))
    _current_threshold = clamped

    record = {
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'oldThreshold': round(old, 4),
        'newThreshold': round(_current_threshold, 4),
        'caseId': 'MANUAL_OVERRIDE',
        'feedback': 'MANUAL_SET',
        'reviewer': actor,
        'reason': reason
    }
    _threshold_history.append(record)
    return round(_current_threshold, 4)


def get_threshold_history() -> List[Dict[str, Any]]:
    """Lấy toàn bộ lịch sử biến động ngưỡng leo thang."""
    return list(_threshold_history)


def record_reviewer_feedback(
    case_id: str,
    feedback_type: str,
    reviewer: str,
    note: Optional[str] = None
) -> Dict[str, Any]:
    """
    Tiếp nhận phản hồi từ thẩm định viên và cập nhật ngưỡng thích ứng:
      - MISSED_ESCALATION: Tăng 0.02
      - UNNECESSARY_ESCALATION: Giảm 0.02
      - CORRECT: Giữ nguyên
    """
    global _current_threshold, _threshold_history
    old_threshold = _current_threshold
    ft = (feedback_type or '').strip().upper()

    reason = note or ''
    if ft == 'MISSED_ESCALATION':
        _current_threshold = min(MAX_THRESHOLD, _current_threshold + STEP_SIZE)
        if not reason:
            reason = 'Phát hiện bỏ sót leo thang (Missed Escalation) -> Nâng ngưỡng kiểm định an toàn +0.02'
    elif ft == 'UNNECESSARY_ESCALATION':
        _current_threshold = max(MIN_THRESHOLD, _current_threshold - STEP_SIZE)
        if not reason:
            reason = 'Leo thang không cần thiết (Unnecessary Escalation) -> Hạ ngưỡng kiểm định -0.02'
    elif ft == 'CORRECT':
        # Không đổi
        if not reason:
            reason = 'Phán quyết hệ thống chính xác -> Giữ nguyên ngưỡng kiểm định'
    else:
        raise ValueError(f"Loại feedback không hợp lệ: {feedback_type}. Chỉ chấp nhận CORRECT, MISSED_ESCALATION, UNNECESSARY_ESCALATION.")

    record = {
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'oldThreshold': round(old_threshold, 4),
        'newThreshold': round(_current_threshold, 4),
        'caseId': case_id,
        'feedback': ft,
        'reviewer': reviewer,
        'reason': reason
    }
    _threshold_history.append(record)

    return {
        'oldThreshold': round(old_threshold, 4),
        'newThreshold': round(_current_threshold, 4),
        'feedback': ft,
        'caseId': case_id,
        'record': record
    }


def reset_threshold():
    """Khôi phục ngưỡng mặc định (dùng cho test suite / benchmark)."""
    global _current_threshold, _threshold_history
    _current_threshold = DEFAULT_THRESHOLD
