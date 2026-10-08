"""
============================================================================
EDUASSISTANT - WORKFLOW STATE TRANSITION GUARD
============================================================================
Bảo vệ và kiểm soát nghiêm ngặt luồng trạng thái của hồ sơ học vụ (HITL):
  - Hợp lệ:
      SUBMITTED -> UNDER_REVIEW, REQUIRES_SUPPLEMENT, STOPPED
      UNDER_REVIEW -> APPROVED, REJECTED, REQUIRES_SUPPLEMENT, STOPPED
      REQUIRES_SUPPLEMENT -> UNDER_REVIEW, STOPPED
  - Trạng thái kết thúc (Terminal):
      APPROVED, REJECTED, STOPPED
  - Chặn tuyệt đối chuyển trạng thái tùy tiện (VD: APPROVED -> UNDER_REVIEW)
    trừ khi là ADMIN thực hiện Quyết định Ghi đè (Explicit Override) và có lý do.
============================================================================
"""

from typing import Tuple, Set, Dict

ALLOWED_TRANSITIONS: Dict[str, Set[str]] = {
    'SUBMITTED': {'UNDER_REVIEW', 'REQUIRES_SUPPLEMENT', 'STOPPED'},
    'UNDER_REVIEW': {'APPROVED', 'REJECTED', 'REQUIRES_SUPPLEMENT', 'STOPPED'},
    'REQUIRES_SUPPLEMENT': {'UNDER_REVIEW', 'STOPPED'},
    'STOPPED': set(),
    'APPROVED': set(),
    'REJECTED': set(),
}

VALID_STATUSES = {'SUBMITTED', 'UNDER_REVIEW', 'REQUIRES_SUPPLEMENT', 'APPROVED', 'REJECTED', 'STOPPED'}


def is_terminal_status(status: str) -> bool:
    """Kiểm tra xem trạng thái đã kết thúc chưa."""
    return status in ('APPROVED', 'REJECTED', 'STOPPED')


def validate_status_transition(
    current_status: str,
    next_status: str,
    actor_role: str,
    is_admin_override: bool = False
) -> Tuple[bool, str]:
    """
    Kiểm tra tính hợp lệ của bước chuyển trạng thái hồ sơ.
    Trả về (is_valid: bool, error_message: str).
    """
    if next_status not in VALID_STATUSES:
        return False, f"Trạng thái đích '{next_status}' không tồn tại trong hệ thống."

    if current_status == next_status:
        return True, ""

    # ADMIN Override đặc cách có thể chuyển trạng thái từ Terminal
    if actor_role == 'ADMIN' and is_admin_override:
        return True, ""

    allowed_targets = ALLOWED_TRANSITIONS.get(current_status, set())
    if next_status in allowed_targets:
        return True, ""

    if is_terminal_status(current_status):
        return False, (
            f"Hồ sơ đã ở trạng thái kết thúc ({current_status}). "
            f"Không được phép chuyển sang {next_status} trừ khi có quyền ADMIN Ghi đè (Explicit Override)."
        )

    return False, f"Chuyển trạng thái bất hợp lệ: từ '{current_status}' sang '{next_status}' không được quy định trong quy trình."
