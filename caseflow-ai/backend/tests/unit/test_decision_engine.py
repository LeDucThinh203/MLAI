import pytest
from app.rules.decision_engine import DecisionEngine

def test_decision_engine_pipeline_stops_on_conflict():
    engine = DecisionEngine()
    facts = {
        "visual_quality": "CLEAR",
        "amount": 12500000.0,
        "payment_status": "SUCCESS"
    }
    comparisons = [
        {"field_name": "amount", "left_value": "12500000.0", "right_value": "10500000.0", "comparison_status": "MISMATCH"}
    ]
    res = engine.process("TUITION_STATUS", facts, comparisons)
    assert res.decision_type == "ESCALATE"
    assert res.escalation_type == "DATA_CONFLICT"
    assert res.question is not None and "12500000.0" in res.question

def test_decision_engine_pipeline_auto_resolve():
    engine = DecisionEngine()
    facts = {
        "visual_quality": "CLEAR",
        "amount": 10500000.0,
        "payment_status": "SUCCESS",
        "uncertain_fields": []
    }
    comparisons = [
        {"field_name": "amount", "left_value": "10500000.0", "right_value": "10500000.0", "comparison_status": "MATCH"}
    ]
    res = engine.process("TUITION_STATUS", facts, comparisons)
    assert res.decision_type == "AUTO_RESOLVE"
