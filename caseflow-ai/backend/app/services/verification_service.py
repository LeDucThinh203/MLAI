import json
import os
import time
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.repositories.verification_repository import VerificationRepository
from app.models.verification_run import VerificationRun
from app.models.verification_result import VerificationResult
from app.rules.decision_engine import DecisionEngine, DecisionPipelineResult

class VerificationService:
    """
    Test and verification harness service. Runs test cases through actual
    decision and rule evaluation logic without hardcoded outcomes.
    """

    def __init__(self, db: Session):
        self.db = db
        self.repo = VerificationRepository(db)
        self.decision_engine = DecisionEngine()

    async def run_all_tests(self, test_data_path: str = "test-data/sprint1") -> VerificationRun:
        start_time = time.time()
        run_code = f"VRUN-{time.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

        run = VerificationRun(
            run_code=run_code,
            status="RUNNING",
            total_cases=0,
            passed_cases=0,
            failed_cases=0,
            duration_ms=0
        )
        self.repo.create_run(run)

        # Robustly locate test_data directory
        candidate_dirs = [
            test_data_path,
            os.path.join("..", test_data_path),
            os.path.abspath("test-data/sprint1"),
            os.path.abspath("../test-data/sprint1"),
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "test-data", "sprint1"),
        ]
        resolved_dir = test_data_path
        for cd in candidate_dirs:
            if os.path.isdir(cd):
                resolved_dir = cd
                break

        # Load cases from test-data
        test_files = [
            "verify_cases.json",
            "escalation_cases.json",
            "vlm_cases.json",
            "independent_cases.json"
        ]

        all_test_cases: List[Dict[str, Any]] = []
        for tf in test_files:
            file_path = os.path.join(resolved_dir, tf)
            if os.path.exists(file_path):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, list):
                            all_test_cases.extend(data)
                except Exception:
                    pass

        total = len(all_test_cases)
        passed = 0
        failed = 0

        for case_def in all_test_cases:
            case_start = time.time()
            case_id = case_def.get("id", "UNKNOWN")
            title = case_def.get("title", "Untitled Case")
            case_type = case_def.get("case_type", "TUITION_STATUS")
            facts = case_def.get("facts", {})
            comparisons = case_def.get("comparisons", [])
            expected_decision = case_def.get("expected_decision", "AUTO_RESOLVE")
            expected_escalation = case_def.get("expected_escalation")

            # RUN ACTUAL LOGIC THROUGH DECISION ENGINE
            result: DecisionPipelineResult = self.decision_engine.process(
                case_type=case_type,
                facts=facts,
                comparisons=comparisons
            )

            actual_decision = result.decision_type
            actual_escalation = result.escalation_type

            # Check correctness
            decision_match = (actual_decision == expected_decision)
            escalation_match = (expected_escalation is None or expected_escalation == actual_escalation)
            is_passed = decision_match and escalation_match

            if is_passed:
                passed += 1
            else:
                failed += 1

            case_duration = int((time.time() - case_start) * 1000)

            v_result = VerificationResult(
                run_id=run.id,
                case_identifier=case_id,
                case_title=title,
                expected_decision=expected_decision,
                actual_decision=actual_decision,
                expected_escalation=expected_escalation,
                actual_escalation=actual_escalation,
                is_passed=is_passed,
                duration_ms=case_duration,
                details_json=json.dumps({
                    "reason": result.reason,
                    "policy_ref": result.policy_reference,
                    "question": result.question
                }, ensure_ascii=False)
            )
            self.repo.add_result(v_result)

        total_duration = int((time.time() - start_time) * 1000)
        run.status = "COMPLETED"
        run.total_cases = total
        run.passed_cases = passed
        run.failed_cases = failed
        run.duration_ms = total_duration
        self.repo.update_run(run)

        return run

    def list_runs(self) -> List[VerificationRun]:
        return self.repo.list_runs()

    def get_run(self, run_id: str) -> Optional[VerificationRun]:
        return self.repo.get_run_by_id(run_id)
