import asyncio

import pytest

from app.services import agent_tool_service
from app.services.agent_tool_registry import TOOL_REGISTRY, tools_for_role, validate_tool_call


STUDENT_TOOLS = {
    'get_my_profile', 'list_my_cases', 'get_case_detail', 'get_case_comments',
    'get_notifications', 'normalize_address', 'explain_case_decision', 'search_policy',
    'get_workflow_requirements', 'create_case', 'supplement_case', 'add_case_comment',
    'mark_notification_read', 'mark_all_notifications_read',
}


def test_agent_registry_contains_student_capabilities_only():
    assert set(TOOL_REGISTRY) == STUDENT_TOOLS
    assert {tool['name'] for tool in tools_for_role('STUDENT')} == STUDENT_TOOLS
    assert tools_for_role('REVIEWER') == []
    assert tools_for_role('ADMIN') == []
    assert all(spec['allowedRoles'] == ('STUDENT',) for spec in TOOL_REGISTRY.values())
    assert not any(spec['readOnly'] for spec in TOOL_REGISTRY.values() if spec['requiresConfirmation'])
    assert all(spec['requiresConfirmation'] for spec in TOOL_REGISTRY.values() if not spec['readOnly'])


def test_student_tools_have_strict_argument_schemas_and_empty_args_work(monkeypatch):
    for name, spec in TOOL_REGISTRY.items():
        assert spec['name'] == name
        assert spec['args'] is spec['argumentsSchema']
        assert spec['args'].model_config.get('extra') == 'forbid'
        assert bool(spec['requiresConfirmation']) is not bool(spec['readOnly'])
        assert spec['allowedRoles'] == ('STUDENT',)
        assert spec['args'].model_json_schema()['type'] == 'object'

    empty_read_tools = ('get_my_profile', 'get_notifications')
    calls = []
    async def fake_read(name, args, _user):
        calls.append((name, args))
        return {'name': name}
    monkeypatch.setattr(agent_tool_service, '_read_tool', fake_read)

    async def invoke_all():
        results = []
        for name in empty_read_tools:
            args, spec = validate_tool_call(name, {}, 'STUDENT')
            assert args == {}
            assert spec is TOOL_REGISTRY[name]
            results.append(await agent_tool_service.invoke_read(name, args, {'id': 'student-1', 'role': 'STUDENT'}))
        return results

    results = asyncio.run(invoke_all())
    assert [name for name, args in calls] == list(empty_read_tools)
    assert all(args == {} for _, args in calls)
    assert [result['name'] for result in results] == list(empty_read_tools)


@pytest.mark.parametrize('role', ['REVIEWER', 'ADMIN'])
def test_staff_roles_get_no_agent_tools_or_direct_tool_execution(role):
    assert tools_for_role(role) == []
    args, spec = validate_tool_call('get_my_profile', {}, role)
    assert args is None
    assert spec is TOOL_REGISTRY['get_my_profile']

    with pytest.raises(agent_tool_service.ToolAccessError):
        asyncio.run(agent_tool_service.invoke_read('get_my_profile', {}, {'id': 'staff-1', 'role': role}))
    with pytest.raises(agent_tool_service.ToolAccessError):
        asyncio.run(agent_tool_service.prepare_action(
            'create_case', {'title': 'Request confirmation', 'rawAddress': '12 Example Street'},
            {'id': 'staff-1', 'role': role}))


def test_mark_all_notifications_read_can_be_prepared_with_empty_arguments():
    async def run():
        return await agent_tool_service.prepare_action(
            'mark_all_notifications_read', {}, {'id': 'student-1', 'role': 'STUDENT'})
    prepared, preview = asyncio.run(run())
    assert prepared == {}
    assert preview == {'toolName': 'mark_all_notifications_read'}


def test_student_cannot_read_another_students_case(monkeypatch):
    async def other_case(_case_id):
        return {'id': 'CASE-2026-1234', 'studentId': 'student-other', 'status': 'UNDER_REVIEW'}
    monkeypatch.setattr(agent_tool_service.db_service, 'get_case_by_id', other_case)
    with pytest.raises(agent_tool_service.ToolAccessError):
        asyncio.run(agent_tool_service.invoke_read('get_case_detail', {'caseId': 'CASE-2026-1234'},
                                                   {'id': 'student-a', 'role': 'STUDENT'}))


def test_student_create_case_is_pinned_to_supported_category():
    async def run():
        return await agent_tool_service.prepare_action(
            'create_case', {'title': 'Request student status confirmation', 'description': '',
                            'rawAddress': '12 Main Street, Ward 1, Ha Noi', 'addressType': 'PERMANENT', 'notes': ''},
            {'id': 'student-1', 'role': 'STUDENT'})
    prepared, preview = asyncio.run(run())
    assert prepared['category'] == 'MILITARY_SERVICE_CONFIRMATION'
    assert preview['category'] == 'MILITARY_SERVICE_CONFIRMATION'


def test_unknown_admin_tool_and_extra_arguments_are_rejected():
    assert 'create_user' not in TOOL_REGISTRY
    assert 'review_case_approve' not in TOOL_REGISTRY
    with pytest.raises(Exception):
        validate_tool_call('get_my_profile', {'userId': 'someone-else'}, 'STUDENT')


def test_stale_student_supplement_state_blocks_confirmation(monkeypatch):
    async def changed_case(_case_id):
        return {'id': 'CASE-2026-1234', 'studentId': 'student-a', 'status': 'APPROVED'}
    monkeypatch.setattr(agent_tool_service.db_service, 'get_case_by_id', changed_case)
    with pytest.raises(agent_tool_service.ToolInputError, match='đã thay đổi'):
        asyncio.run(agent_tool_service.revalidate_action(
            'supplement_case', {'caseId': 'CASE-2026-1234', '_expectedStatus': 'UNDER_REVIEW',
                                'additionalDescription': 'Updated information'},
            {'id': 'student-a', 'role': 'STUDENT'}))


def test_supplement_cannot_reopen_terminal_case(monkeypatch):
    async def terminal_case(_case_id):
        return {'id': 'CASE-2026-1234', 'studentId': 'student-a', 'status': 'APPROVED', 'title': 'Closed case'}
    monkeypatch.setattr(agent_tool_service.db_service, 'get_case_by_id', terminal_case)
    with pytest.raises(agent_tool_service.ToolInputError):
        asyncio.run(agent_tool_service.prepare_action(
            'supplement_case', {'caseId': 'CASE-2026-1234', 'additionalDescription': 'More info'},
            {'id': 'student-a', 'role': 'STUDENT'}))
