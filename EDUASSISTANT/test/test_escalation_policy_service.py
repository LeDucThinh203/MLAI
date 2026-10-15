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


class _PostgresFeedbackCursor:
    def __init__(self, database):
        self.database = database
        self.row = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, sql, params=()):
        normalized_sql = ' '.join(sql.split())
        self.database.statements.append(normalized_sql)
        if normalized_sql.startswith('SELECT currentThreshold AS'):
            # psycopg dict_row preserves the quoted camelCase alias exactly.
            self.row = (
                {'currentThreshold': self.database.threshold}
                if self.database.row_available else None
            )
        elif normalized_sql.startswith('UPDATE escalation_policy_state'):
            self.database.threshold = float(params[0])
        elif normalized_sql.startswith('INSERT INTO escalation_threshold_history'):
            if self.database.fail_history_insert:
                raise RuntimeError('simulated threshold history insert failure')
            self.database.history.append(params)

    def fetchone(self):
        return self.row


class _PostgresFeedbackConnection:
    def __init__(self, *, row_available=True, fail_history_insert=False):
        self.threshold = policy.DEFAULT_THRESHOLD
        self.history = []
        self.statements = []
        self.row_available = row_available
        self.fail_history_insert = fail_history_insert
        self.commits = 0
        self.rollbacks = 0

    def __enter__(self):
        self._threshold_before = self.threshold
        self._history_count_before = len(self.history)
        return self

    def __exit__(self, exc_type, exc, traceback):
        if exc_type:
            self.threshold = self._threshold_before
            del self.history[self._history_count_before:]
            self.rollbacks += 1
        else:
            self.commits += 1
        return False

    def cursor(self):
        return _PostgresFeedbackCursor(self)


def _use_postgres_feedback_fixture(monkeypatch, database):
    monkeypatch.setenv('DATABASE_URL', 'postgresql://disposable-test/eduassistant')
    monkeypatch.setattr(policy, 'get_db_connection', lambda: database)
    monkeypatch.setattr(policy, '_fallback_threshold', policy.DEFAULT_THRESHOLD)
    monkeypatch.setattr(policy, '_fallback_history', [])


def test_postgres_feedback_quotes_threshold_column_and_keeps_locked_updates(monkeypatch):
    database = _PostgresFeedbackConnection()
    _use_postgres_feedback_fixture(monkeypatch, database)

    missed = policy.record_reviewer_feedback('CASE-A', 'MISSED_ESCALATION', 'Reviewer', reviewer_id='reviewer-a')
    unnecessary = policy.record_reviewer_feedback('CASE-B', 'UNNECESSARY_ESCALATION', 'Reviewer', reviewer_id='reviewer-a')
    correct = policy.record_reviewer_feedback('CASE-C', 'CORRECT', 'Reviewer', reviewer_id='reviewer-a')

    assert (missed['oldThreshold'], missed['newThreshold']) == (0.75, 0.77)
    assert (unnecessary['oldThreshold'], unnecessary['newThreshold']) == (0.77, 0.75)
    assert (correct['oldThreshold'], correct['newThreshold']) == (0.75, 0.75)
    locked_reads = [sql for sql in database.statements if sql.startswith('SELECT currentThreshold AS')]
    assert len(locked_reads) == 3
    assert all('AS "currentThreshold"' in sql and 'FOR UPDATE' in sql for sql in locked_reads)
    assert len(database.history) == 3
    assert database.commits == 3
    assert database.rollbacks == 0


def test_postgres_feedback_fails_when_locked_policy_row_is_missing(monkeypatch):
    database = _PostgresFeedbackConnection(row_available=False)
    _use_postgres_feedback_fixture(monkeypatch, database)

    with pytest.raises(RuntimeError, match='could not be locked/read'):
        policy.record_reviewer_feedback('CASE-A', 'MISSED_ESCALATION', 'Reviewer')

    assert database.threshold == policy.DEFAULT_THRESHOLD
    assert database.history == []
    assert database.commits == 0
    assert database.rollbacks == 1


def test_postgres_history_insert_failure_rolls_back_threshold_update(monkeypatch):
    database = _PostgresFeedbackConnection(fail_history_insert=True)
    _use_postgres_feedback_fixture(monkeypatch, database)

    with pytest.raises(RuntimeError, match='history insert failure'):
        policy.record_reviewer_feedback('CASE-A', 'MISSED_ESCALATION', 'Reviewer')

    assert database.threshold == policy.DEFAULT_THRESHOLD
    assert database.history == []
    assert database.commits == 0
    assert database.rollbacks == 1
