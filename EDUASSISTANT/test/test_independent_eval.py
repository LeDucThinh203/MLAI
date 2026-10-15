"""The independent evaluation release gate stays pending until real data exists."""

import json

from benchmark.independent.run_independent_eval import (
    _score_case,
    run_independent_eval,
    validate_manifest,
)


def test_decision_accuracy_ignores_an_unspecified_optional_reason():
    decision_correct, reason_matches = _score_case(
        'ESCALATE_TO_HUMAN', 'ESCALATE_TO_HUMAN', None, 'FACT_UNKNOWN')

    assert decision_correct is True
    assert reason_matches is None


def test_missing_dataset_is_pending_and_does_not_write_results(tmp_path):
    cases_file = tmp_path / 'cases.json'
    results_dir = tmp_path / 'results'

    result, exit_code = run_independent_eval(cases_file, results_dir)

    assert result == {'status': 'PENDING', 'message': 'INDEPENDENT_EVALUATION_PENDING'}
    assert exit_code == 0
    assert not results_dir.exists()


def test_release_gate_can_require_an_independent_dataset(tmp_path):
    result, exit_code = run_independent_eval(
        tmp_path / 'cases.json', tmp_path / 'results', require_data=True)

    assert result['status'] == 'PENDING'
    assert exit_code == 2
    assert not (tmp_path / 'results').exists()


def test_manifest_rejects_an_empty_or_unfrozen_case_set():
    manifest = {
        'datasetId': 'placeholder-only',
        'version': '1',
        'createdBy': 'template',
        'createdAt': '2026-10-01T00:00:00Z',
        'frozenAt': '2026-10-01T00:00:00Z',
        'sourceDescription': 'Schema validation fixture only; no cases are included.',
        'developmentTeamDidNotTuneOnThisSet': True,
        'cases': [],
    }
    assert json.loads(json.dumps(manifest))['cases'] == []

    try:
        validate_manifest(manifest)
    except ValueError as error:
        assert 'at least one frozen case' in str(error)
    else:
        raise AssertionError('An empty template must not be accepted as an evaluation dataset.')
