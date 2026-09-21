import asyncio
import os
import sys

# Ensure UTF-8 output on Windows console
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", ".env")))

from app.ai.vision.gemini_vlm_provider import GeminiVLMProvider
from app.services.evidence_comparison_service import EvidenceComparisonService
from app.rules.decision_engine import DecisionEngine

async def run_scenario(scenario_name: str, receipt_filename: str, student_id: str, sis_amount: float):
    print(f"\n=======================================================")
    print(f"RUNNING SCENARIO: {scenario_name}")
    print(f"=======================================================")
    provider = GeminiVLMProvider()
    comparison_service = EvidenceComparisonService()
    decision_engine = DecisionEngine()
    
    # 1. Live VLM extraction
    fpath = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "test-data", "evidence", receipt_filename))
    extracted = await provider.extract_structured_evidence(fpath, "image/png", "RECEIPT")
    extracted_facts = extracted.model_dump()
    print(f"VLM Extracted Facts:")
    print(f"  - Amount: {extracted.amount}")
    print(f"  - Student ID: {extracted.student_identifier}")
    print(f"  - Quality: {extracted.visual_quality}")
    print(f"  - Uncertain fields: {extracted.uncertain_fields}")

    # 2. System Records (Mock SIS)
    sis_records = {
        "student_identifier": student_id,
        "amount": sis_amount,
        "system_status": "UNPAID",
        "transaction_id": extracted.transaction_id or "SYS-NONE"
    }

    # 3. Evidence Comparison
    comparisons = comparison_service.compare_facts(
        case_id="TEST-CASE",
        extracted_facts=extracted_facts,
        system_records=sis_records
    )
    comp_dicts = [
        {
            "field_name": c.field_name,
            "left_value": c.left_value,
            "right_value": c.right_value,
            "comparison_status": c.comparison_status,
            "reason": c.reason
        }
        for c in comparisons
    ]
    print(f"Comparisons performed ({len(comp_dicts)} fields):")
    for c in comp_dicts:
        print(f"  [{c['field_name']}]: Evidence='{c['left_value']}' vs SIS='{c['right_value']}' -> {c['comparison_status']}")

    # 4. Deterministic Decision Pipeline (Policy -> Uncertainty -> Authority -> Decision)
    result = decision_engine.process(
        case_type="TUITION_STATUS",
        facts=extracted_facts,
        comparisons=comp_dicts,
        required_fields=["amount", "student_identifier"]
    )

    print(f"\nFINAL REFEREE DECISION:")
    print(f"  Decision Type:    {result.decision_type}")
    print(f"  Escalation Type:  {result.escalation_type}")
    print(f"  Target Role:      {result.target_role}")
    print(f"  Target Dept:      {result.target_department}")
    print(f"  Reason:           {result.reason}")
    print(f"  Human Question:   {result.question}")
    return result

async def main():
    # Scenario 1: Clean Match -> AUTO_RESOLVE
    res1 = await run_scenario(
        scenario_name="CASE 1: BIEN LAI KHOP 100% VOI HE THONG",
        receipt_filename="receipt_clear.png",
        student_id="SV2026-001",
        sis_amount=10500000.0
    )
    assert res1.decision_type == "AUTO_RESOLVE", f"Expected AUTO_RESOLVE, got {res1.decision_type}"

    # Scenario 2: Data Conflict (12.5M vs 10.5M) -> ESCALATE (DATA_CONFLICT)
    res2 = await run_scenario(
        scenario_name="CASE 2: LECH SO TIEN BIEN LAI VS HE THONG",
        receipt_filename="receipt_conflict.png",
        student_id="SV2026-002",
        sis_amount=10500000.0
    )
    assert res2.decision_type == "ESCALATE", f"Expected ESCALATE, got {res2.decision_type}"
    assert res2.escalation_type == "DATA_CONFLICT", f"Expected DATA_CONFLICT, got {res2.escalation_type}"

    # Scenario 3: Blurry Evidence -> ESCALATE (FACT_UNKNOWN)
    res3 = await run_scenario(
        scenario_name="CASE 3: BIEN LAI MO KHONG DOC DUOC",
        receipt_filename="receipt_blurry.png",
        student_id="SV2026-003",
        sis_amount=10500000.0
    )
    assert res3.decision_type == "ESCALATE", f"Expected ESCALATE, got {res3.decision_type}"
    assert res3.escalation_type == "FACT_UNKNOWN", f"Expected FACT_UNKNOWN, got {res3.escalation_type}"

    print("\n=======================================================")
    print("ALL 3 CORE SCENARIOS PASSED WITH LIVE GEMINI VLM & DETERMINISTIC RULES!")
    print("=======================================================")

if __name__ == "__main__":
    asyncio.run(main())
