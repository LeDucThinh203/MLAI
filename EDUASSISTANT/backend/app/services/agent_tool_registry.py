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


class ReviewArgs(CaseIdArgs):
    reason: str = Field(min_length=3, max_length=1000)


class ReviewOverrideArgs(ReviewArgs):
    targetStatus: str = Field(default='APPROVED', pattern='^(APPROVED|REJECTED|REQUIRES_SUPPLEMENT|STOPPED)$')


class RerouteArgs(CaseIdArgs):
    department: str = Field(min_length=2, max_length=200)


class FeedbackArgs(CaseIdArgs):
    type: str = Field(min_length=3, max_length=40)
    note: str = Field(default='', max_length=1000)


class AdminSisSearchArgs(Args):
    search: str = Field(default='', max_length=100)
    academicStatus: str = Field(default='', max_length=40)
    faculty: str = Field(default='', max_length=100)
    recordStatus: str = Field(default='', max_length=40)
    verificationStatus: str = Field(default='', max_length=50)
    limit: int = Field(default=20, ge=1, le=50)


class SisIdArgs(Args):
    recordId: str = Field(min_length=1, max_length=100)


class CreateSisArgs(Args):
    userId: str = Field(min_length=1, max_length=100)
    fullName: str = Field(min_length=1, max_length=255)
    studentCode: Optional[str] = Field(default=None, max_length=100)
    academicStatus: Optional[str] = Field(default=None, max_length=50)
    courseStartDate: Optional[str] = Field(default=None, max_length=20)
    courseEndDate: Optional[str] = Field(default=None, max_length=20)
    currentTermActive: Optional[bool] = None
    hasCurrentSchedule: Optional[bool] = None
    registeredPermanentAddress: Optional[str] = Field(default=None, max_length=1000)
    faculty: Optional[str] = Field(default=None, max_length=255)
    recordStatus: Optional[str] = Field(default=None, max_length=50)


class UpdateSisArgs(SisIdArgs):
    fullName: str = Field(min_length=1, max_length=255)
    studentCode: Optional[str] = Field(default=None, max_length=100)
    academicStatus: Optional[str] = Field(default=None, max_length=50)
    courseStartDate: Optional[str] = Field(default=None, max_length=20)
    courseEndDate: Optional[str] = Field(default=None, max_length=20)
    currentTermActive: Optional[bool] = None
    hasCurrentSchedule: Optional[bool] = None
    registeredPermanentAddress: Optional[str] = Field(default=None, max_length=1000)
    faculty: Optional[str] = Field(default=None, max_length=255)
    recordStatus: Optional[str] = Field(default=None, max_length=50)


class VerifySisArgs(SisIdArgs):
    reason: str = Field(min_length=3, max_length=1000)


class UserRoleArgs(Args):
    userId: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=4, max_length=20)


class CreateUserArgs(Args):
    username: str = Field(min_length=3, max_length=100)
    fullName: str = Field(min_length=1, max_length=255)
    role: str = Field(default='STUDENT', pattern='^(STUDENT|REVIEWER|ADMIN)$')
    studentCode: Optional[str] = Field(default=None, max_length=100)
    department: Optional[str] = Field(default=None, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)


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


ALL = ('STUDENT', 'REVIEWER', 'ADMIN')
STAFF = ('REVIEWER', 'ADMIN')
ADMIN = ('ADMIN',)

TOOL_REGISTRY = {
    item['name']: item for item in [
        _spec('get_my_profile', 'Xem hồ sơ tài khoản hiện tại.', EmptyArgs, ('STUDENT',)),
        _spec('get_my_sis_record', 'Xem bản ghi SIS gắn với tài khoản sinh viên hiện tại.', EmptyArgs, ('STUDENT',)),
        _spec('list_my_cases', 'Liệt kê hồ sơ thuộc chính sinh viên đang đăng nhập.', CaseListArgs, ('STUDENT',)),
        _spec('list_cases', 'Liệt kê hồ sơ trong hàng đợi reviewer.', CaseListArgs, STAFF),
        _spec('get_case_detail', 'Xem chi tiết hồ sơ; sinh viên chỉ xem hồ sơ của mình.', CaseIdArgs, ALL),
        _spec('get_case_comments', 'Xem trao đổi của hồ sơ mà người dùng được phép truy cập.', CaseIdArgs, ALL),
        _spec('get_notifications', 'Xem thông báo của tài khoản hiện tại.', EmptyArgs, ALL),
        _spec('normalize_address', 'Chuẩn hóa địa chỉ bằng service hiện có; không kết luận pháp lý.', AddressArgs, ('STUDENT',)),
        _spec('explain_case_decision', 'Giải thích kết quả Rule Engine đã lưu của hồ sơ.', CaseIdArgs, ALL),
        _spec('search_policy', 'Tìm tài liệu nghiệp vụ được phép trong knowledge base RAG.', SearchArgs, ALL),
        _spec('get_workflow_requirements', 'Tra cứu yêu cầu workflow nội bộ từ tài liệu và policy registry.', SearchArgs, ALL),
        _spec('evaluate_case_rules', 'Chạy lại Rule Engine hiện có trên dữ liệu hồ sơ được phép xem.', CaseIdArgs, STAFF),
        _spec('get_audit_for_case', 'Tra cứu audit liên quan một hồ sơ.', CaseIdArgs, STAFF),
        _spec('get_current_threshold', 'Xem ngưỡng Rule Engine hiện tại.', EmptyArgs, STAFF),
        _spec('list_sis_records', 'Liệt kê bản ghi SIS nội bộ cho Admin.', AdminSisSearchArgs, ADMIN),
        _spec('get_sis_record', 'Xem một bản ghi SIS nội bộ cho Admin.', SisIdArgs, ADMIN),
        _spec('list_users', 'Liệt kê trường hồ sơ không nhạy cảm của người dùng.', EmptyArgs, ADMIN),
        _spec('get_admin_metrics', 'Xem thống kê quản trị hệ thống.', EmptyArgs, ADMIN),
        _spec('get_policy_registry', 'Xem runtime policy registry và trạng thái ngưỡng.', EmptyArgs, ADMIN),
        _spec('get_threshold_history', 'Xem lịch sử thay đổi adaptive threshold.', EmptyArgs, ADMIN),
        _spec('get_audits', 'Xem audit gần đây theo giới hạn an toàn.', EmptyArgs, ADMIN),
        _spec('create_case', 'Tạo bản nháp yêu cầu; category luôn là MILITARY_SERVICE_CONFIRMATION.', CreateCaseArgs, ('STUDENT',), True),
        _spec('supplement_case', 'Chuẩn bị bổ sung hồ sơ thuộc sinh viên hiện tại.', SupplementArgs, ('STUDENT',), True),
        _spec('add_case_comment', 'Chuẩn bị thêm bình luận vào hồ sơ được phép truy cập.', CommentArgs, ALL, True),
        _spec('mark_notification_read', 'Đánh dấu thông báo của chính người dùng đã đọc.', NotificationArgs, ALL, True),
        _spec('mark_all_notifications_read', 'Đánh dấu toàn bộ thông báo của chính người dùng đã đọc.', EmptyArgs, ALL, True),
        _spec('review_case_approve', 'Chuẩn bị đề xuất phê duyệt nội bộ; cần xác nhận người dùng.', ReviewArgs, STAFF, True),
        _spec('review_case_reject', 'Chuẩn bị đề xuất từ chối nội bộ; cần xác nhận người dùng.', ReviewArgs, STAFF, True),
        _spec('review_case_request_info', 'Chuẩn bị đề xuất yêu cầu bổ sung; cần xác nhận người dùng.', ReviewArgs, STAFF, True),
        _spec('review_case_stop', 'Chuẩn bị đề xuất dừng workflow; cần xác nhận người dùng.', ReviewArgs, STAFF, True),
        _spec('review_case_override', 'Admin chuẩn bị override có lý do; workflow guard vẫn được áp dụng.', ReviewOverrideArgs, ADMIN, True),
        _spec('reroute_case', 'Chuẩn bị điều phối hồ sơ sang đơn vị khác.', RerouteArgs, STAFF, True),
        _spec('submit_reviewer_feedback', 'Chuẩn bị ghi nhận reviewer feedback và cập nhật ngưỡng.', FeedbackArgs, STAFF, True),
        _spec('create_sis_record', 'Chuẩn bị tạo bản ghi nội bộ demo SIS chưa xác minh.', CreateSisArgs, ADMIN, True),
        _spec('update_sis_record', 'Chuẩn bị cập nhật bản ghi demo SIS; cập nhật sẽ xóa trạng thái xác minh cũ.', UpdateSisArgs, ADMIN, True),
        _spec('verify_demo_sis_record', 'Đánh dấu bản ghi SIS nội bộ đã kiểm tra cho demo, không phải SIS thật.', VerifySisArgs, ADMIN, True),
        _spec('create_user', 'Chuẩn bị tạo tài khoản Admin; mật khẩu chỉ nhập ở form xác nhận an toàn.', CreateUserArgs, ADMIN, True),
        _spec('update_user_role', 'Chuẩn bị cập nhật vai trò tài khoản; cần xác nhận Admin.', UserRoleArgs, ADMIN, True),
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
