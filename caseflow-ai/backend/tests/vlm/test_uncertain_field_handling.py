import pytest
from app.schemas.evidence_extraction import EvidenceExtractionResult

def test_uncertain_field_handling_null_with_uncertain_list():
    sample_blurry_data = {
        "document_type": "RECEIPT",
        "student_identifier": None,  # unreadable
        "amount": None,              # blurry
        "uncertain_fields": ["student_identifier", "amount"],
        "visual_quality": "BLURRY",
        "notes": "Text obscured by water damage."
    }
    result = EvidenceExtractionResult(**sample_blurry_data)
    assert result.amount is None
    assert "amount" in result.uncertain_fields
    assert "student_identifier" in result.uncertain_fields
    assert result.visual_quality == "BLURRY"
