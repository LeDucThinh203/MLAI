"""Strict, role-scoped allowlist of Agent tools. No generic execution tools."""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class Args(BaseModel):
    model_config = ConfigDict(extra='forbid')


class EmptyArgs(Args):
    pass


class CaseIdArgs(Args):
    caseId: str = Field(min_length=1, max_length=100)


class CaseListArgs(Args):
    status: Optional[str] = Field(default=None, max_length=50)
    limit: int = Field(default=10, ge=1, le=30)


class NotificationArgs(Args):
    notificationId: str = Field(min_length=1, max_length=100)


class AddressArgs(Args):
    address: str = Field(min_length=1, max_length=1000)
    addressType: str = Field(default='PERMANENT', max_length=20)


class SearchArgs(Args):
    query: str = Field(min_length=2, max_length=1000)


class CreateCaseArgs(Args):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default='', max_length=3000)
    rawAddress: str = Field(min_length=5, max_length=1000)
    addressType: str = Field(default='PERMANENT', max_length=20)
    notes: str = Field(default='', max_length=1000)


class SupplementArgs(CaseIdArgs):
    additionalDescription: str = Field(default='', max_length=2000)


class CommentArgs(CaseIdArgs):
    content: str = Field(min_length=1, max_length=2000)


def _spec(name: str, description: str, args: type[BaseModel], roles: tuple[str, ...],
          write: bool = False) -> dict:
    async def handler(arguments: dict, user: dict):
        # Lazy imports keep the registry independent from service initialization.
        from app.services.agent_tool_service import invoke_read, prepare_action
        if write:
            return await prepare_action(name, arguments, user)
        return await invoke_read(name, arguments, user)

    return {'name': name, 'description': description, 'args': args, 'argumentsSchema': args,
            'allowedRoles': roles,
            'readOnly': not write, 'requiresConfirmation': write, 'handler': handler}


STUDENT = ('STUDENT',)

TOOL_REGISTRY = {
    item['name']: item for item in [
        _spec('get_my_profile', 'Xem hồ sơ tài khoản hiện tại.', EmptyArgs, STUDENT),
        _spec('get_my_sis_record', 'Xem bản ghi SIS gắn với tài khoản sinh viên hiện tại.', EmptyArgs, STUDENT),
        _spec('list_my_cases', 'Liệt kê hồ sơ thuộc chính sinh viên đang đăng nhập.', CaseListArgs, STUDENT),
        _spec('get_case_detail', 'Xem chi tiết hồ sơ thuộc sinh viên đang đăng nhập.', CaseIdArgs, STUDENT),
        _spec('get_case_comments', 'Xem trao đổi trong hồ sơ thuộc sinh viên đang đăng nhập.', CaseIdArgs, STUDENT),
        _spec('get_notifications', 'Xem thông báo của tài khoản hiện tại.', EmptyArgs, STUDENT),
        _spec('normalize_address', 'Chuẩn hóa địa chỉ bằng service hiện có; không kết luận pháp lý.', AddressArgs, STUDENT),
        _spec('explain_case_decision', 'Giải thích kết quả Rule Engine đã lưu của hồ sơ thuộc sinh viên.', CaseIdArgs, STUDENT),
        _spec('search_policy', 'Tìm tài liệu nghiệp vụ được phép trong knowledge base RAG.', SearchArgs, STUDENT),
        _spec('get_workflow_requirements', 'Tra cứu yêu cầu workflow nội bộ từ tài liệu và policy registry.', SearchArgs, STUDENT),
        _spec('create_case', 'Tạo bản nháp yêu cầu; category luôn là MILITARY_SERVICE_CONFIRMATION.', CreateCaseArgs, STUDENT, True),
        _spec('supplement_case', 'Chuẩn bị bổ sung hồ sơ thuộc sinh viên hiện tại.', SupplementArgs, STUDENT, True),
        _spec('add_case_comment', 'Chuẩn bị thêm bình luận vào hồ sơ thuộc sinh viên hiện tại.', CommentArgs, STUDENT, True),
        _spec('mark_notification_read', 'Đánh dấu thông báo của chính sinh viên đã đọc.', NotificationArgs, STUDENT, True),
        _spec('mark_all_notifications_read', 'Đánh dấu toàn bộ thông báo của chính sinh viên đã đọc.', EmptyArgs, STUDENT, True),
    ]
}


def tools_for_role(role: str) -> list[dict]:
    return [{'name': spec['name'], 'description': spec['description'], 'arguments': spec['args'].model_json_schema()}
            for spec in TOOL_REGISTRY.values() if role in spec['allowedRoles']]


def validate_tool_call(name: str, arguments: dict, role: str) -> tuple[dict | None, dict | None]:
    spec = TOOL_REGISTRY.get(name)
    if not spec or role not in spec['allowedRoles']:
        return None, spec
    parsed = spec['args'].model_validate(arguments)
    return parsed.model_dump(exclude_none=True), spec
