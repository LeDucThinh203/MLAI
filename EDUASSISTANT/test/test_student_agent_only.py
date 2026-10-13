import asyncio
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
import httpx

from app.core import dependencies
from app.core.responses import custom_http_exception_handler
from app.routers.agent import router as agent_router
from app.services import agent_rag_service, agent_service


AGENT_ENDPOINTS = [
    ('post', '/api/agent/chat', {'message': 'Hello'}),
    ('get', '/api/agent/conversations', None),
    ('post', '/api/agent/conversations', {}),
    ('get', '/api/agent/conversations/conv-1', None),
    ('delete', '/api/agent/conversations/conv-1', None),
    ('post', '/api/agent/actions/action-1/confirm', {}),
    ('post', '/api/agent/actions/action-1/cancel', {}),
]


def _test_app(role):
    app = FastAPI()
    app.include_router(agent_router)
    app.add_exception_handler(HTTPException, custom_http_exception_handler)

    async def current_user():
        return {'id': 'user-1', 'username': 'user-one', 'fullName': 'User One', 'role': role}

    app.dependency_overrides[dependencies.get_current_user] = current_user
    return app


def _request(app, method, path, body=None):
    async def send():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            return await client.request(method.upper(), path, json=body)
    return asyncio.run(send())


@pytest.mark.parametrize('role', ['REVIEWER', 'ADMIN'])
@pytest.mark.parametrize(('method', 'path', 'body'), AGENT_ENDPOINTS)
def test_staff_agent_endpoints_return_403_before_agent_operation(monkeypatch, role, method, path, body):
    async def forbidden_audit(_row):
        return None

    def unexpected_call(*_args, **_kwargs):
        raise AssertionError('A non-student reached an Agent service operation.')

    monkeypatch.setattr(dependencies.db_service, 'log_audit', forbidden_audit)
    for operation in ('chat', 'list_conversations', 'create_conversation', 'conversation_detail',
                      'delete_conversation', 'confirm_action', 'cancel_action'):
        monkeypatch.setattr(agent_service, operation, unexpected_call)

    response = _request(_test_app(role), method, path, body)

    assert response.status_code == 403
    assert response.json()['error'] == 'FORBIDDEN'


@pytest.mark.parametrize('role', ['REVIEWER', 'ADMIN'])
@pytest.mark.parametrize('operation,args', [
    ('chat', ('Hello',)),
    ('create_conversation', ()),
    ('list_conversations', ()),
    ('conversation_detail', ('conv-1',)),
    ('delete_conversation', ('conv-1',)),
    ('confirm_action', ('action-1',)),
    ('cancel_action', ('action-1',)),
])
def test_agent_service_operations_fail_closed_for_non_students(role, operation, args):
    user = {'id': 'user-1', 'role': role}
    method = getattr(agent_service, operation)
    with pytest.raises(agent_service.AgentError) as error:
        if operation == 'chat':
            result = method(user, *args)
        elif operation in ('create_conversation', 'list_conversations'):
            result = method(user, *args)
        else:
            result = method(*args, user)
        if asyncio.iscoroutine(result):
            asyncio.run(result)

    assert error.value.status_code == 403
    assert error.value.error == 'STUDENT_AGENT_ONLY'


def test_admin_rag_maintenance_remains_available_without_chat_access(monkeypatch):
    async def forbidden_audit(_row):
        return None

    monkeypatch.setattr(dependencies.db_service, 'log_audit', forbidden_audit)
    monkeypatch.setattr(agent_rag_service, 'status', lambda: {'documents': 2, 'chunks': 4})
    monkeypatch.setattr(agent_rag_service, 'reindex', lambda **_kwargs: asyncio.sleep(0, result={'failedDocuments': []}))

    app = _test_app('ADMIN')
    status = _request(app, 'get', '/api/admin/agent/rag/status')
    reindex = _request(app, 'post', '/api/admin/agent/rag/reindex')

    assert status.status_code == 200
    assert reindex.status_code == 200


def test_widget_is_mounted_only_for_students_and_keeps_public_route_exclusions():
    app_source = (Path(__file__).parents[1] / 'frontend' / 'src' / 'App.jsx').read_text(encoding='utf-8')
    widget_source = (Path(__file__).parents[1] / 'frontend' / 'src' / 'components' / 'agent' / 'AgentChatWidget.jsx').read_text(encoding='utf-8')

    assert "user?.role === 'STUDENT'" in app_source
    assert "!location.pathname.startsWith('/login')" in app_source
    assert "!location.pathname.startsWith('/verify')" in app_source
    assert "!location.pathname.startsWith('/judge')" in app_source
    assert '<AgentChatWidget user={user}' in app_source
    assert 'REVIEWER:' not in widget_source
    assert 'ADMIN:' not in widget_source


def test_widget_delete_targets_one_active_conversation_and_clears_state_on_success():
    widget_source = (Path(__file__).parents[1] / 'frontend' / 'src' / 'components' / 'agent' / 'AgentChatWidget.jsx').read_text(encoding='utf-8')
    assert 'aria-label="Xóa cuộc trò chuyện hiện tại"' in widget_source
    assert 'title="Xóa cuộc trò chuyện"' in widget_source
    assert 'disabled={!conversationId || loading || actionBusy || deleteBusy}' in widget_source
    assert 'role="alertdialog"' in widget_source
    assert 'axios.delete(' in widget_source
    assert 'setMessages([]);' in widget_source
    assert "setDraft('');" in widget_source
    assert "setError('');" in widget_source
    assert "setConversationId(remaining[0]?.id || null);" in widget_source
    assert 'CONVERSATION_BUSY' in widget_source
    assert 'window.confirm' not in widget_source
