"""Strict planner response and provider system-role contracts."""

import pytest
from pydantic import ValidationError

from app.schemas.agent import PlannerResponse
from app.services import gemini_generate_service, openrouter_service
from app.services import agent_service
from app.services.agent_service import _normalize_plan, _valid_planner


def test_planner_requires_exact_top_level_and_nested_shapes():
    valid = {'responseType': 'TOOL_CALL', 'message': 'Look up the record.',
             'toolCalls': [{'name': 'get_my_profile', 'arguments': {}}]}
    assert _valid_planner(valid)
    assert _normalize_plan(valid) == valid

    invalid = [
        None,
        [],
        {'responseType': 'ANSWER', 'message': 'ok', 'toolCalls': [], 'unexpected': True},
        {'responseType': 'ANSWER', 'message': 'ok', 'toolCalls': [
            {'name': 'get_my_profile', 'arguments': {}}]},
        {'responseType': 'TOOL_CALL', 'message': 'call', 'toolCalls': []},
        {'responseType': 'TOOL_CALL', 'message': 'call', 'toolCalls': [
            {'name': 'get_my_profile', 'arguments': None}]},
        {'responseType': 'TOOL_CALL', 'message': 'call', 'toolCalls': [
            {'name': 'get_my_profile', 'arguments': []}]},
        {'responseType': 'TOOL_CALL', 'message': 'call', 'toolCalls': [
            {'name': 'get_my_profile'}]},
        {'responseType': 'TOOL_CALL', 'message': 'call', 'toolCalls': [
            {'name': 'get_my_profile', 'arguments': {}, 'extra': 'rejected'}]},
        {'responseType': 'TOOL_CALL', 'message': 'call', 'toolCalls': [
            {'name': 'get_my_profile', 'arguments': {}}] * 5},
        {'responseType': 'MAYBE', 'message': 'call', 'toolCalls': []},
        {'responseType': 'ANSWER', 'toolCalls': []},
        {'responseType': 'ANSWER', 'message': '', 'toolCalls': []},
    ]
    assert all(not _valid_planner(item) for item in invalid)
    assert all(_normalize_plan(item) is None for item in invalid)


def test_planner_model_rejects_non_object_input_without_raising_from_validator():
    for value in (None, [], 'answer'):
        assert not PlannerResponse.validate_shape(value)
        with pytest.raises(ValidationError):
            PlannerResponse.model_validate(value)


def test_provider_bodies_keep_system_instruction_in_native_system_role():
    gemini = gemini_generate_service._body('context', 100, None, None, 'trusted instructions')
    assert gemini['systemInstruction'] == {'parts': [{'text': 'trusted instructions'}]}
    assert gemini['contents'] == [{'parts': [{'text': 'context'}]}]

    router = openrouter_service._request_body('model', 'context', 100, None,
                                              system_instruction='trusted instructions')
    assert router['messages'] == [
        {'role': 'system', 'content': 'trusted instructions'},
        {'role': 'user', 'content': 'context'},
    ]


def test_provider_body_callers_without_system_instruction_remain_compatible():
    gemini = gemini_generate_service._body('context', 100, None, None)
    assert 'systemInstruction' not in gemini
    router = openrouter_service._request_body('model', 'context', 100, None)
    assert router['messages'] == [{'role': 'user', 'content': 'context'}]


def test_generate_rejects_malformed_provider_payloads_as_safe_fallback(monkeypatch):
    invalid = {'responseType': 'TOOL_CALL', 'message': 'incomplete', 'toolCalls': []}
    async def gemini(_prompt, *_args, **_kwargs):
        return invalid, 'gemini-test', 1, None
    async def router(_prompt, **_kwargs):
        return invalid, None, 'router-test', 1
    monkeypatch.setattr(agent_service, 'GEMINI_API_KEY', 'g' * 32)
    monkeypatch.setattr(agent_service, 'generate_gemini_json', gemini)
    monkeypatch.setattr(agent_service, 'generate_openrouter_json', router)
    monkeypatch.setenv('OPENROUTER_API_KEY', 'o' * 32)

    result, provenance = __import__('asyncio').run(
        agent_service._generate('untrusted context', system_instruction='trusted rules'))

    assert result is None
    assert provenance['provider'] == 'Safe fallback'
    assert provenance['apiCallPerformed'] is True
    assert provenance['fallback'] is True
