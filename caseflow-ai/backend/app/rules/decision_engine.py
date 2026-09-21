from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from app.rules.policy_engine import PolicyEngine, PolicyEvaluationResult
from app.rules.uncertainty_engine import UncertaintyEngine, UncertaintyEvaluationResult, get_field_label_vi
from app.rules.authority_engine import AuthorityEngine, AuthorityEvaluationResult

def format_currency_vi(val: Any) -> str:
    """Format numeric value into readable Vietnamese currency string (e.g. 12.500.000 VNĐ)."""
    try:
        num = float(val)
        return f"{num:,.0f} VNĐ".replace(",", ".")
    except (ValueError, TypeError):
        return str(val)

def format_value_vi(field: str, val: Any) -> str:
    """Format field value depending on whether it represents monetary amounts or text."""
    if val is None or val == "None" or val == "":
        return "Chưa ghi nhận"
    if "amount" in field.lower() or "fee" in field.lower():
        return format_currency_vi(val)
    return str(val)

class DecisionPipelineResult(BaseModel):
    decision_type: str  # AUTO_RESOLVE, REQUEST_INFORMATION, ESCALATE, REJECT, NO_DECISION
    reason: str
    policy_reference: Optional[str] = None
    escalation_type: Optional[str] = None  # FACT_UNKNOWN, POLICY_OUT_OF_SCOPE, AUTHORITY_REQUIRED, DATA_CONFLICT, OWNERSHIP_UNCLEAR
    target_department: Optional[str] = None
    target_role: Optional[str] = None
    question: Optional[str] = None

class DecisionEngine:
    """
    Coordinates PolicyEngine, UncertaintyEngine, and AuthorityEngine
    to produce deterministic decisions.
    """

    def __init__(
        self,
        policy_engine: Optional[PolicyEngine] = None,
        uncertainty_engine: Optional[UncertaintyEngine] = None,
        authority_engine: Optional[AuthorityEngine] = None
    ):
        self.policy_engine = policy_engine or PolicyEngine()
        self.uncertainty_engine = uncertainty_engine or UncertaintyEngine()
        self.authority_engine = authority_engine or AuthorityEngine()

    def process(
        self,
        case_type: str,
        facts: Dict[str, Any],
        comparisons: List[Dict[str, Any]],
        required_fields: Optional[List[str]] = None
    ) -> DecisionPipelineResult:
        # STEP 1: Check for Inter-Department Ownership Dispute (Safeguard 4: OWNERSHIP_UNCLEAR)
        if case_type in ["CROSS_DEPARTMENT_DISPUTE", "INTER_DEPARTMENT_DISPUTE", "UNASSIGNED_RESPONSIBILITY"] or facts.get("disputed_departments") or facts.get("is_cross_department"):
            depts = facts.get("disputed_departments", ["Phòng Kế toán (Finance)", "Phòng Đào tạo (Academic Affairs)"])
            dept_str = ", ".join(depts) if isinstance(depts, list) else str(depts)
            return DecisionPipelineResult(
                decision_type="ESCALATE",
                reason=f"Hồ sơ sinh viên bị mắc kẹt do tranh chấp phạm vi tiếp nhận và thẩm quyền xử lý giữa các đơn vị ({dept_str}).",
                escalation_type="OWNERSHIP_UNCLEAR",
                target_department="STUDENT_SERVICES",
                target_role="Trọng tài học vụ / Trưởng phòng CTSV (Ombudsman)",
                question=f"Hồ sơ đang có sự chồng chéo hoặc đùn đẩy trách nhiệm giữa các phòng ban ({dept_str}). Đề nghị Trưởng phòng Công tác Sinh viên (đơn vị trọng tài) chỉ định đơn vị thụ lý chính dứt điểm."
            )

        # STEP 2: Check High-Value Threshold (Safeguard 5: AUTHORITY_REQUIRED - > 50M VND threshold)
        amount_val = facts.get("amount")
        if amount_val is not None:
            try:
                amt_float = float(amount_val)
                if amt_float > self.authority_engine.MAX_AUTO_RESOLVE_AMOUNT:
                    amt_formatted = format_currency_vi(amt_float)
                    limit_formatted = format_currency_vi(self.authority_engine.MAX_AUTO_RESOLVE_AMOUNT)
                    return DecisionPipelineResult(
                        decision_type="ESCALATE",
                        reason=f"Số tiền giao dịch {amt_formatted} ({amount_val}) vượt hạn mức tự động tối đa của AI ({limit_formatted}). Bắt buộc phải có phê duyệt của Kế toán trưởng.",
                        escalation_type="AUTHORITY_REQUIRED",
                        target_department="FINANCE",
                        target_role="Kế toán trưởng (Chief Accountant)",
                        question=f"Hồ sơ có số tiền thanh toán {amt_formatted} ({amount_val}) vượt ngưỡng thẩm quyền tối đa của AI ({limit_formatted}). Kính trình Kế toán trưởng kiểm tra đối soát sao kê và ký duyệt."
                    )
            except (ValueError, TypeError):
                pass

        # STEP 3: Check Uncertainty / Blurry Evidence (Safeguard 1: FACT_UNKNOWN)
        uncertainty_res: UncertaintyEvaluationResult = self.uncertainty_engine.evaluate(
            facts, required_fields, case_type=case_type
        )
        if uncertainty_res.has_uncertainty:
            fields_label_str = ", ".join(uncertainty_res.friendly_fields_vi) if uncertainty_res.friendly_fields_vi else ", ".join([get_field_label_vi(f) for f in uncertainty_res.uncertain_fields])
            return DecisionPipelineResult(
                decision_type="ESCALATE",
                reason=uncertainty_res.reason or "Hình ảnh minh chứng không đủ sắc nét để trích xuất dữ kiện phục vụ tự động hóa.",
                escalation_type="FACT_UNKNOWN",
                target_department="STUDENT_SERVICES",
                target_role="Cán bộ Hỗ trợ Sinh viên (Student Support Officer)",
                question=f"Minh chứng tải lên bị mờ hoặc không xác định được các thông tin: {fields_label_str}. Cán bộ vui lòng kiểm tra và gửi yêu cầu sinh viên bổ sung tài liệu rõ nét hơn."
            )

        # STEP 4: Check for Data Conflicts in Comparisons (Safeguard 2: DATA_CONFLICT)
        for comp in comparisons:
            if comp.get("comparison_status") == "MISMATCH":
                field_raw = str(comp.get("field_name") or "")
                field_label = get_field_label_vi(field_raw)
                left_val = comp.get("left_value")
                right_val = comp.get("right_value")
                
                left_display = format_value_vi(field_raw, left_val)
                right_display = format_value_vi(field_raw, right_val)
                
                field_lower = field_raw.lower()
                is_finance = "amount" in field_lower or "payment" in field_lower
                
                return DecisionPipelineResult(
                    decision_type="ESCALATE",
                    reason=f"Phát hiện mâu thuẫn dữ liệu tại mục '{field_label}': Minh chứng thể hiện '{left_display}' ({left_val}) nhưng Hệ thống ghi nhận '{right_display}' ({right_val}).",
                    escalation_type="DATA_CONFLICT",
                    target_department="FINANCE" if is_finance else "ACADEMIC_AFFAIRS",
                    target_role="Chuyên viên Kế toán (Finance Officer)" if is_finance else "Chuyên viên Đào tạo (Academic Officer)",
                    question=f"Mục '{field_label}' thể hiện '{left_display}' (giá trị: {left_val}) trên minh chứng nhưng hệ thống SIS ghi nhận '{right_display}' (giá trị: {right_val}). Cán bộ vui lòng đối soát với sao kê ngân hàng và xác nhận dữ liệu chính xác."
                )

        # STEP 5: Check Policy Engine (Safeguard 3: POLICY_OUT_OF_SCOPE)
        policy_res: PolicyEvaluationResult = self.policy_engine.evaluate(case_type, facts, comparisons)
        if not policy_res.is_applicable:
            case_type_labels = {
                "SPECIAL_PETITION_UNKNOWN": "Đơn kiến nghị đặc thù ngoài danh mục",
                "UNREGISTERED_LEAVE_PETITION": "Đơn xin bảo lưu kết quả học tập đột xuất",
                "REGISTRATION_BLOCK": "Khóa đăng ký tín chỉ học vụ",
            }
            case_label = case_type_labels.get(case_type, case_type)
            return DecisionPipelineResult(
                decision_type="ESCALATE",
                reason=policy_res.reason or f"Tình huống hồ sơ '{case_label}' chưa có quy chế tự động tương ứng trong học vụ.",
                policy_reference=f"{policy_res.policy_code} / {policy_res.rule_code}",
                escalation_type="POLICY_OUT_OF_SCOPE",
                target_department="ACADEMIC_AFFAIRS",
                target_role="Trưởng phòng Quản lý Đào tạo (Head of Academic Affairs)",
                question=f"Tình huống hồ sơ '{case_label}' chưa có quy chế tự động tương ứng trong hệ thống. Đề nghị Cán bộ Lãnh đạo xem xét và quyết định phương án xử lý ngoại lệ theo thẩm quyền."
            )

        # STEP 6: Check Authority Engine for other exceptions (Safeguard 5: AUTHORITY_REQUIRED)
        authority_res: AuthorityEvaluationResult = self.authority_engine.evaluate(case_type, facts, policy_res.rule_action)
        if authority_res.escalation_required:
            return DecisionPipelineResult(
                decision_type="ESCALATE",
                reason=authority_res.reason or "Hồ sơ vượt quá thẩm quyền tự động giải quyết của AI.",
                policy_reference=f"{policy_res.policy_code} / {policy_res.rule_code}",
                escalation_type="AUTHORITY_REQUIRED",
                target_department=authority_res.target_department or "ACADEMIC_AFFAIRS",
                target_role=authority_res.required_role or "Trưởng Đơn vị (Department Head)",
                question=f"Hồ sơ thuộc diện đặc cách yêu cầu cấp có thẩm quyền ({authority_res.required_role}) phê duyệt theo quy chế. Kính trình Lãnh đạo xem xét và ký duyệt."
            )

        # STEP 7: Conclude Auto-Resolve
        if policy_res.rule_action == "AUTO_RESOLVE":
            return DecisionPipelineResult(
                decision_type="AUTO_RESOLVE",
                reason=policy_res.reason or "Dữ liệu minh chứng hợp lệ, đầy đủ và khớp với hệ thống.",
                policy_reference=f"{policy_res.policy_code} / {policy_res.rule_code}"
            )

        return DecisionPipelineResult(
            decision_type="NO_DECISION",
            reason="Không có hành động phù hợp được xác định.",
            policy_reference=f"{policy_res.policy_code} / {policy_res.rule_code}"
        )

