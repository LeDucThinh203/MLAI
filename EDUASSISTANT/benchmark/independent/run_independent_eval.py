"""Evaluate a supplied, frozen independent dataset without AI or database access."""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CASES_FILE = Path(__file__).resolve().parent / 'cases.json'
DEFAULT_RESULTS_DIR = Path(__file__).resolve().parent / 'results'
ALLOWED_DECISIONS = {'AUTO_APPROVE', 'ESCALATE_TO_HUMAN'}
OPAQUE_ID = re.compile(r'^[A-Za-z0-9._-]{1,100}$')
RESULT_METRIC_FIELDS = (
    'totalCases', 'correctCases', 'decisionAccuracy', 'automationRate',
    'escalationRate', 'expectedEscalations', 'missedEscalationCount',
    'missedEscalationRate', 'expectedAutoApprovals',
    'unnecessaryEscalationCount', 'unnecessaryEscalationRate',
)

sys.path.insert(0, str(PROJECT_ROOT / 'backend'))
from app.services.rule_engine import evaluate_case  # noqa: E402
from benchmark.run_benchmark import build_evaluation_input  # noqa: E402


def _parse_timestamp(value: Any, field: str) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'Manifest field {field} must be an ISO-8601 timestamp.')
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as exc:
        raise ValueError(f'Manifest field {field} must be an ISO-8601 timestamp.') from exc
    if parsed.tzinfo is None:
        raise ValueError(f'Manifest field {field} must include a timezone.')
    return parsed.astimezone(timezone.utc)


def validate_manifest(dataset: Any) -> list[dict[str, Any]]:
    if not isinstance(dataset, dict):
        raise ValueError('Independent dataset must be a JSON object.')
    for field in ('datasetId', 'version', 'createdBy', 'sourceDescription'):
        if not isinstance(dataset.get(field), str) or not dataset[field].strip():
            raise ValueError(f'Manifest field {field} is required.')
    created_at = _parse_timestamp(dataset.get('createdAt'), 'createdAt')
    frozen_at = _parse_timestamp(dataset.get('frozenAt'), 'frozenAt')
    now = datetime.now(timezone.utc)
    if created_at > frozen_at:
        raise ValueError('frozenAt must be on or after createdAt.')
    if frozen_at > now:
        raise ValueError('The independent dataset must be frozen before evaluation.')
    if dataset.get('developmentTeamDidNotTuneOnThisSet') is not True:
        raise ValueError('developmentTeamDidNotTuneOnThisSet must be true.')

    cases = dataset.get('cases')
    if not isinstance(cases, list) or not cases:
        raise ValueError('Independent dataset must contain at least one frozen case.')
    seen_ids: set[str] = set()
    required_case_fields = ('id', 'title', 'description', 'category', 'priority', 'expectedDecision')
    for index, case in enumerate(cases, start=1):
        if not isinstance(case, dict):
            raise ValueError(f'Case {index} must be a JSON object.')
        for field in required_case_fields:
            if field not in case:
                raise ValueError(f'Case {index} is missing {field}.')
        case_id = case['id']
        if not isinstance(case_id, str) or not OPAQUE_ID.fullmatch(case_id) or case_id in seen_ids:
            raise ValueError(f'Case {index} must have a unique, non-empty opaque id.')
        seen_ids.add(case_id)
        if not isinstance(case['expectedDecision'], str) or case['expectedDecision'] not in ALLOWED_DECISIONS:
            raise ValueError(f'Case {case_id} has an unsupported expectedDecision.')
        reason = case.get('expectedEscalationReason')
        if reason is not None and not isinstance(reason, str):
            raise ValueError(f'Case {case_id} expectedEscalationReason must be a string or null.')
    return cases


def _rate(numerator: int, denominator: int) -> float:
    return round(numerator / denominator * 100, 2) if denominator else 0.0


def _score_case(expected_decision: str, actual_decision: str,
                expected_reason: str | None, actual_reason: str | None) -> tuple[bool, bool | None]:
    decision_correct = actual_decision == expected_decision
    reason_matches = None if expected_reason is None else actual_reason == expected_reason
    return decision_correct, reason_matches


def run_independent_eval(
    cases_file: Path = DEFAULT_CASES_FILE,
    results_dir: Path = DEFAULT_RESULTS_DIR,
    *,
    require_data: bool = False,
) -> tuple[dict[str, Any], int]:
    cases_file = Path(cases_file)
    results_dir = Path(results_dir)
    if not cases_file.is_file():
        result = {'status': 'PENDING', 'message': 'INDEPENDENT_EVALUATION_PENDING'}
        return result, 2 if require_data else 0

    with cases_file.open('r', encoding='utf-8') as source:
        manifest = json.load(source)
    cases = validate_manifest(manifest)

    started_at = datetime.now(timezone.utc)
    started = time.perf_counter()
    correct = auto_approved = escalated = 0
    expected_escalations = missed_escalations = 0
    expected_auto_approvals = unnecessary_escalations = 0
    case_results: list[dict[str, Any]] = []

    for case in cases:
        case_started = time.perf_counter()
        payload, student_user, ocr_data, ai_context, evaluation_context = build_evaluation_input(case)
        verdict = evaluate_case(
            payload,
            ocr_data,
            student_user,
            ai_context=ai_context,
            evaluation_context=evaluation_context,
        )
        actual = verdict.get('decision')
        expected = case['expectedDecision']
        actual_reason = verdict.get('escalationReason')
        expected_reason = case.get('expectedEscalationReason')
        decision_correct, reason_matches = _score_case(
            expected, actual, expected_reason, actual_reason)
        correct += int(decision_correct)
        auto_approved += int(actual == 'AUTO_APPROVE')
        escalated += int(actual == 'ESCALATE_TO_HUMAN')
        if expected == 'ESCALATE_TO_HUMAN':
            expected_escalations += 1
            missed_escalations += int(actual == 'AUTO_APPROVE')
        if expected == 'AUTO_APPROVE':
            expected_auto_approvals += 1
            unnecessary_escalations += int(actual == 'ESCALATE_TO_HUMAN')
        case_results.append({
            'id': case['id'],
            'expectedDecision': expected,
            'actualDecision': actual,
            'expectedReason': expected_reason,
            'actualReason': actual_reason,
            'decisionCorrect': decision_correct,
            'reasonMatched': reason_matches,
            'ruleMatched': verdict.get('ruleMatched'),
            'pass': decision_correct,
            'durationMs': round((time.perf_counter() - case_started) * 1000, 2),
        })

    total = len(cases)
    metrics = {
        'totalCases': total,
        'correctCases': correct,
        'decisionAccuracy': _rate(correct, total),
        'automationRate': _rate(auto_approved, total),
        'escalationRate': _rate(escalated, total),
        'expectedEscalations': expected_escalations,
        'missedEscalationCount': missed_escalations,
        'missedEscalationRate': _rate(missed_escalations, expected_escalations),
        'expectedAutoApprovals': expected_auto_approvals,
        'unnecessaryEscalationCount': unnecessary_escalations,
        'unnecessaryEscalationRate': _rate(unnecessary_escalations, expected_auto_approvals),
    }
    result = {
        'status': 'VERIFIED',
        'benchmarkType': 'INDEPENDENT_FROZEN_TRACK_A_EVALUATION',
        'datasetId': manifest['datasetId'],
        'datasetVersion': manifest['version'],
        'datasetFrozenAt': manifest['frozenAt'],
        'aiCallsPerformed': False,
        'networkCallsPerformed': False,
        'databaseWritesPerformed': False,
        'runId': f"IND-{uuid.uuid4().hex}",
        'timestamp': started_at.isoformat().replace('+00:00', 'Z'),
        'durationMs': round((time.perf_counter() - started) * 1000, 2),
        'metrics': metrics,
        'results': case_results,
    }

    results_dir.mkdir(parents=True, exist_ok=True)
    with (results_dir / 'latest.json').open('w', encoding='utf-8') as target:
        json.dump(result, target, ensure_ascii=False, indent=2)
    with (results_dir / 'latest.csv').open('w', encoding='utf-8-sig', newline='') as target:
        writer = csv.DictWriter(target, fieldnames=(
            'id', 'expectedDecision', 'actualDecision', 'expectedReason',
            'actualReason', 'decisionCorrect', 'reasonMatched', 'ruleMatched',
            'pass', 'durationMs',
        ))
        writer.writeheader()
        writer.writerows(case_results)
    return result, 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--require-data', action='store_true',
        help='Exit with status 2 while cases.json is absent.',
    )
    args = parser.parse_args(argv)
    try:
        result, exit_code = run_independent_eval(require_data=args.require_data)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f'Independent evaluation input error: {exc}', file=sys.stderr)
        return 1
    if result.get('status') == 'PENDING':
        print(result['message'])
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return exit_code


if __name__ == '__main__':
    raise SystemExit(main())
