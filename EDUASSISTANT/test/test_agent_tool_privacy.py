"""Agent tool results must not send unnecessary personal data to a model."""

import asyncio

from app.services import agent_tool_service


def test_admin_user_lookup_does_not_select_email_for_model_context(monkeypatch):
    queries = []
    def capture_query(sql, _params=()):
        queries.append(sql)
        return [{'id': 'user-1', 'username': 'student-1', 'fullName': 'Student', 'role': 'STUDENT'}]
    monkeypatch.setattr(agent_tool_service, 'get_all', capture_query)

    result = asyncio.run(agent_tool_service._read_tool(
        'list_users', {}, {'id': 'admin-1', 'role': 'ADMIN'}))

    assert 'email' not in queries[0].lower()
    assert 'email' not in result['users'][0]
