from app.rules.decision_engine import DecisionEngine
def test_verify_dataset_harness_engine():
    engine = DecisionEngine()
    assert engine is not None
