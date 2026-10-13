"""Deterministic orchestration and legal-scope regression coverage."""

import asyncio

from app.services import agent_repository, agent_service, agent_tool_service


def test_shared_knowledge_intent_handles_bilingual_questions():
    messages = (
        'T\u1ea1i sao h\u1ed3 s\u01a1 c\u1ea7n x\u00e1c nh\u1eadn \u0111\u1ecba ch\u1ec9?',
        'What documents are required by policy?',
    )
    for message in messages:
        assert agent_service._needs_policy_context(message)
        assert agent_service._is_knowledge_question(message)


def test_legal_eligibility_guard_uses_user_intent_without_blocking_status():
    question = 'T\u00f4i c\u00f3 \u0111\u1ee7 \u0111i\u1ec1u ki\u1ec7n \u0111\u01b0\u1ee3c t\u1ea1m ho\u00e3n ngh\u0129a v\u1ee5 qu\u00e2n s\u1ef1 kh\u00f4ng?'
    assert agent_service._is_legal_eligibility_request(question)
    response = agent_service._safe_final_message('You qualify for deferment.', question)
    assert 'kh\u00f4ng quy\u1ebft \u0111\u1ecbnh t\u01b0 c\u00e1ch ph\u00e1p l\u00fd' in response
    assert 'c\u01a1 quan c\u00f3 th\u1ea9m quy\u1ec1n' in response

    assert agent_service._is_legal_eligibility_request('Am I eligible for military-service deferment?')
    status_question = 'H\u1ed3 s\u01a1 CASE-2026-1234 \u0111ang \u1edf tr\u1ea1ng th\u00e1i n\u00e0o?'
    assert not agent_service._is_legal_eligibility_request(status_question)
    assert agent_service._safe_final_message('H\u1ed3 s\u01a1 \u0111ang \u0111\u01b0\u1ee3c ki\u1ec3m tra.', status_question) == 'H\u1ed3 s\u01a1 \u0111ang \u0111\u01b0\u1ee3c ki\u1ec3m tra.'


def test_student_policy_search_result_counts_as_policy_evidence():
    result = {'chunks': [{'source': {'sourceKey': 'student_service_policy'}, 'content': 'policy evidence'}]}
    assert agent_service._has_policy_evidence(
        {'chunks': []}, [{'name': 'search_policy', 'result': result}])


def test_model_context_redacts_credentials_from_retrieved_and_tool_text():
    secret = 'postgresql://db-user:db-password@example.test/app'
    context = agent_service._build_agent_context(
        {'role': 'STUDENT'}, 'Summarize the policy.', [],
        {'chunks': [{'source': {}, 'content': f'DATABASE_URL={secret}'}]},
        [{'name': 'get_case_comments', 'result': {'comment': 'Password: local-demo-password'}}],
    )
    assert secret not in context
    assert 'db-password' not in context
    assert 'local-demo-password' not in context


def _mock_chat_storage(monkeypatch, conversation_id):
    stored_messages = []
    monkeypatch.setattr(agent_service, 'AGENT_ENABLED', True)
    async def no_rate_limit(_user_id):
        return None
    monkeypatch.setattr(agent_service, '_check_rate_limit', no_rate_limit)
    monkeypatch.setattr(agent_repository, 'create_conversation',
                        lambda *_args: {'id': conversation_id})
    monkeypatch.setattr(agent_repository, 'list_messages', lambda *_args: [])
    monkeypatch.setattr(agent_repository, 'add_message',
                        lambda *args, **kwargs: stored_messages.append((args, kwargs)))
    return stored_messages


def test_agent_routes_empty_argument_read_tool(monkeypatch):
    plans = [
        {'responseType': 'TOOL_CALL', 'message': 'Checking notifications.',
         'toolCalls': [{'name': 'get_notifications', 'arguments': {}}]},
        {'responseType': 'ANSWER', 'message': 'There are no notifications.', 'toolCalls': []},
    ]
    async def generate(_prompt, **_kwargs):
        return plans.pop(0), {'provider': 'Safe fallback', 'model': None,
                              'apiCallPerformed': False, 'fallback': True, 'attempts': []}
    async def notifications(_user_id):
        return []
    stored_messages = _mock_chat_storage(monkeypatch, 'conv-empty-read')
    monkeypatch.setattr(agent_service, '_generate', generate)
    monkeypatch.setattr(agent_tool_service.db_service, 'get_notifications', notifications)

    response = asyncio.run(agent_service.chat(
        {'id': 'student-empty-read', 'role': 'STUDENT'}, 'Show my notifications.'))

    assert response['message'] == 'There are no notifications.'
    assert response['toolEvents'] == [{'name': 'get_notifications', 'status': 'completed'}]
    assert response['provenance']['toolSteps'] == 1
    assert len(stored_messages) == 2


def test_agent_only_prepares_empty_write_args_as_a_pending_preview(monkeypatch):
    plans = [{'responseType': 'TOOL_CALL', 'message': 'I can prepare that.',
              'toolCalls': [{'name': 'mark_all_notifications_read', 'arguments': {}}]}]
    pending_calls, audit_rows, stored_messages = [], [], _mock_chat_storage(monkeypatch, 'conv-empty-write')
    async def generate(_prompt, **_kwargs):
        return plans.pop(0), {'provider': 'Safe fallback', 'model': None,
                              'apiCallPerformed': False, 'fallback': True, 'attempts': []}
    async def log_audit(row):
        audit_rows.append(row)
    async def forbidden_mutation(_user_id):
        raise AssertionError('Preparation must not mark notifications as read.')
    def create_pending(*args):
        pending_calls.append(args)
        return {'id': 'action-empty-write'}
    monkeypatch.setattr(agent_service, '_generate', generate)
    monkeypatch.setattr(agent_service.db_service, 'log_audit', log_audit)
    monkeypatch.setattr(agent_repository, 'create_pending_action', create_pending)
    monkeypatch.setattr(agent_tool_service.db_service, 'mark_all_notifications_as_read', forbidden_mutation)

    response = asyncio.run(agent_service.chat(
        {'id': 'student-empty-write', 'role': 'STUDENT'}, 'Mark all my notifications as read.'))

    assert response['pendingAction']['actionId'] == 'action-empty-write'
    assert response['pendingAction']['status'] == 'PENDING'
    assert response['pendingAction']['preview'] == {'toolName': 'mark_all_notifications_read'}
    assert response['toolEvents'] == [{'name': 'mark_all_notifications_read', 'status': 'awaiting_confirmation'}]
    assert len(pending_calls) == 1
    assert pending_calls[0][3] == {}
    assert audit_rows[0]['action'] == 'AGENT_ACTION_REQUESTED'
    assert len(stored_messages) == 2


def test_legal_eligibility_question_cannot_prepare_a_write(monkeypatch):
    plans = [{'responseType': 'TOOL_CALL', 'message': 'Preparing approval.',
              'toolCalls': [{'name': 'create_case', 'arguments': {
                  'title': 'Student status confirmation', 'rawAddress': '12 Example Street'}}]}]
    stored_messages = _mock_chat_storage(monkeypatch, 'conv-legal-guard')
    async def generate(_prompt, **_kwargs):
        return plans.pop(0), {'provider': 'Safe fallback', 'model': None,
                              'apiCallPerformed': False, 'fallback': True, 'attempts': []}
    monkeypatch.setattr(agent_service, '_generate', generate)
    monkeypatch.setattr(agent_repository, 'create_pending_action',
                        lambda *_args: (_ for _ in ()).throw(AssertionError('Legal question staged a write.')))
    question = 'T\u00f4i c\u00f3 \u0111\u1ee7 \u0111i\u1ec1u ki\u1ec7n t\u1ea1m ho\u00e3n ngh\u0129a v\u1ee5 qu\u00e2n s\u1ef1 kh\u00f4ng?'

    response = asyncio.run(agent_service.chat(
        {'id': 'student-legal', 'role': 'STUDENT'}, question))

    assert response['pendingAction'] is None
    assert response['toolEvents'] == [{'name': 'create_case', 'status': 'blocked_legal_scope'}]
    assert 'kh\u00f4ng quy\u1ebft \u0111\u1ecbnh t\u01b0 c\u00e1ch ph\u00e1p l\u00fd' in response['message']
    assert len(stored_messages) == 2
