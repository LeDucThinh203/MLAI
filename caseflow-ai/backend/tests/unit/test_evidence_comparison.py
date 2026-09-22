import pytest
from app.services.evidence_comparison_service import EvidenceComparisonService

def test_evidence_comparison_detects_mismatch():
    service = EvidenceComparisonService()
    extracted = {"amount": "12500000", "student_identifier": "SV01"}
    system = {"amount": "10500000", "student_identifier": "SV01"}
    
    comparisons = service.compare_facts("case-123", extracted, system)
    amount_comp = next((c for c in comparisons if c.field_name == "amount"), None)
    student_comp = next((c for c in comparisons if c.field_name == "student_identifier"), None)

    assert amount_comp is not None
    assert amount_comp.comparison_status == "MISMATCH"
    assert student_comp is not None
    assert student_comp.comparison_status == "MATCH"


def test_evidence_comparison_matches_equivalent_monetary_formats():
    service = EvidenceComparisonService()

    comparisons = service.compare_facts(
        "case-8200000",
        {"amount": "8200000"},
        {"amount": "8200000.00"},
    )

    assert comparisons[0].comparison_status == "MATCH"
