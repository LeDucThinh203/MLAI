"""Shared workflow labels and deterministic presentation text."""
from app.core.constants import CaseStatus, EscalationType


ESCALATION_SUMMARIES = {
    EscalationType.FACT_UNKNOWN: "Minh chứng ảnh bị mờ hoặc không đủ dữ liệu trường bắt buộc để nhận diện.",
    EscalationType.DATA_CONFLICT: "Phát hiện sai lệch giữa số liệu trên minh chứng và dữ liệu ghi nhận tại hệ thống SIS.",
    EscalationType.POLICY_OUT_OF_SCOPE: "Tình huống hồ sơ thuộc diện chính sách ngoại lệ chưa có tiền lệ tự động trong quy chế.",
    EscalationType.OWNERSHIP_UNCLEAR: "Hồ sơ có sự tranh chấp phân định trách nhiệm tiếp nhận giữa các phòng ban.",
    EscalationType.AUTHORITY_REQUIRED: "Giá trị giao dịch hoặc tính chất hồ sơ vượt hạn mức thẩm quyền quyết định tự động của AI.",
}


def escalation_summary(escalation_type: str | None) -> str:
    """Return the Vietnamese explanation used in an escalation record."""
    try:
        return ESCALATION_SUMMARIES[EscalationType(escalation_type or "")]
    except ValueError:
        return f"Dừng tự động và leo thang: {escalation_type or 'không xác định'}."


FINAL_CASE_STATUSES = {CaseStatus.AUTO_RESOLVED, CaseStatus.APPROVED, CaseStatus.REJECTED}
