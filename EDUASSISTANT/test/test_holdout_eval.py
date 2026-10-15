"""Runner mechanics tests use temporary fixtures, never the frozen holdout set."""
import hashlib
import json

import pytest

from benchmark.run_holdout_eval import run_holdout_eval


def _write_fixture(tmp_path, *, sha_override=None, expected_reason=None):
    dataset_path = tmp_path / 'temporary_cases.json'
    manifest_path = tmp_path / 'manifest.json'
    results_dir = tmp_path / 'results'
    case = {
        'id': 'TEMP-001',
        'name': 'Temporary valid synthetic case',
        'scenarioGroup': 'test_fixture',
        'expectedDecision': 'AUTO_APPROVE',
        'expectedEscalationReason': expected_reason,
        'institutionalFacts': {
            'fullName': 'Temporary Student',
            'studentCode': 'TEMP-STUDENT-001',
            'academicStatus': 'ACTIVE',
            'courseStartDate': '2022-09-01',
            'courseEndDate': '2030-06-30',
            'currentTermActive': True,
            'hasCurrentSchedule': True,
            'registeredPermanentAddress': '5 Đường Test, Phường Test, Quận 1, TP. Hồ Chí Minh',
        },
        'studentClaim': {
            'fullName': 'Temporary Student',
            'studentCode': 'TEMP-STUDENT-001',
            'declaredAddress': '5 Đường Test, Phường Test, Quận 1, TP. Hồ Chí Minh',
            'addressType': 'PERMANENT',
            'requestReason': 'Standard workflow request',
        },
        'addressAnalysis': {
            'parsed': {
                'houseNumber': '5', 'street': 'Đường Test', 'ward': 'Phường Test',
                'district': 'Quận 1', 'province': 'TP. Hồ Chí Minh',
            },
            'normalized': '5 Đường Test, Phường Test, Quận 1, TP. Hồ Chí Minh',
            'missingFields': [], 'confidence': 0.91,
        },
        'aiMetadata': {
            'modeUsed': 'fixture', 'isLive': False, 'isFallback': False,
            'isSynthetic': True, 'provider': 'FIXED_TEST_FIXTURE', 'apiCallPerformed': False,
        },
    }
    dataset_bytes = (json.dumps([case], ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    dataset_path.write_bytes(dataset_bytes)
    manifest = {
        'dataset': dataset_path.name,
        'version': 'test',
        'frozen': True,
        'scenarioCount': 1,
        'sha256': sha_override or hashlib.sha256(dataset_bytes).hexdigest(),
        'purpose': 'Temporary runner mechanics test only',
        'usedByRuntime': False,
        'usedByTraining': False,
        'usedByUnitTests': False,
    }
    manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
    return dataset_path, manifest_path, results_dir


def test_runner_verifies_digest_before_evaluating(tmp_path, monkeypatch):
    dataset_path, manifest_path, results_dir = _write_fixture(tmp_path, sha_override='0' * 64)
    import benchmark.run_holdout_eval as runner

    def should_not_run(*args, **kwargs):
        raise AssertionError('Rule Engine must not run when the frozen digest is invalid.')

    monkeypatch.setattr(runner, 'evaluate_case', should_not_run)
    with pytest.raises(ValueError, match='SHA-256'):
        run_holdout_eval(dataset_path, manifest_path, results_dir)
    assert not results_dir.exists()


def test_runner_scores_only_a_temporary_fixture_and_writes_both_outputs(tmp_path):
    # Empty string is how the frozen JSON encodes "no escalation reason".
    dataset_path, manifest_path, results_dir = _write_fixture(tmp_path, expected_reason='')

    result = run_holdout_eval(dataset_path, manifest_path, results_dir)

    assert result['status'] == 'COMPLETED'
    assert result['scenarioCount'] == 1
    assert result['decisionAccuracy'] == 100.0
    assert result['aiCallsPerformed'] is False
    assert result['networkCallsPerformed'] is False
    assert result['databaseWritesPerformed'] is False
    assert result['thresholdMutationPerformed'] is False
    assert (results_dir / 'latest.json').is_file()
    assert (results_dir / 'latest.csv').is_file()
