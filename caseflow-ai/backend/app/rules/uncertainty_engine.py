from typing import Dict, Any, List, Optional
from pydantic import BaseModel

FIELD_LABELS_VI: Dict[str, str] = {
    "amount": "Số tiền giao dịch / học phí",
    "student_identifier": "Mã số sinh viên (MSSV)",
    "transaction_id": "Mã giao dịch ngân hàng (TxID)",
    "payment_date": "Ngày chuyển khoản / thanh toán",
    "payment_status": "Trạng thái thanh toán",
    "institution": "Tên ngân hàng / Đơn vị thụ hưởng",
    "reference_number": "Mã tham chiếu hồ sơ",
    "system_status": "Trạng thái trên hệ thống SIS",
    "deadline": "Thời hạn / Hạn chót quy định",
    "course_code": "Mã môn học / Học phần",
    "evidence_text": "Nội dung minh chứng",
    "visual_quality": "Độ rõ nét hình ảnh",
    "document_type": "Loại tài liệu",
    "currency": "Đơn vị tiền tệ",
}

CORE_REQUIRED_FIELDS_BY_CASE: Dict[str, List[str]] = {
    "TUITION_STATUS": ["amount", "student_identifier", "payment_status"],
    "REGISTRATION_BLOCK": ["student_identifier"],
    "SPECIAL_EXEMPTION": ["student_identifier"],
    "CROSS_DEPARTMENT_DISPUTE": ["student_identifier"],
    "INTER_DEPARTMENT_DISPUTE": ["student_identifier"],
    "UNASSIGNED_RESPONSIBILITY": ["student_identifier"],
    "SPECIAL_PETITION_UNKNOWN": ["student_identifier"],
    "UNREGISTERED_LEAVE_PETITION": ["student_identifier"],
    "URGENT_SLA_LETTER": ["student_identifier"],
}

def get_field_label_vi(field: str) -> str:
    return FIELD_LABELS_VI.get(field, field)

class UncertaintyEvaluationResult(BaseModel):
    has_uncertainty: bool
    uncertainty_type: Optional[str] = None
    uncertain_fields: List[str] = []
    reason: Optional[str] = None
    friendly_fields_vi: List[str] = []

class UncertaintyEngine:
    """
    Evaluates evidence quality and information completeness.
    If facts are blurry, missing, or obscured, halts automation.
    """

    def evaluate(
        self,
        facts: Dict[str, Any],
        required_fields: Optional[List[str]] = None,
        case_type: Optional[str] = None
    ) -> UncertaintyEvaluationResult:
        uncertain_fields = list(facts.get("uncertain_fields", []))
        visual_quality = facts.get("visual_quality", "CLEAR")

        # Determine core required fields for this context
        core_fields = required_fields or (CORE_REQUIRED_FIELDS_BY_CASE.get(case_type, []) if case_type else None)

        # 1. Blurry or Unreadable Image Check
        if visual_quality in ["BLURRY", "UNREADABLE"]:
            relevant = [f for f in uncertain_fields if f in (core_fields or ["amount", "transaction_id", "student_identifier"])]
            if not relevant:
                relevant = [f for f in uncertain_fields if f in FIELD_LABELS_VI]
            if not relevant:
                relevant = ["visual_quality"]

            friendly_vi = [get_field_label_vi(f) for f in relevant]
            fields_str = ", ".join(friendly_vi)

            return UncertaintyEvaluationResult(
                has_uncertainty=True,
                uncertainty_type="FACT_UNKNOWN",
                uncertain_fields=relevant,
                friendly_fields_vi=friendly_vi,
                reason=f"Hình ảnh minh chứng quá mờ hoặc bị che khuất, không thể nhận diện trường thông tin: {fields_str}."
            )

        # 2. Check explicitly required fields if provided
        if required_fields:
            missing = [rf for rf in required_fields if facts.get(rf) is None]
            if missing:
                friendly_vi = [get_field_label_vi(f) for f in missing]
                return UncertaintyEvaluationResult(
                    has_uncertainty=True,
                    uncertainty_type="FACT_UNKNOWN",
                    uncertain_fields=missing,
                    friendly_fields_vi=friendly_vi,
                    reason=f"Thiếu các trường thông tin bắt buộc: {', '.join(friendly_vi)}."
                )

        # 3. Check unreadable/obscured fields flagged by extraction engine
        if len(uncertain_fields) > 0:
            # Filter uncertain fields to only those relevant to this case type
            if core_fields and len(core_fields) > 0:
                relevant = [f for f in uncertain_fields if f in core_fields]
            else:
                # If no specific core fields defined, only consider critical fields
                relevant = [f for f in uncertain_fields if f in ["amount", "student_identifier", "transaction_id"]]

            if len(relevant) > 0:
                friendly_vi = [get_field_label_vi(f) for f in relevant]
                return UncertaintyEvaluationResult(
                    has_uncertainty=True,
                    uncertainty_type="FACT_UNKNOWN",
                    uncertain_fields=relevant,
                    friendly_fields_vi=friendly_vi,
                    reason=f"Tồn tại các trường thông tin quan trọng chưa thể xác định chắc chắn: {', '.join(friendly_vi)}."
                )

        return UncertaintyEvaluationResult(
            has_uncertainty=False,
            uncertainty_type=None,
            uncertain_fields=[],
            friendly_fields_vi=[],
            reason=None
        )
