import pytest
from app.schemas.evidence_extraction import EvidenceExtractionResult

def test_evidence_extraction_result_valid_parsing():
    sample_data = {
        "document_type": "RECEIPT",
        "student_identifier": "SV2026-999",
        "transaction_id": "FT-2026-001",
        "amount": 12500000.0,
        "currency": "VND",
        "payment_date": "2026-09-20",
        "payment_status": "SUCCESS",
        "institution": "Techcombank",
        "uncertain_fields": [],
        "visual_quality": "CLEAR"
    }
    result = EvidenceExtractionResult(**sample_data)
    assert result.document_type == "RECEIPT"
    assert result.amount == 12500000.0
    assert result.visual_quality == "CLEAR"
