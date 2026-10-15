"""Student Agent tools expose only the authenticated student's own safe fields."""

import asyncio

from app.services import agent_tool_service


def test_student_profile_tool_excludes_credentials_and_other_role_data():
    profile = {
        'id': 'student-1', 'username': 'student-one', 'fullName': 'Student One', 'studentCode': 'S001',
        'role': 'STUDENT', 'email': 'student@example.test', 'passwordHash': 'never-send',
        'twoFactorSecret': 'never-send', 'refreshToken': 'never-send', 'department': 'private department',
    }
    result = asyncio.run(agent_tool_service.invoke_read(
        'get_my_profile', {}, profile))

    assert result == {'username': 'student-one', 'fullName': 'Student One', 'studentCode': 'S001'}
    serialized = str(result)
    for private_value in ('never-send', 'student@example.test', 'private department'):
        assert private_value not in serialized


def test_student_case_projection_omits_reviewer_feedback():
    result = agent_tool_service._public_case({
        'id': 'CASE-2026-1234', 'studentId': 'student-1', 'status': 'UNDER_REVIEW',
        'reviewerFeedback': [{'note': 'staff-only'}], 'reviewResult': {'internalNote': 'staff-only'},
        'ruleEngine': {'decision': 'ESCALATE_TO_HUMAN'},
    })

    assert result['id'] == 'CASE-2026-1234'
    assert 'ruleEngine' not in result
    assert 'reviewerFeedback' not in result
    assert 'reviewResult' not in result
    assert 'staff-only' not in str(result)
