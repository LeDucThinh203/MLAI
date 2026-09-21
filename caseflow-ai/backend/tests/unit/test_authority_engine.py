import pytest
from app.rules.authority_engine import AuthorityEngine

def test_authority_engine_normal_amount():
    engine = AuthorityEngine()
    facts = {"amount": 10500000.0}
    res = engine.evaluate("TUITION_STATUS", facts, "AUTO_RESOLVE")
    assert res.is_authorized_for_ai is True
    assert res.escalation_required is False

def test_authority_engine_excessive_amount():
    engine = AuthorityEngine()
    facts = {"amount": 100_000_000.0}  # Exceeds 50M limit
    res = engine.evaluate("TUITION_STATUS", facts, "AUTO_RESOLVE")
    assert res.is_authorized_for_ai is False
    assert res.escalation_required is True
    assert res.required_role == "Finance Chief Accountant"

def test_authority_engine_special_case():
    engine = AuthorityEngine()
    facts = {}
    res = engine.evaluate("SPECIAL_EXEMPTION", facts, "AUTO_RESOLVE")
    assert res.is_authorized_for_ai is False
    assert res.escalation_required is True
