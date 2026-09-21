from typing import Dict, Any, Optional
from pydantic import BaseModel

class AuthorityEvaluationResult(BaseModel):
    is_authorized_for_ai: bool
    escalation_required: bool
    required_role: Optional[str] = None
    target_department: Optional[str] = None
    reason: Optional[str] = None

class AuthorityEngine:
    """
    Ensures AI never exceeds its authorized threshold.
    Certain decisions (fee waiver, registration override, disciplinary actions, out-of-SLA urgent letters)
    mandate human authority.
    """

    # Maximum amount AI is authorized to auto-reconcile without human sign-off
    MAX_AUTO_RESOLVE_AMOUNT = 50_000_000  # 50 million VND

    def evaluate(self, case_type: str, facts: Dict[str, Any], policy_action: str) -> AuthorityEvaluationResult:
        # If policy already requires human escalation
        if policy_action in ["ESCALATE", "REJECT"]:
            return AuthorityEvaluationResult(
                is_authorized_for_ai=False,
                escalation_required=True,
                required_role="Department Officer",
                target_department="STUDENT_SERVICES",
                reason="Hành động chính sách yêu cầu cán bộ chuyên trách phê duyệt."
            )

        # Check high-value payment thresholds
        amount = facts.get("amount")
        if amount and amount > self.MAX_AUTO_RESOLVE_AMOUNT:
            return AuthorityEvaluationResult(
                is_authorized_for_ai=False,
                escalation_required=True,
                required_role="Finance Chief Accountant",
                target_department="FINANCE",
                reason=f"Số tiền giao dịch {amount:,.0f} VNĐ vượt quá hạn mức phê duyệt tự động của AI."
            )

        # Check special case types
        if case_type in ["SPECIAL_EXEMPTION", "DISCIPLINARY_APPEAL", "URGENT_SLA_LETTER"]:
            return AuthorityEvaluationResult(
                is_authorized_for_ai=False,
                escalation_required=True,
                required_role="Dean / Department Head",
                target_department="ACADEMIC_AFFAIRS",
                reason="Trường hợp đặc cách yêu cầu chữ ký phê duyệt từ Lãnh đạo Đơn vị."
            )

        return AuthorityEvaluationResult(
            is_authorized_for_ai=True,
            escalation_required=False,
            required_role=None,
            target_department=None,
            reason=None
        )
