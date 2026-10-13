"""Conversation deletion stays owner-scoped, atomic, and separate from business data."""
import asyncio
import json
from pathlib import Path

import pytest

from app.services import agent_repository, agent_service, agent_tool_service


class FakePostgres:
    def __init__(self):
        self.conversations = {
            'conv-a': {'id': 'conv-a', 'user_id': 'student-a'},
            'conv-b': {'id': 'conv-b', 'user_id': 'student-a'},
            'conv-other': {'id': 'conv-other', 'user_id': 'student-b'},
        }
        self.messages = [
            {'id': f'msg-a-{index}', 'conversation_id': 'conv-a'} for index in range(3)
        ] + [{'id': 'msg-b', 'conversation_id': 'conv-b'},
             {'id': 'msg-other', 'conversation_id': 'conv-other'}]
        self.actions = [
            {'id': 'action-a', 'user_id': 'student-a', 'conversation_id': 'conv-a', 'status': 'PENDING',
             'arguments': '{}', 'preview': '{}', 'tool_name': 'create_case'},
            {'id': 'action-b', 'user_id': 'student-a', 'conversation_id': 'conv-b', 'status': 'PENDING',
             'arguments': '{}', 'preview': '{}', 'tool_name': 'create_case'},
            {'id': 'action-other', 'user_id': 'student-b', 'conversation_id': 'conv-other', 'status': 'PENDING',
             'arguments': '{}', 'preview': '{}', 'tool_name': 'create_case'},
        ]
        self.audits = []
        self.statements = []
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return FakeCursor(self)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, _exc, _traceback):
        if exc_type is None:
            self.commits += 1
        else:
            self.rollbacks += 1


class FakeCursor:
    def __init__(self, database):
        self.database = database
        self.rowcount = -1
        self.result = None

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, sql, params=()):
        normalized = ' '.join(sql.lower().split())
        self.database.statements.append(normalized)
        self.result = None
        self.rowcount = 0

        if normalized.startswith('select id from agent_conversations'):
            conversation = self.database.conversations.get(params[0])
            if conversation and conversation['user_id'] == params[1]:
                self.result = {'id': params[0]}
        elif normalized.startswith('select id from agent_pending_actions') and "status='executing'" in normalized:
            action = next((item for item in self.database.actions
                           if item['conversation_id'] == params[0] and item['status'] == 'EXECUTING'), None)
            self.result = {'id': action['id']} if action else None
        elif normalized.startswith('select count(*) as count from agent_messages'):
            self.result = {'count': sum(item['conversation_id'] == params[0] for item in self.database.messages)}
        elif normalized.startswith('select count(*) as count from agent_pending_actions'):
            self.result = {'count': sum(item['conversation_id'] == params[0] for item in self.database.actions)}
        elif normalized.startswith('delete from agent_conversations'):
            conversation = self.database.conversations.get(params[0])
            if conversation and conversation['user_id'] == params[1]:
                del self.database.conversations[params[0]]
                self.database.messages = [item for item in self.database.messages if item['conversation_id'] != params[0]]
                self.database.actions = [item for item in self.database.actions if item['conversation_id'] != params[0]]
                self.rowcount = 1
        elif normalized.startswith('insert into audits'):
            self.database.audits.append(params)
            self.rowcount = 1
        elif normalized.startswith('select c.id from agent_pending_actions'):
            action = next((item for item in self.database.actions
                           if item['id'] == params[0] and item['user_id'] == params[1]), None)
            conversation = self.database.conversations.get(action['conversation_id']) if action else None
            if conversation and conversation['user_id'] == params[2]:
                self.result = {'id': conversation['id']}
        elif normalized.startswith("update agent_pending_actions set status='executing'"):
            action = next((item for item in self.database.actions
                           if item['id'] == params[1] and item['user_id'] == params[2]
                           and item['status'] == 'PENDING'), None)
            if action:
                action['status'] = 'EXECUTING'
                self.rowcount = 1
        elif normalized.startswith('select * from agent_pending_actions'):
            action = next((item for item in self.database.actions
                           if item['id'] == params[0] and item['user_id'] == params[1]), None)
            self.result = dict(action) if action else None
        else:
            raise AssertionError(f'Unexpected SQL in deletion test: {normalized}')

    def fetchone(self):
        return self.result


def _install_database(monkeypatch, database):
    monkeypatch.setattr(agent_repository, 'get_db_connection', lambda: database)


def test_delete_removes_only_selected_conversation_children_and_keeps_audit(monkeypatch):
    database = FakePostgres()
    _install_database(monkeypatch, database)

    result = agent_repository.delete_conversation(
        'conv-a', 'student-a', {'id': 'student-a', 'role': 'STUDENT', 'username': 'student-a', 'fullName': 'Student A'})

    assert result == {'conversationId': 'conv-a', 'deleted': True, 'messagesDeleted': 3, 'pendingActionsDeleted': 1}
    assert 'conv-a' not in database.conversations
    assert [item['conversation_id'] for item in database.messages] == ['conv-b', 'conv-other']
    assert [item['id'] for item in database.actions] == ['action-b', 'action-other']
    assert database.commits == 1
    assert database.rollbacks == 0

    audit = database.audits[0]
    assert audit[1] == 'AGENT_CONVERSATION_DELETED'
    assert audit[3:7] == ('student-a', 'Student A', 'STUDENT', 'student-a')
    audit_payload = json.loads(audit[7])
    assert audit_payload == result
    assert not any(key in audit_payload for key in ('content', 'prompt', 'toolResult', 'ragContext'))
    assert not any(table in statement for statement in database.statements
                   for table in ('cases', 'sis_student_records', 'rag_documents', 'users'))


def test_delete_of_another_students_conversation_is_not_found_and_has_no_side_effects(monkeypatch):
    database = FakePostgres()
    _install_database(monkeypatch, database)
    before_messages = list(database.messages)
    before_actions = list(database.actions)

    result = agent_repository.delete_conversation(
        'conv-other', 'student-a', {'id': 'student-a', 'role': 'STUDENT'})

    assert result is None
    assert 'conv-other' in database.conversations
    assert database.messages == before_messages
    assert database.actions == before_actions
    assert database.audits == []


def test_executing_action_prevents_delete_without_removing_anything(monkeypatch):
    database = FakePostgres()
    database.actions[0]['status'] = 'EXECUTING'
    _install_database(monkeypatch, database)
    before_messages = list(database.messages)

    result = agent_repository.delete_conversation(
        'conv-a', 'student-a', {'id': 'student-a', 'role': 'STUDENT'})

    assert result['deleted'] is False
    assert result['busy'] is True
    assert 'conv-a' in database.conversations
    assert database.messages == before_messages
    assert database.audits == []

    with pytest.raises(agent_service.AgentError) as error:
        asyncio.run(agent_service.delete_conversation(
            'conv-a', {'id': 'student-a', 'role': 'STUDENT'}))
    assert error.value.status_code == 409
    assert error.value.error == 'CONVERSATION_BUSY'


def test_delete_service_hides_another_students_conversation_as_not_found(monkeypatch):
    database = FakePostgres()
    _install_database(monkeypatch, database)

    with pytest.raises(agent_service.AgentError) as error:
        asyncio.run(agent_service.delete_conversation(
            'conv-other', {'id': 'student-a', 'role': 'STUDENT'}))

    assert error.value.status_code == 404
    assert error.value.error == 'CONVERSATION_NOT_FOUND'
    assert 'conv-other' in database.conversations


def test_confirmation_claim_and_delete_lock_the_same_conversation(monkeypatch):
    database = FakePostgres()
    _install_database(monkeypatch, database)

    claimed = agent_repository.claim_pending_action('action-a', 'student-a')

    assert claimed['status'] == 'EXECUTING'
    assert any('for update of c' in statement for statement in database.statements)
    assert database.actions[0]['status'] == 'EXECUTING'

    deleted = agent_repository.delete_conversation(
        'conv-a', 'student-a', {'id': 'student-a', 'role': 'STUDENT'})
    assert deleted['busy'] is True

    delete_statements = []
    for statement in database.statements:
        if statement.startswith('select id from agent_conversations'):
            delete_statements.append(statement)
    assert delete_statements and 'for update' in delete_statements[0]


def test_stale_action_id_after_conversation_delete_cannot_be_claimed_or_executed(monkeypatch):
    database = FakePostgres()
    _install_database(monkeypatch, database)
    agent_repository.delete_conversation(
        'conv-a', 'student-a', {'id': 'student-a', 'role': 'STUDENT'})
    monkeypatch.setattr(agent_repository, 'get_one', lambda *_args: None)
    executions = []

    async def execute(*_args):
        executions.append('executed')

    monkeypatch.setattr(agent_tool_service, 'execute_action', execute)
    with pytest.raises(agent_service.AgentError) as error:
        asyncio.run(agent_service.confirm_action('action-a', {'id': 'student-a', 'role': 'STUDENT'}))
    assert error.value.error == 'ACTION_NOT_FOUND'
    assert agent_repository.claim_pending_action('action-a', 'student-a') is None
    assert executions == []


def test_agent_conversation_foreign_keys_keep_cascade_delete():
    source = Path(agent_repository.__file__).parents[1] / 'db' / 'database.py'
    database_schema = source.read_text(encoding='utf-8')
    assert 'conversation_id VARCHAR(100) NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE' in database_schema
