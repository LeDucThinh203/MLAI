"""Adaptive threshold feedback behavior without a database dependency."""

import pytest

from app.services import escalation_policy_service as policy


@pytest.fixture
def isolated_policy(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', '')
    monkeypatch.setattr(policy, 'get_one', None)
    monkeypatch.setattr(policy, 'run_query', None)
    monkeypatch.setattr(policy, '_fallback_threshold', policy.DEFAULT_THRESHOLD)
    monkeypatch.setattr(policy, '_fallback_history', [])
    return policy


def test_feedback_moves_threshold_by_two_points_and_correct_keeps_it(isolated_policy):
    service = isolated_policy
    missed = service.record_reviewer_feedback('CASE-A', 'MISSED_ESCALATION', 'Reviewer', reviewer_id='reviewer-a')
    assert missed['oldThreshold'] == 0.75
    assert missed['newThreshold'] == 0.77

    unnecessary = service.record_reviewer_feedback('CASE-B', 'UNNECESSARY_ESCALATION', 'Reviewer', reviewer_id='reviewer-a')
    assert unnecessary['oldThreshold'] == 0.77
    assert unnecessary['newThreshold'] == 0.75

    correct = service.record_reviewer_feedback('CASE-C', 'CORRECT', 'Reviewer', reviewer_id='reviewer-a')
    assert correct['oldThreshold'] == correct['newThreshold'] == 0.75
    assert correct['record']['reviewerId'] == 'reviewer-a'


def test_threshold_feedback_respects_upper_and_lower_bounds(isolated_policy):
    service = isolated_policy
    service._fallback_threshold = service.MAX_THRESHOLD
    assert service.record_reviewer_feedback('CASE-A', 'MISSED_ESCALATION', 'Reviewer')['newThreshold'] == 0.90

    service._fallback_threshold = service.MIN_THRESHOLD
    assert service.record_reviewer_feedback('CASE-B', 'UNNECESSARY_ESCALATION', 'Reviewer')['newThreshold'] == 0.65


def test_public_policy_summary_contains_only_aggregate_fields(isolated_policy):
    service = isolated_policy
    service.record_reviewer_feedback('CASE-PRIVATE', 'CORRECT', 'Private Reviewer', 'private note', 'reviewer-private-id')

    summary = service.get_public_policy_summary()
    assert summary == {
        'currentThreshold': 0.75,
        'minThreshold': 0.65,
        'maxThreshold': 0.9,
        'step': 0.02,
        'feedbackEventCount': 1,
        'lastUpdatedAt': service._fallback_history[-1]['createdAt'],
    }
    assert 'reviewer-private-id' not in str(summary)
    assert 'private note' not in str(summary)
    assert 'CASE-PRIVATE' not in str(summary)


def test_invalid_feedback_is_rejected(isolated_policy):
    with pytest.raises(ValueError):
        isolated_policy.record_reviewer_feedback('CASE-A', 'AUTO_APPROVE', 'Reviewer')
