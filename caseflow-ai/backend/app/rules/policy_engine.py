from typing import Dict, Any, List, Optional
from pydantic import BaseModel

class PolicyEvaluationResult(BaseModel):
    is_applicable: bool
    policy_code: str
    rule_code: str
    rule_action: str
    reason: str

class PolicyEngine:
    """
    Deterministic rule engine evaluating policy constraints.
    Does NOT depend on LLM creativity.
    """

    def evaluate(self, case_type: str, facts: Dict[str, Any], comparisons: List[Dict[str, Any]]) -> PolicyEvaluationResult:
        # Check Tuition status policy
        if case_type == "TUITION_STATUS":
            # Check for conflict in comparisons
            for comp in comparisons:
                if comp.get("comparison_status") == "MISMATCH":
                    return PolicyEvaluationResult(
                        is_applicable=True,
                        policy_code="POL-TUITION",
                        rule_code="RULE-TUIT-002-CONFLICT",
                        rule_action="ESCALATE",
                        reason=f"Phát hiện mâu thuẫn dữ liệu tại trường: {comp.get('field_name')}."
                    )
            
            # Check for payment success (or valid receipt with clear amount)
            payment_status = facts.get("payment_status")
            is_successful_payment = payment_status in ["SUCCESS", "PAID", "COMPLETED"]
            if is_successful_payment and facts.get("amount") is not None:
                return PolicyEvaluationResult(
                    is_applicable=True,
                    policy_code="POL-TUITION",
                    rule_code="RULE-TUIT-001-AUTO",
                    rule_action="AUTO_RESOLVE",
                    reason="Biên lai thanh toán hợp lệ và dữ liệu khớp hoàn toàn với hệ thống SIS."
                )

        # Check Special Exemption (evaluated through AuthorityEngine)
        elif case_type == "SPECIAL_EXEMPTION":
            return PolicyEvaluationResult(
                is_applicable=True,
                policy_code="POL-EXEMPT",
                rule_code="RULE-EXEMPT-001",
                rule_action="AUTO_RESOLVE",
                reason="Đề xuất xét miễn giảm đặc cách."
            )

        # Check Urgent SLA Letter (evaluated through AuthorityEngine)
        elif case_type == "URGENT_SLA_LETTER":
            return PolicyEvaluationResult(
                is_applicable=True,
                policy_code="POL-SLA",
                rule_code="RULE-SLA-001",
                rule_action="AUTO_RESOLVE",
                reason="Cấp giấy xác nhận sinh viên khẩn."
            )

        # Check Registration block
        elif case_type == "REGISTRATION_BLOCK":
            return PolicyEvaluationResult(
                is_applicable=False,
                policy_code="POL-ACAD",
                rule_code="RULE-ACAD-003-MANUAL",
                rule_action="ESCALATE",
                reason="Mở khóa đăng ký tín chỉ yêu cầu xác minh phòng Đào tạo."
            )

        # Fallback if no matching policy
        return PolicyEvaluationResult(
            is_applicable=False,
            policy_code="POL-DEFAULT",
            rule_code="RULE-DEF-OUT-OF-SCOPE",
            rule_action="ESCALATE",
            reason="Tình huống không nằm trong danh mục quy chế tự động xử lý."
        )
