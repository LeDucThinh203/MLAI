from typing import Dict, Any, List, Optional
from app.models.evidence_comparison import EvidenceComparison

class EvidenceComparisonService:
    """
    Compares extracted facts against system records or between multiple uploaded evidence items.
    Detects DATA_CONFLICT without taking sides.
    """

    def compare_facts(
        self,
        case_id: str,
        extracted_facts: Dict[str, Any],
        system_records: Dict[str, Any],
        left_evidence_id: Optional[str] = None
    ) -> List[EvidenceComparison]:
        comparisons: List[EvidenceComparison] = []

        fields_to_compare = ["amount", "student_identifier", "transaction_id", "payment_status"]

        for field in fields_to_compare:
            if field in extracted_facts and field in system_records:
                left_val = str(extracted_facts.get(field)) if extracted_facts.get(field) is not None else None
                right_val = str(system_records.get(field)) if system_records.get(field) is not None else None

                if left_val is None or right_val is None:
                    status = "UNKNOWN"
                    reason = f"Trường {field} không có đủ dữ liệu từ cả 2 nguồn để so sánh."
                elif left_val.strip().lower() == right_val.strip().lower():
                    status = "MATCH"
                    reason = f"Dữ liệu trường {field} khớp hoàn toàn."
                else:
                    status = "MISMATCH"
                    reason = f"Phát hiện mâu thuẫn: Minh chứng ghi '{left_val}' nhưng Hệ thống ghi '{right_val}'."

                comparisons.append(EvidenceComparison(
                    case_id=case_id,
                    left_evidence_id=left_evidence_id,
                    right_evidence_id=None,
                    field_name=field,
                    left_value=left_val,
                    right_value=right_val,
                    comparison_status=status,
                    reason=reason
                ))

        return comparisons
