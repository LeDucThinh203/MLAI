"""Run the manually frozen Track A holdout with the deterministic Rule Engine only.

This command is intentionally outside routine CI. It reads the static dataset,
checks its exact SHA-256 against the frozen manifest before evaluation, and
writes aggregate and per-case results under ``benchmark/holdout/results``.
It does not call AI, network services, application routes, or a database.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_HOLDOUT_DIR = PROJECT_ROOT / 'benchmark' / 'holdout'
DEFAULT_DATASET = DEFAULT_HOLDOUT_DIR / 'track_a_holdout_v1.json'
DEFAULT_MANIFEST = DEFAULT_HOLDOUT_DIR / 'manifest.json'
DEFAULT_RESULTS_DIR = DEFAULT_HOLDOUT_DIR / 'results'
ALLOWED_DECISIONS = {'AUTO_APPROVE', 'ESCALATE_TO_HUMAN'}
ALLOWED_REASONS = {
    'OWNERSHIP_UNCLEAR', 'FACT_UNKNOWN', 'DATA_CONFLICT',
    'AUTHORITY_REQUIRED', 'POLICY_OUT_OF_SCOPE',
}

sys.path.insert(0, str(PROJECT_ROOT / 'backend'))
from app.services.rule_engine import evaluate_case  # noqa: E402


def load_frozen_cases(
    dataset_path: Path = DEFAULT_DATASET,
    manifest_path: Path = DEFAULT_MANIFEST,
) -> tuple[dict[str, Any], list[dict[str, Any]], str]:
    """Verify the manifest and raw dataset bytes before returning any cases."""
    dataset_path = Path(dataset_path)
    manifest_path = Path(manifest_path)
    dataset_bytes = dataset_path.read_bytes()
    dataset_sha256 = hashlib.sha256(dataset_bytes).hexdigest()

    with manifest_path.open('r', encoding='utf-8') as source:
        manifest = json.load(source)
    if not isinstance(manifest, dict):
        raise ValueError('Holdout manifest must be a JSON object.')
    if manifest.get('dataset') != dataset_path.name:
        raise ValueError('Manifest dataset name does not match the selected dataset file.')
    if manifest.get('frozen') is not True:
        raise ValueError('Holdout manifest must declare frozen=true.')
    for field in ('usedByRuntime', 'usedByTraining', 'usedByUnitTests'):
        if manifest.get(field) is not False:
            raise ValueError(f'Manifest field {field} must be false.')
    expected_sha256 = manifest.get('sha256')
    if not isinstance(expected_sha256, str) or expected_sha256.lower() != dataset_sha256:
        raise ValueError('Frozen holdout SHA-256 does not match manifest; evaluation stopped.')

    try:
        cases = json.loads(dataset_bytes.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError('Frozen holdout must be valid UTF-8 JSON.') from exc
    if not isinstance(cases, list) or not cases:
        raise ValueError('Frozen holdout must contain at least one scenario.')
    if manifest.get('scenarioCount') != len(cases):
        raise ValueError('Manifest scenarioCount does not match the frozen dataset.')

    seen_ids: set[str] = set()
    required_fields = ('id', 'name', 'scenarioGroup', 'expectedDecision', 'expectedEscalationReason')
    for index, case in enumerate(cases, start=1):
        if not isinstance(case, dict):
            raise ValueError(f'Holdout scenario {index} must be a JSON object.')
        missing = [field for field in required_fields if field not in case]
        if missing:
            raise ValueError(f'Holdout scenario {index} is missing: {", ".join(missing)}.')
        case_id = case['id']
        if not isinstance(case_id, str) or not case_id.strip() or case_id in seen_ids:
            raise ValueError(f'Holdout scenario {index} must have a unique, non-empty id.')
        seen_ids.add(case_id)
        expected = case['expectedDecision']
        reason = case['expectedEscalationReason']
        if expected not in ALLOWED_DECISIONS:
            raise ValueError(f'Holdout scenario {case_id} has an unsupported expectedDecision.')
        if expected == 'AUTO_APPROVE' and reason not in (None, ''):
            raise ValueError(f'Holdout scenario {case_id}: AUTO_APPROVE must have no escalation reason.')
        if expected == 'ESCALATE_TO_HUMAN' and reason not in ALLOWED_REASONS:
            raise ValueError(f'Holdout scenario {case_id} must declare a valid escalation reason.')
    return manifest, cases, dataset_sha256


def _evaluation_inputs(case: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], None, dict[str, Any], dict[str, Any]]:
    """Create explicitly synthetic test inputs without consulting runtime data."""
    institutional_facts = dict(case.get('institutionalFacts') or {})
    institutional_facts['sourceType'] = 'SYNTHETIC_TEST_SIS'
    institutional_facts['verificationStatus'] = 'TEST_VERIFIED'
    student_user = dict(institutional_facts)
    ai_metadata = dict(case.get('aiMetadata') or {})
    ai_context = {
        'modeUsed': ai_metadata.get('modeUsed', 'fixture'),
        'isLive': ai_metadata.get('isLive', False),
        'isFallback': ai_metadata.get('isFallback', ai_metadata.get('fallbackOccurred', False)),
        'isSynthetic': ai_metadata.get('isSynthetic', True),
        'provider': ai_metadata.get('provider', 'FIXED_TEST_FIXTURE'),
        'apiCallPerformed': ai_metadata.get('apiCallPerformed', False),
        'source': 'FROZEN_HOLDOUT_FIXTURE',
    }
    evaluation_context = {
        'evaluationMode': 'DETERMINISTIC_TEST',
        'allowSyntheticVerifiedInstitutionalFacts': True,
        'allowSyntheticAIAnalysis': True,
    }
    payload = {
        'id': case['id'],
        'title': case['name'],
        'description': case.get('description', case['name']),
        'category': 'MILITARY_SERVICE_CONFIRMATION',
        'priority': 'MEDIUM',
        'evidenceFiles': [],
        'aiMetadata': ai_metadata,
        'studentClaim': dict(case.get('studentClaim') or {}),
        'institutionalFacts': institutional_facts,
        'authoritativeInstitutionalFacts': institutional_facts,
        'addressAnalysis': dict(case.get('addressAnalysis') or {}),
    }
    return payload, student_user, None, ai_context, evaluation_context


def _rate(numerator: int, denominator: int) -> float:
    return round(numerator / denominator * 100, 2) if denominator else 0.0


def run_holdout_eval(
    dataset_path: Path = DEFAULT_DATASET,
    manifest_path: Path = DEFAULT_MANIFEST,
    results_dir: Path = DEFAULT_RESULTS_DIR,
) -> dict[str, Any]:
    manifest, cases, dataset_sha256 = load_frozen_cases(dataset_path, manifest_path)
    started_at = datetime.now(timezone.utc)
    started = time.perf_counter()
    correct = auto_approved = escalated = 0
    expected_escalations = missed_escalations = 0
    expected_auto_approvals = unnecessary_escalations = 0
    case_results: list[dict[str, Any]] = []

    for case in cases:
        case_started = time.perf_counter()
        payload, student_user, ocr_data, ai_context, evaluation_context = _evaluation_inputs(case)
        verdict = evaluate_case(
            payload,
            ocr_data,
            student_user,
            ai_context=ai_context,
            evaluation_context=evaluation_context,
        )
        actual_decision = verdict.get('decision')
        actual_reason = verdict.get('escalationReason')
        expected_decision = case['expectedDecision']
        expected_reason = case['expectedEscalationReason']
        reason_matches = expected_reason in (None, '') or actual_reason == expected_reason
        is_correct = actual_decision == expected_decision and reason_matches
        correct += int(is_correct)
        auto_approved += int(actual_decision == 'AUTO_APPROVE')
        escalated += int(actual_decision == 'ESCALATE_TO_HUMAN')

        if expected_decision == 'ESCALATE_TO_HUMAN':
            expected_escalations += 1
            missed_escalations += int(actual_decision == 'AUTO_APPROVE')
        elif expected_decision == 'AUTO_APPROVE':
            expected_auto_approvals += 1
            unnecessary_escalations += int(actual_decision == 'ESCALATE_TO_HUMAN')

        case_results.append({
            'id': case['id'],
            'scenarioGroup': case['scenarioGroup'],
            'expectedDecision': expected_decision,
            'actualDecision': actual_decision,
            'expectedReason': expected_reason,
            'actualReason': actual_reason,
            'isCorrect': is_correct,
            'ruleMatched': verdict.get('ruleMatched'),
            'durationMs': round((time.perf_counter() - case_started) * 1000, 2),
        })

    total = len(cases)
    result = {
        'status': 'COMPLETED',
        'benchmarkType': 'FROZEN_TRACK_A_HOLDOUT_EVALUATION',
        'dataset': manifest['dataset'],
        'datasetVersion': manifest['version'],
        'datasetSha256': dataset_sha256,
        'scenarioCount': total,
        'decisionAccuracy': _rate(correct, total),
        'automationRate': _rate(auto_approved, total),
        'escalationRate': _rate(escalated, total),
        'missedEscalationRate': _rate(missed_escalations, expected_escalations),
        'unnecessaryEscalationRate': _rate(unnecessary_escalations, expected_auto_approvals),
        'expectedEscalations': expected_escalations,
        'missedEscalationCount': missed_escalations,
        'expectedAutoApprovals': expected_auto_approvals,
        'unnecessaryEscalationCount': unnecessary_escalations,
        'executionTimeSec': round(time.perf_counter() - started, 3),
        'timestamp': started_at.isoformat().replace('+00:00', 'Z'),
        'aiCallsPerformed': False,
        'networkCallsPerformed': False,
        'databaseWritesPerformed': False,
        'thresholdMutationPerformed': False,
        'caseResults': case_results,
    }

    results_dir = Path(results_dir)
    results_dir.mkdir(parents=True, exist_ok=True)
    with (results_dir / 'latest.json').open('w', encoding='utf-8', newline='\n') as target:
        json.dump(result, target, ensure_ascii=False, indent=2)
        target.write('\n')
    with (results_dir / 'latest.csv').open('w', encoding='utf-8-sig', newline='') as target:
        writer = csv.DictWriter(target, fieldnames=(
            'id', 'scenarioGroup', 'expectedDecision', 'actualDecision',
            'expectedReason', 'actualReason', 'isCorrect', 'ruleMatched', 'durationMs',
        ))
        writer.writeheader()
        writer.writerows(case_results)
    return result


def main() -> int:
    try:
        result = run_holdout_eval()
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f'Frozen holdout evaluation stopped: {exc}', file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
