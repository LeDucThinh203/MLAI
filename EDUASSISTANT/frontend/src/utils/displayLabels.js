export const CASE_STATUS_LABELS = {
  SUBMITTED: 'Đã tiếp nhận, chờ xem xét',
  RESUBMITTED: 'Đã gửi thông tin bổ sung',
  UNDER_REVIEW: 'Đang được xem xét',
  APPROVED: 'Đã chấp thuận trong quy trình nội bộ',
  REJECTED: 'Yêu cầu chưa được chấp thuận trong quy trình nội bộ',
  REQUIRES_SUPPLEMENT: 'Cần bổ sung thông tin',
  INFO_REQUESTED: 'Cần bổ sung thông tin',
  STOPPED: 'Đã dừng xử lý',
  PENDING: 'Đang chờ xác nhận',
  EXECUTING: 'Đang thực hiện',
  EXECUTED: 'Đã thực hiện',
  CANCELLED: 'Đã hủy',
  FAILED: 'Chưa thực hiện được'
};

export const USER_ROLE_LABELS = {
  STUDENT: 'Sinh viên',
  REVIEWER: 'Cán bộ xử lý hồ sơ',
  ADMIN: 'Quản trị viên'
};

export const RULE_DECISION_LABELS = {
  AUTO_APPROVE: 'Đủ điều kiện tiếp tục xử lý tự động',
  ESCALATE_TO_HUMAN: 'Cần cán bộ kiểm tra thêm'
};

export const REVIEW_REASON_LABELS = {
  OWNERSHIP_UNCLEAR: 'Thông tin sinh viên chưa khớp',
  FACT_UNKNOWN: 'Thiếu thông tin hoặc giấy tờ cần thiết',
  DATA_CONFLICT: 'Thông tin kê khai chưa khớp hồ sơ nhà trường',
  AUTHORITY_REQUIRED: 'Cần cán bộ có thẩm quyền xem xét',
  POLICY_OUT_OF_SCOPE: 'Yêu cầu cần được xem xét riêng',
  HUMAN_REVIEW: 'Cần cán bộ thẩm định xem xét'
};

export const ADDRESS_TYPE_LABELS = {
  PERMANENT: 'Thường trú',
  TEMPORARY: 'Tạm trú'
};

export const ACADEMIC_STATUS_LABELS = {
  ACTIVE: 'Đang học',
  SUSPENDED: 'Tạm dừng học',
  WITHDRAWN: 'Đã thôi học',
  GRADUATED: 'Đã tốt nghiệp',
  LEAVE_OF_ABSENCE: 'Đang bảo lưu',
  UNKNOWN: 'Chưa có thông tin'
};

export const SIS_RECORD_STATUS_LABELS = {
  ACTIVE: 'Đang sử dụng',
  SUSPENDED: 'Tạm ngưng sử dụng'
};

export const SIS_SOURCE_LABELS = {
  INTERNAL_DEMO_SIS: 'Dữ liệu mẫu nội bộ',
  INTERNAL_SIS_DEMO: 'Dữ liệu mẫu nội bộ',
  INSTITUTIONAL_SIS: 'Dữ liệu do nhà trường cung cấp',
  EXTERNAL_INSTITUTIONAL_SIS: 'Dữ liệu kết nối từ nhà trường',
  EXTERNAL_VERIFIED_SIS: 'Dữ liệu nhà trường đã xác nhận',
  SYNTHETIC_TEST_SIS: 'Dữ liệu kiểm tra mẫu',
  LEGACY_ACCOUNT: 'Thông tin tài khoản hiện có'
};

export const SIS_VERIFICATION_LABELS = {
  ADMIN_VERIFIED_DEMO: 'Quản trị viên đã kiểm tra dữ liệu mẫu',
  EXTERNAL_VERIFIED: 'Nhà trường đã xác nhận',
  TEST_VERIFIED: 'Đã xác nhận trong bộ dữ liệu kiểm tra',
  UNVERIFIED: 'Chưa được xác nhận',
  VERIFIED: 'Đã xác nhận'
};

const AUDIT_ACTION_LABELS = {
  AUTH_LOGIN: 'Đăng nhập',
  AUTH_REGISTER: 'Tạo tài khoản',
  ADMIN_ROLE_UPDATED: 'Cập nhật quyền tài khoản',
  USER_PROFILE_UPDATED: 'Cập nhật thông tin cá nhân',
  USER_PASSWORD_CHANGED: 'Đổi mật khẩu',
  USER_PASSWORD_CHANGE_FAILED: 'Đổi mật khẩu chưa thành công',
  USER_ACCOUNT_DELETED: 'Xóa tài khoản',
  '2FA_ENABLED': 'Bật xác thực hai bước',
  '2FA_DISABLED': 'Tắt xác thực hai bước',
  CASE_SUBMITTED: 'Gửi hồ sơ',
  CASE_AUTO_APPROVED: 'Hồ sơ được hệ thống xử lý tự động',
  CASE_ESCALATED: 'Hồ sơ được chuyển cho cán bộ xem xét',
  CASE_COMMENT_ADDED: 'Trao đổi trên hồ sơ',
  EVIDENCE_UPLOADED: 'Tải giấy tờ lên',
  OCR_EXTRACTION_PERFORMED: 'Đọc thông tin từ giấy tờ',
  REPORT_CSV_EXPORTED: 'Xuất bảng dữ liệu',
  AGENT_ACTION_REQUESTED: 'Chuẩn bị thao tác để xác nhận',
  AGENT_ACTION_CONFIRMED: 'Xác nhận thao tác',
  AGENT_ACTION_EXECUTED: 'Thực hiện thao tác đã xác nhận',
  AGENT_ACTION_CANCELLED: 'Hủy thao tác',
  AGENT_ACTION_FAILED: 'Thao tác chưa thực hiện được'
};

export function auditActionLabel(action) {
  if (!action) return 'Hoạt động hệ thống';
  if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action];
  if (action.startsWith('CASE_STATUS_')) {
    return `Cập nhật trạng thái hồ sơ: ${labelFor(action.slice('CASE_STATUS_'.length), CASE_STATUS_LABELS)}`;
  }
  return 'Hoạt động hệ thống';
}

export function labelFor(value, labels, fallback = 'Chưa có thông tin') {
  if (value == null || value === '') return fallback;
  return labels[value] || String(value).replaceAll('_', ' ').toLocaleLowerCase('vi-VN');
}
