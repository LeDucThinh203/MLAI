import pytest
from app.rules.policy_engine import PolicyEngine

def test_policy_engine_tuition_auto_resolve():
    engine = PolicyEngine()
    facts = {
        "student_identifier": "SV2026001",
        "amount": 10500000.0,
        "payment_status": "SUCCESS"
    }
    comparisons = [
        {"field_name": "amount", "comparison_status": "MATCH"}
    ]
    result = engine.evaluate("TUITION_STATUS", facts, comparisons)
    assert result.is_applicable is True
    assert result.rule_action == "AUTO_RESOLVE"
    assert result.rule_code == "RULE-TUIT-001-AUTO"

def test_policy_engine_tuition_conflict():
    engine = PolicyEngine()
    facts = {
        "student_identifier": "SV2026001",
        "amount": 12500000.0,
        "payment_status": "SUCCESS"
    }
    comparisons = [
        {"field_name": "amount", "comparison_status": "MISMATCH"}
    ]
    result = engine.evaluate("TUITION_STATUS", facts, comparisons)
    assert result.is_applicable is True
    assert result.rule_action == "ESCALATE"
    assert result.rule_code == "RULE-TUIT-002-CONFLICT"

def test_policy_engine_out_of_scope():
    engine = PolicyEngine()
    facts = {}
    comparisons = []
    result = engine.evaluate("UNKNOWN_PETITION_TYPE", facts, comparisons)
    assert result.is_applicable is False
    assert result.rule_action == "ESCALATE"
