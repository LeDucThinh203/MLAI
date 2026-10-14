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

export const CASE_CATEGORY_LABELS = {
  MILITARY_SERVICE_CONFIRMATION: 'xác nhận tình trạng sinh viên để hoàn thiện hồ sơ nghĩa vụ quân sự'
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

const STUDENT_AGENT_TERM_LABELS = {
  ...CASE_CATEGORY_LABELS,
  ...CASE_STATUS_LABELS,
  ...USER_ROLE_LABELS,
  ...RULE_DECISION_LABELS,
  ...REVIEW_REASON_LABELS,
  ...ADDRESS_TYPE_LABELS,
  AUTO_APPROVE: 'được hệ thống xử lý tự động trong quy trình nội bộ',
  create_case: 'tạo yêu cầu',
  supplement_case: 'bổ sung hồ sơ',
  add_case_comment: 'trao đổi trên hồ sơ',
  list_my_cases: 'xem danh sách hồ sơ',
  get_case_detail: 'xem chi tiết hồ sơ',
  get_case_comments: 'xem trao đổi trong hồ sơ',
  get_my_profile: 'xem thông tin tài khoản',
  get_notifications: 'xem thông báo',
  mark_notification_read: 'đánh dấu thông báo đã đọc',
  mark_all_notifications_read: 'đánh dấu thông báo đã đọc',
  normalize_address: 'chuẩn hóa địa chỉ',
  explain_case_decision: 'giải thích kết quả xử lý hồ sơ',
  search_policy: 'tra cứu hướng dẫn',
  get_workflow_requirements: 'tra cứu yêu cầu xử lý',
  confirm_action: 'xác nhận thao tác',
  cancel_action: 'hủy thao tác',
  TOOL_CALL: 'thao tác hệ thống',
  ANSWER: 'câu trả lời',
  CASE_CREATED: 'đã tạo yêu cầu',
  CASE_SUBMITTED: 'đã tiếp nhận hồ sơ, chờ xem xét',
  CASE_AUTO_APPROVED: 'được xử lý tự động trong quy trình nội bộ',
  CASE_ESCALATED: 'cần cán bộ xem xét thêm',
  GENERAL: 'yêu cầu khác',
  PENDING_ACTION: 'đang chờ bạn xác nhận',
  EXECUTING: 'đang thực hiện',
  EXECUTED: 'đã thực hiện',
  CANCELLED: 'đã hủy',
  FAILED: 'chưa thực hiện được',
  ACTIVE: 'đang hoạt động',
  INACTIVE: 'không còn hoạt động',
  UNKNOWN: 'chưa xác định',
  PROCESSING: 'đang được xử lý',
  IN_PROGRESS: 'đang được xử lý',
  COMPLETED: 'đã hoàn tất',
  SUCCESS: 'đã hoàn tất',
  ERROR: 'đã xảy ra lỗi',
  WARNING: 'cần lưu ý',
  SIS: 'thông tin nhà trường',
  NVQS: 'nghĩa vụ quân sự',
  MSSV: 'mã sinh viên',
  HCM: 'Thành phố Hồ Chí Minh',
  OTP: 'mã xác minh',
  OCR: 'đọc chữ từ tài liệu',
  RAG: 'tài liệu hướng dẫn',
  API: 'kết nối hệ thống',
  JSON: 'dữ liệu hệ thống',
  PDF: 'tệp PDF',
  DOCX: 'tệp Word',
  PNG: 'ảnh',
  JPG: 'ảnh',
  AI: 'trợ lý',
  ADMIN: 'quản trị viên',
  RuleEngine: 'hệ thống xử lý tự động',
  responseType: 'loại phản hồi',
  toolCalls: 'thao tác hệ thống',
  conversationId: 'cuộc trò chuyện',
  caseId: 'mã hồ sơ',
  studentCode: 'mã sinh viên',
  addressType: 'loại địa chỉ',
  rawAddress: 'địa chỉ đã cung cấp',
  additionalDescription: 'nội dung bổ sung',
  pendingAction: 'thao tác đang chờ xác nhận',
  durationMs: 'thời lượng xử lý',
  dataSources: 'thông tin đã tra cứu',
  ocrStatus: 'tình trạng đọc tài liệu',
  mimeType: 'loại tài liệu',
  originalName: 'tên tài liệu',
  workflow: 'quy trình',
  category: 'loại yêu cầu',
  status: 'trạng thái',
  field: 'thông tin',
  schema: 'cấu trúc dữ liệu',
  database: 'hệ thống lưu trữ',
  endpoint: 'chức năng',
  source: 'nguồn thông tin',
  record: 'hồ sơ',
  request: 'yêu cầu',
  profile: 'thông tin tài khoản',
  message: 'tin nhắn',
  response: 'câu trả lời',
  system: 'hệ thống',
  tool: 'chức năng',
  provenance: 'nguồn thông tin',
  fallback: 'chế độ dự phòng',
  'knowledge base': 'tài liệu hướng dẫn',
  'student information system': 'thông tin do nhà trường lưu',
  'tool call': 'thao tác hệ thống',
  'Rule Engine': 'hệ thống xử lý tự động',
  'AI Agent': 'trợ lý EDUASSISTANT'
};

const ENGLISH_STUDENT_AGENT_TERM_LABELS = {
  MILITARY_SERVICE_CONFIRMATION: 'student-status confirmation for military-service paperwork',
  SUBMITTED: 'received and waiting for review',
  RESUBMITTED: 'supplementary information received',
  UNDER_REVIEW: 'being reviewed',
  APPROVED: 'approved within the internal process',
  REJECTED: 'not approved within the internal process',
  REQUIRES_SUPPLEMENT: 'more information is needed',
  INFO_REQUESTED: 'more information is needed',
  STOPPED: 'processing has stopped',
  PENDING: 'waiting for confirmation',
  PENDING_ACTION: 'waiting for your confirmation',
  EXECUTING: 'being processed',
  EXECUTED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'could not be completed',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  UNKNOWN: 'not yet known',
  PROCESSING: 'being processed',
  IN_PROGRESS: 'being processed',
  COMPLETED: 'completed',
  SUCCESS: 'completed',
  ERROR: 'an error occurred',
  WARNING: 'needs attention',
  AUTO_APPROVE: 'processed automatically within the internal process',
  ESCALATE_TO_HUMAN: 'needs further staff review',
  FACT_UNKNOWN: 'some required information is missing',
  DATA_CONFLICT: 'the information does not match the school record',
  AUTHORITY_REQUIRED: 'needs review by an authorized staff member',
  POLICY_OUT_OF_SCOPE: 'needs a separate review',
  OWNERSHIP_UNCLEAR: 'the student information does not match',
  PERMANENT: 'permanent address',
  TEMPORARY: 'temporary address',
  STUDENT: 'student',
  REVIEWER: 'staff member',
  create_case: 'prepare a request',
  supplement_case: 'add information to a request',
  add_case_comment: 'send a message about the request',
  list_my_cases: 'view your requests',
  get_case_detail: 'view request details',
  get_case_comments: 'view messages about the request',
  get_my_profile: 'view account information',
  get_notifications: 'view notifications',
  mark_notification_read: 'mark a notification as read',
  mark_all_notifications_read: 'mark notifications as read',
  normalize_address: 'format the address',
  explain_case_decision: 'explain the request result',
  search_policy: 'look up guidance',
  get_workflow_requirements: 'look up request requirements',
  confirm_action: 'confirm the action',
  cancel_action: 'cancel the action',
  TOOL_CALL: 'system action',
  ANSWER: 'answer',
  CASE_CREATED: 'request created',
  CASE_SUBMITTED: 'request received and waiting for review',
  CASE_AUTO_APPROVED: 'processed automatically within the internal process',
  CASE_ESCALATED: 'needs further staff review',
  GENERAL: 'other request',
  SIS: 'school records',
  NVQS: 'military service',
  MSSV: 'student ID',
  HCM: 'Ho Chi Minh City',
  OTP: 'verification code',
  OCR: 'reading text from a document',
  RAG: 'reference documents',
  API: 'system connection',
  JSON: 'system data',
  PDF: 'PDF file',
  DOCX: 'Word file',
  PNG: 'image',
  JPG: 'image',
  AI: 'assistant',
  ADMIN: 'administrator',
  RuleEngine: 'automated system checks',
  responseType: 'response type',
  toolCalls: 'system actions',
  conversationId: 'conversation',
  caseId: 'request number',
  studentCode: 'student ID',
  addressType: 'address type',
  rawAddress: 'provided address',
  additionalDescription: 'additional information',
  pendingAction: 'action awaiting confirmation',
  durationMs: 'processing time',
  dataSources: 'information checked',
  ocrStatus: 'document reading status',
  mimeType: 'document type',
  originalName: 'document name',
  workflow: 'process',
  category: 'request type',
  status: 'status',
  field: 'information',
  schema: 'data structure',
  database: 'storage system',
  endpoint: 'feature',
  source: 'source',
  record: 'record',
  request: 'request',
  profile: 'account information',
  message: 'message',
  response: 'answer',
  system: 'system',
  tool: 'feature',
  provenance: 'source',
  fallback: 'backup mode',
  'knowledge base': 'reference documents',
  'student information system': 'school records',
  'tool call': 'system action',
  'Rule Engine': 'automated system checks',
  'AI Agent': 'EDUASSISTANT assistant'
};

const hasVietnameseText = value => /[ăâđêôơưĂÂĐÊÔƠƯàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹÀÁẠẢÃÈÉẸẺẼÌÍỊỈĨÒÓỌỎÕÙÚỤỦŨỲÝỴỶỸ]/.test(value);
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function replaceWholeTerm(text, term, label) {
  const escaped = escapeRegExp(term);
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'giu');
  return text.replace(pattern, (_, prefix) => `${prefix}${label}`);
}

function friendlyUnknownCode(code, isVietnamese) {
  const statusCode = code.match(/^CASE_STATUS_(.+)$/i);
  if (statusCode) {
    const status = statusCode[1].toUpperCase();
    const label = isVietnamese ? CASE_STATUS_LABELS[status] : ENGLISH_STUDENT_AGENT_TERM_LABELS[status];
    if (label) return label;
  }
  const categoryCode = code.match(/^CASE_CATEGORY_(.+)$/i);
  if (categoryCode) {
    const category = categoryCode[1].toUpperCase();
    const label = isVietnamese ? CASE_CATEGORY_LABELS[category] : ENGLISH_STUDENT_AGENT_TERM_LABELS[category];
    if (label) return label;
  }
  if (/SUPPLEMENT|MISSING|NEED|REQUEST_INFO/i.test(code)) return isVietnamese ? 'cần bổ sung thông tin' : 'more information is needed';
  if (/ESCALAT|HUMAN|REVIEW|AUTHORITY/i.test(code)) return isVietnamese ? 'cần cán bộ xem xét thêm' : 'needs further staff review';
  if (/APPROV|ACCEPT|PASSED/i.test(code)) return isVietnamese ? 'được chấp thuận trong quy trình nội bộ' : 'approved within the internal process';
  if (/REJECT|DENY|FAIL|ERROR/i.test(code)) return isVietnamese ? 'chưa được chấp thuận trong quy trình nội bộ' : 'could not be completed';
  if (/PROCESS|PROGRESS|EXECUT/i.test(code)) return isVietnamese ? 'đang được xử lý' : 'being processed';
  if (/PENDING|WAIT|SUBMIT/i.test(code)) return isVietnamese ? 'đang chờ xử lý' : 'waiting to be processed';
  if (/CANCEL|STOP/i.test(code)) return isVietnamese ? 'đã dừng xử lý' : 'processing has stopped';
  return isVietnamese ? 'thông tin xử lý trong hệ thống' : 'internal processing information';
}

export function formatStudentAgentMessage(message) {
  let text = String(message ?? '');
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === 'string') text = parsed.message;
    else if (typeof parsed === 'string') text = parsed;
    else if (parsed && typeof parsed === 'object') text = 'Mình chưa thể trình bày thông tin này bằng ngôn ngữ dễ hiểu.';
  } catch {
    // The chat renderer also accepts ordinary text, not only JSON responses.
  }

  const isVietnamese = hasVietnameseText(text);
  const labels = isVietnamese ? STUDENT_AGENT_TERM_LABELS : ENGLISH_STUDENT_AGENT_TERM_LABELS;
  for (const [term, label] of Object.entries(labels).sort(([left], [right]) => right.length - left.length)) {
    text = replaceWholeTerm(text, term, label);
  }

  const snakeIdentifier = /(^|[^\p{L}\p{N}_])([\p{L}\p{N}]+(?:_[\p{L}\p{N}]+)+)(?=$|[^\p{L}\p{N}_])/gu;
  text = text.replace(snakeIdentifier, (_, prefix, code) => `${prefix}${friendlyUnknownCode(code, isVietnamese)}`);

  const uppercaseCode = /(^|[^\p{L}\p{N}_])([A-Z][A-Z_]{3,})(?=$|[^\p{L}\p{N}_])/gu;
  text = text.replace(uppercaseCode, (_, prefix, code) => code === 'EDUASSISTANT'
    ? `${prefix}${code}`
    : `${prefix}${friendlyUnknownCode(code, isVietnamese)}`);

  const camelIdentifier = /(^|[^\p{L}\p{N}_])([a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)(?=$|[^\p{L}\p{N}_])/gu;
  text = text.replace(camelIdentifier, (_, prefix) => `${prefix}${isVietnamese ? 'thông tin liên quan' : 'related information'}`);

  text = text
    .replace(/\bRule\s+Engine\b/gi, isVietnamese ? 'hệ thống xử lý tự động' : 'automated system checks')
    .replace(/\bAI\s+agent\b/gi, isVietnamese ? 'trợ lý EDUASSISTANT' : 'EDUASSISTANT assistant')
    .replace(/\btool\s+call(?:s)?\b/gi, isVietnamese ? 'thao tác hệ thống' : 'system action')
    .replace(/\bworkflow\b/gi, isVietnamese ? 'quy trình' : 'process')
    .replace(/\bcategory\b/gi, isVietnamese ? 'loại yêu cầu' : 'request type')
    .replace(/\bprovenance\b/gi, isVietnamese ? 'nguồn thông tin' : 'source')
    .replace(/\bfallback\b/gi, isVietnamese ? 'chế độ dự phòng' : 'backup mode');
  return text;
}
