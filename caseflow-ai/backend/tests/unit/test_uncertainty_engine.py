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
