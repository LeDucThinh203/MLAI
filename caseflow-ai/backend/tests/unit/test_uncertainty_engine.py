import pytest
from app.rules.uncertainty_engine import UncertaintyEngine

def test_uncertainty_blurry_evidence():
    engine = UncertaintyEngine()
    facts = {
        "visual_quality": "BLURRY",
        "uncertain_fields": ["amount", "transaction_id"]
    }
    res = engine.evaluate(facts)
    assert res.has_uncertainty is True
    assert res.uncertainty_type == "FACT_UNKNOWN"

def test_uncertainty_missing_required_fields():
    engine = UncertaintyEngine()
    facts = {
        "visual_quality": "CLEAR",
        "amount": None
    }
    res = engine.evaluate(facts, required_fields=["amount", "student_identifier"])
    assert res.has_uncertainty is True
    assert "amount" in res.uncertain_fields

def test_uncertainty_clear_evidence():
    engine = UncertaintyEngine()
    facts = {
        "visual_quality": "CLEAR",
        "amount": 10500000.0,
        "student_identifier": "SV2026001",
        "uncertain_fields": []
    }
    res = engine.evaluate(facts, required_fields=["amount", "student_identifier"])
    assert res.has_uncertainty is False


def test_tuition_missing_payment_status_is_fact_unknown():
    engine = UncertaintyEngine()
    result = engine.evaluate(
        {"amount": 8200000, "student_identifier": "SV001", "visual_quality": "CLEAR"},
        case_type="TUITION_STATUS",
    )
    assert result.has_uncertainty is True
    assert result.uncertainty_type == "FACT_UNKNOWN"
    assert "payment_status" in result.uncertain_fields
