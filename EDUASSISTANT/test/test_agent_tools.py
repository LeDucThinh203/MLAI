import asyncio

import pytest

from app.services import agent_tool_service
from app.services.agent_tool_registry import TOOL_REGISTRY, validate_tool_call


def test_tools_are_role_allowlisted_and_reviewer_cannot_admin():
    args, spec = validate_tool_call('list_users', {}, 'REVIEWER')
    assert args is None
    assert spec is TOOL_REGISTRY['list_users']
    reviewer_tools = {item for item, row in TOOL_REGISTRY.items() if 'REVIEWER' in row['allowedRoles']}
    assert 'update_user_role' not in reviewer_tools
    assert 'verify_demo_sis_record' not in reviewer_tools


def test_empty_argument_read_tools_and_generic_registry_contract(monkeypatch):
    empty_read_tools = ('get_my_sis_record', 'get_notifications', 'get_current_threshold', 'get_policy_registry')
    for name in empty_read_tools:
        role = 'STUDENT' if name in ('get_my_sis_record', 'get_notifications') else 'ADMIN'
        args, spec = validate_tool_call(name, {}, role)
        assert args == {}
        assert spec is TOOL_REGISTRY[name]

    for name, spec in TOOL_REGISTRY.items():
        assert spec['name'] == name
        assert spec['args'] is spec['argumentsSchema']
        assert spec['args'].model_config.get('extra') == 'forbid'
        assert bool(spec['requiresConfirmation']) is not bool(spec['readOnly'])
        assert spec['allowedRoles']
        assert set(spec['allowedRoles']) <= {'STUDENT', 'REVIEWER', 'ADMIN'}
        schema = spec['args'].model_json_schema()
        assert schema['type'] == 'object'
        assert 'properties' in schema

    calls = []
    async def fake_read(name, args, _user):
        calls.append((name, args))
        return {'name': name}
    monkeypatch.setattr(agent_tool_service, '_read_tool', fake_read)
    async def invoke_all():
        results = []
        for name in empty_read_tools:
            role = 'STUDENT' if name in ('get_my_sis_record', 'get_notifications') else 'ADMIN'
            results.append(await agent_tool_service.invoke_read(name, {}, {'id': 'user-1', 'role': role}))
        return results
    results = asyncio.run(invoke_all())
    assert [name for name, args in calls] == list(empty_read_tools)
    assert all(args == {} for _, args in calls)
    assert [result['name'] for result in results] == list(empty_read_tools)


def test_mark_all_notifications_read_can_be_prepared_with_empty_arguments(monkeypatch):
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


def test_reviewer_write_only_prepares_preview_and_does_not_mutate(monkeypatch):
    async def current_case(_case_id):
        return {'id': 'CASE-2026-1234', 'studentId': 'student-a', 'status': 'UNDER_REVIEW',
                'title': 'Student status confirmation', 'ruleEngine': {'decision': 'ESCALATE_TO_HUMAN'}}
    async def mutation(*_args, **_kwargs):
        raise AssertionError('preview must not mutate the case')
    monkeypatch.setattr(agent_tool_service.db_service, 'get_case_by_id', current_case)
    monkeypatch.setattr(agent_tool_service.db_service, 'update_case_status', mutation)

    prepared, preview = asyncio.run(agent_tool_service.prepare_action(
        'review_case_approve', {'caseId': 'CASE-2026-1234', 'reason': 'Evidence reviewed.'},
        {'id': 'reviewer-1', 'role': 'REVIEWER'}
    ))

    assert prepared['_expectedStatus'] == 'UNDER_REVIEW'
    assert preview['currentStatus'] == 'UNDER_REVIEW'
    assert preview['newStatus'] == 'APPROVED'


def test_student_create_case_is_pinned_to_supported_category():
    async def run():
        prepared, preview = await agent_tool_service.prepare_action(
            'create_case', {'title': 'Request student status confirmation', 'description': '',
                            'rawAddress': '12 Main Street, Ward 1, Ha Noi', 'addressType': 'PERMANENT', 'notes': ''},
            {'id': 'student-1', 'role': 'STUDENT'})
        return prepared, preview
    prepared, preview = asyncio.run(run())
    assert prepared['category'] == 'MILITARY_SERVICE_CONFIRMATION'
    assert preview['category'] == 'MILITARY_SERVICE_CONFIRMATION'


def test_unknown_or_extra_tool_arguments_are_rejected():
    with pytest.raises(Exception):
        validate_tool_call('get_my_profile', {'userId': 'someone-else'}, 'STUDENT')


def test_stale_case_state_blocks_confirmation(monkeypatch):
    async def changed_case(_case_id):
        return {'id': 'CASE-2026-1234', 'studentId': 'student-a', 'status': 'APPROVED'}
    monkeypatch.setattr(agent_tool_service.db_service, 'get_case_by_id', changed_case)
    with pytest.raises(agent_tool_service.ToolInputError, match='đã thay đổi'):
        asyncio.run(agent_tool_service.revalidate_action(
            'review_case_approve', {'caseId': 'CASE-2026-1234', '_expectedStatus': 'UNDER_REVIEW', 'reason': 'Reviewed'},
            {'id': 'reviewer-1', 'role': 'REVIEWER'}))


def test_supplement_cannot_reopen_terminal_case(monkeypatch):
    async def terminal_case(_case_id):
        return {'id': 'CASE-2026-1234', 'studentId': 'student-a', 'status': 'APPROVED', 'title': 'Closed case'}
    monkeypatch.setattr(agent_tool_service.db_service, 'get_case_by_id', terminal_case)
    with pytest.raises(agent_tool_service.ToolInputError):
        asyncio.run(agent_tool_service.prepare_action(
            'supplement_case', {'caseId': 'CASE-2026-1234', 'additionalDescription': 'More info'},
            {'id': 'student-a', 'role': 'STUDENT'}))


def test_admin_user_tool_does_not_accept_password_in_model_arguments():
    with pytest.raises(Exception):
        validate_tool_call('create_user', {'username': 'new-admin', 'fullName': 'New Admin',
                                           'role': 'ADMIN', 'password': 'secret'}, 'ADMIN')
