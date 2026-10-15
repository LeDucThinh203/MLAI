"""Run the final local preflight without touching production services or data."""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Sequence

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CRITICAL_TESTS = (
    'test/test_agent_planner.py',
    'test/test_agent_hardening.py',
    'test/test_agent_tools.py',
    'test/test_agent_tool_privacy.py',
    'test/test_agent_rag.py',
    'test/test_agent_security.py',
    'test/test_student_agent_only.py',
    'test/test_agent_conversation_delete.py',
    'test/test_agent_attachment.py',
    'test/test_production_safety.py',
    'test/test_rule_engine_hardening.py',
    'test/test_judge_summary.py',
    'test/test_escalation_policy_service.py',
    'test/test_holdout_eval.py',
    'test/test_ocr_service.py',
    'test/test_benchmark_provenance.py',
)


def _run(label: str, command: Sequence[str], env: dict[str, str] | None = None) -> bool:
    print(f'\n--- {label} ---', flush=True)
    completed = subprocess.run(command, cwd=PROJECT_ROOT, env=env, check=False)
    print(f'{label}: {"PASS" if completed.returncode == 0 else "FAIL"}', flush=True)
    return completed.returncode == 0


def _npm_command() -> str | None:
    return shutil.which('npm') or shutil.which('npm.cmd')


def _run_npm(npm: str, *args: str) -> bool:
    if os.name == 'nt' and npm.lower().endswith(('.cmd', '.bat')):
        command = subprocess.list2cmdline([npm, *args])
        completed = subprocess.run(command, cwd=PROJECT_ROOT / 'frontend', shell=True, check=False)
    else:
        completed = subprocess.run([npm, *args], cwd=PROJECT_ROOT / 'frontend', check=False)
    return completed.returncode == 0


def _verify_harness() -> tuple[bool, dict]:
    sys.path.insert(0, str(PROJECT_ROOT / 'backend'))
    from app.services.verify_harness_service import run_verify_harness

    result = run_verify_harness()
    passed = (
        result.get('total') == 9
        and result.get('failed') == 0
        and result.get('networkCallsPerformed') is False
        and result.get('databaseWritesPerformed') is False
    )
    return passed, result


def _check_benchmark_provenance() -> tuple[bool, dict]:
    dataset_path = PROJECT_ROOT / 'benchmark' / 'fixed_synthetic_cases.json'
    result_path = PROJECT_ROOT / 'benchmark' / 'results' / 'latest.json'
    expected_sha = hashlib.sha256(dataset_path.read_bytes()).hexdigest()
    result = json.loads(result_path.read_text(encoding='utf-8'))
    passed = (
        result.get('benchmarkType') == 'DETERMINISTIC_TRACK_A_DECISION_BENCHMARK'
        and result.get('evaluationTarget') == 'ESCALATION_DECISION_POLICY'
        and result.get('scenarioCount') == 18
        and result.get('aiCallsPerformed') is False
        and result.get('datasetSha256') == expected_sha
        and isinstance(result.get('benchmarkRunId'), str)
        and bool(result.get('timestamp'))
        and isinstance(result.get('metrics'), dict)
        and isinstance(result.get('caseResults'), list)
        and len(result['caseResults']) == 18
    )
    return passed, result


def _holdout_status() -> tuple[str, str]:
    holdout_dir = PROJECT_ROOT / 'benchmark' / 'holdout'
    dataset_path = holdout_dir / 'track_a_holdout_v1.json'
    manifest_path = holdout_dir / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    digest = hashlib.sha256(dataset_path.read_bytes()).hexdigest()
    if (
        manifest.get('frozen') is not True
        or manifest.get('sha256') != digest
        or manifest.get('usedByRuntime') is not False
        or manifest.get('usedByTraining') is not False
        or manifest.get('usedByUnitTests') is not False
    ):
        return 'FAIL', 'frozen manifest or dataset digest is invalid'
    result_path = holdout_dir / 'results' / 'latest.json'
    if not result_path.exists():
        return 'NOT RUN', 'no frozen evaluation result is recorded'
    result = json.loads(result_path.read_text(encoding='utf-8'))
    matches = (
        result.get('status') == 'COMPLETED'
        and result.get('dataset') == manifest.get('dataset')
        and result.get('datasetVersion') == manifest.get('version')
        and result.get('datasetSha256') == digest
        and result.get('scenarioCount') == manifest.get('scenarioCount')
        and len(result.get('caseResults') or []) == manifest.get('scenarioCount')
    )
    if not matches:
        return 'FAIL', 'result artifact does not match the frozen manifest'
    return 'PASS', (
        f"{result['scenarioCount']} cases · accuracy {result.get('decisionAccuracy')}% · "
        f"missed {result.get('missedEscalationRate')}% · unnecessary {result.get('unnecessaryEscalationRate')}%"
    )


def main() -> int:
    print('=' * 52)
    print('EDUASSISTANT FINAL PRE-FLIGHT')
    print('=' * 52)
    sha = subprocess.run(
        ['git', 'rev-parse', 'HEAD'], cwd=PROJECT_ROOT, capture_output=True,
        text=True, check=False,
    )
    print(f"Git SHA: {sha.stdout.strip() if sha.returncode == 0 else 'UNAVAILABLE'}")

    env = os.environ.copy()
    env.update({
        'APP_ENV': 'test',
        'AI_MODE': 'mock',
        'SEED_DEMO_DATA': 'false',
        'ALLOW_ADMIN_VERIFIED_DEMO_SIS': 'false',
        'DATABASE_URL': '',
        'GEMINI_API_KEY': '',
        'OPENROUTER_API_KEY': '',
        'GEMINI_EMBEDDING_MODEL': '',
    })
    checks: list[bool] = []

    tests_ok = _run('Backend tests', [sys.executable, '-m', 'pytest', '-q', *CRITICAL_TESTS], env)
    checks.append(tests_ok)

    verify_ok = False
    verify: dict = {}
    try:
        verify_ok, verify = _verify_harness()
        print('\n--- Verify Harness ---')
        print(f"Verify Harness: {verify.get('passed')}/{verify.get('total')} · failed {verify.get('failed')}")
        print(f"Network calls: {'NO' if verify.get('networkCallsPerformed') is False else 'YES/UNKNOWN'}")
        print(f"DB writes: {'NO' if verify.get('databaseWritesPerformed') is False else 'YES/UNKNOWN'}")
        checks.append(verify_ok)
    except Exception as exc:  # A preflight error should be visible and fail the command.
        print(f'\nVerify Harness: FAIL ({type(exc).__name__})')
        checks.append(False)

    benchmark_ok = _run('Fixed Synthetic Development Benchmark',
                        [sys.executable, 'benchmark/run_benchmark.py'], env)
    checks.append(benchmark_ok)
    provenance_ok = False
    benchmark: dict = {}
    try:
        provenance_ok, benchmark = _check_benchmark_provenance()
        metrics = benchmark.get('metrics') or {}
        print('\n--- Benchmark provenance ---')
        print(f"Benchmark provenance: {'PASS' if provenance_ok else 'FAIL'}")
        print(f"Cases: {benchmark.get('scenarioCount')} · SHA-256: {benchmark.get('datasetSha256')}")
        print(f"Accuracy: {metrics.get('decisionAccuracy')}% · Automation: {metrics.get('automationRate')}% · Escalation: {metrics.get('escalationRate')}%")
        print(f"Missed escalation: {metrics.get('missedEscalationRate')}% · Unnecessary escalation: {metrics.get('unnecessaryEscalationRate')}%")
        checks.append(provenance_ok)
    except Exception as exc:
        print(f'\nBenchmark provenance: FAIL ({type(exc).__name__})')
        checks.append(False)

    npm = _npm_command()
    if npm is None:
        print('\nFrontend lint: FAIL (npm not found)')
        print('Frontend build: FAIL (npm not found)')
        lint_ok = False
        build_ok = False
        checks.extend((False, False))
    else:
        print('\n--- Frontend lint ---', flush=True)
        lint_ok = _run_npm(npm, 'run', 'lint')
        print(f"Frontend lint: {'PASS' if lint_ok else 'FAIL'}", flush=True)
        checks.append(lint_ok)
        print('\n--- Frontend build ---', flush=True)
        build_ok = _run_npm(npm, 'run', 'build')
        print(f"Frontend build: {'PASS' if build_ok else 'FAIL'}", flush=True)
        checks.append(build_ok)

    try:
        holdout_result, holdout_detail = _holdout_status()
    except Exception as exc:
        holdout_result, holdout_detail = 'FAIL', type(exc).__name__
    print(f'\nFrozen Holdout: {holdout_result} · {holdout_detail}')
    if holdout_result == 'FAIL':
        checks.append(False)
    summary_rows = [
        ('Backend unit', 'PASS' if tests_ok else 'FAIL'),
        ('Verify', 'PASS' if verify_ok else 'FAIL'),
        ('Development benchmark', 'PASS' if benchmark_ok and provenance_ok else 'FAIL'),
        ('Frontend lint', 'PASS' if lint_ok else 'FAIL'),
        ('Frontend build', 'PASS' if build_ok else 'FAIL'),
        ('Frozen holdout', holdout_result),
        ('PostgreSQL competition integration', 'CI REQUIRED'),
        ('User validation', 'PENDING'),
    ]
    print('\n--- Final status ---')
    print(f"{'Check':<39} Status")
    print('-' * 57)
    for label, status in summary_rows:
        print(f'{label:<39} {status}')
    print('=' * 52)
    passed = all(checks)
    print(f"Mandatory technical checks: {'PASS' if passed else 'FAIL'}")
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
