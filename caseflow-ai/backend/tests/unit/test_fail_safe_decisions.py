from app.rules.decision_engine import DecisionEngine


def test_uncertain_high_value_never_uses_amount_for_authority_decision():
    result = DecisionEngine().process(
        "TUITION_STATUS",
        {"amount": 85_000_000, "visual_quality": "BLURRY", "uncertain_fields": ["amount"]},
        [],
    )

    assert result.decision_type == "ESCALATE"
    assert result.escalation_type == "FACT_UNKNOWN"
