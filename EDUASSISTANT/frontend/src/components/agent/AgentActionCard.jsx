import React, { useState } from 'react';
import {
  ADDRESS_TYPE_LABELS,
  CASE_STATUS_LABELS,
  REVIEW_REASON_LABELS,
  RULE_DECISION_LABELS,
  SIS_RECORD_STATUS_LABELS,
  SIS_SOURCE_LABELS,
  SIS_VERIFICATION_LABELS,
  USER_ROLE_LABELS,
  labelFor
} from '../../utils/displayLabels';

const ACTION_LABELS = {
  create_case: 'Tạo hồ sơ yêu cầu xác nhận',
  supplement_case: 'Gửi thông tin bổ sung cho hồ sơ',
  add_case_comment: 'Gửi trao đổi về hồ sơ',
  mark_notification_read: 'Đánh dấu thông báo đã xem',
  mark_all_notifications_read: 'Đánh dấu tất cả thông báo đã xem',
  review_case_approve: 'Chấp thuận yêu cầu nội bộ',
  review_case_reject: 'Không chấp thuận yêu cầu',
  review_case_request_info: 'Yêu cầu sinh viên bổ sung thông tin',
  review_case_stop: 'Dừng xử lý hồ sơ',
  review_case_override: 'Điều chỉnh kết quả xử lý',
  reroute_case: 'Chuyển hồ sơ đến bộ phận khác',
  submit_reviewer_feedback: 'Gửi nhận xét về kết quả kiểm tra',
  create_sis_record: 'Thêm thông tin sinh viên mẫu',
  update_sis_record: 'Cập nhật thông tin sinh viên',
  verify_demo_sis_record: 'Xác nhận dữ liệu mẫu nội bộ',
  create_user: 'Tạo tài khoản người dùng',
  update_user_role: 'Cập nhật quyền tài khoản'
};

const ACTION_DESCRIPTIONS = {
  create_case: 'Kiểm tra lại thông tin bên dưới. Hồ sơ chỉ được gửi sau khi bạn xác nhận.',
  supplement_case: 'Nội dung bổ sung sẽ được thêm vào hồ sơ và chuyển lại cho cán bộ phụ trách.',
  mark_notification_read: 'Thông báo này sẽ được đánh dấu là đã xem.',
  mark_all_notifications_read: 'Tất cả thông báo hiện có sẽ được đánh dấu là đã xem.',
  review_case_approve: 'Đây là kết quả xử lý nội bộ của hồ sơ, không phải quyết định tạm hoãn nghĩa vụ quân sự.',
  review_case_reject: 'Hãy kiểm tra mã hồ sơ và lý do trước khi xác nhận.',
  review_case_override: 'Thao tác này thay đổi kết quả xử lý nội bộ của hồ sơ.',
  review_case_stop: 'Hồ sơ sẽ dừng được xử lý trong hệ thống sau khi bạn xác nhận.',
  create_sis_record: 'Đây là dữ liệu mẫu nội bộ, không phải kết nối với cơ sở dữ liệu chính thức của nhà trường.',
  verify_demo_sis_record: 'Xác nhận này chỉ áp dụng cho dữ liệu mẫu nội bộ.'
};

const FIELD_LABELS = {
  title: 'Tên hồ sơ',
  category: 'Loại yêu cầu',
  addressType: 'Loại địa chỉ',
  rawAddress: 'Địa chỉ bạn cung cấp',
  note: 'Thông tin thêm',
  caseId: 'Mã hồ sơ',
  notificationTitle: 'Thông báo được chọn',
  currentStatus: 'Trạng thái hiện tại',
  newStatus: 'Trạng thái sau khi xác nhận',
  status: 'Trạng thái',
  reason: 'Lý do',
  systemRecommendation: 'Gợi ý của hệ thống',
  department: 'Bộ phận tiếp nhận',
  additionalDescription: 'Nội dung bổ sung',
  comment: 'Nội dung trao đổi',
  feedbackType: 'Loại nhận xét',
  warning: 'Lưu ý',
  studentCode: 'Mã số sinh viên',
  fullName: 'Họ và tên sinh viên',
  username: 'Tên đăng nhập',
  role: 'Vai trò tài khoản',
  currentRole: 'Vai trò hiện tại',
  newRole: 'Vai trò mới',
  verificationStatus: 'Mức xác nhận dữ liệu',
  recordStatus: 'Tình trạng thông tin',
  sourceType: 'Nguồn dữ liệu'
};

const HIDDEN_FIELDS = new Set(['toolName', 'userId', 'recordId', 'notificationId']);
const FEEDBACK_LABELS = {
  CORRECT: 'Kết quả phù hợp',
  MISSED_ESCALATION: 'Đáng lẽ cần cán bộ xem xét',
  UNNECESSARY_ESCALATION: 'Chuyển cán bộ xem xét chưa cần thiết'
};

function fieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^./, character => character.toLocaleUpperCase('vi-VN'));
}

function displayValue(key, value) {
  if (value == null || value === '') return 'Chưa có thông tin';
  if (key === 'category' && value === 'MILITARY_SERVICE_CONFIRMATION') return 'Xác nhận tình trạng sinh viên';
  if (key === 'addressType') return labelFor(value, ADDRESS_TYPE_LABELS);
  if (key.toLowerCase().includes('status')) return labelFor(value, { ...CASE_STATUS_LABELS, ...SIS_RECORD_STATUS_LABELS, ...SIS_VERIFICATION_LABELS });
  if (key.toLowerCase().includes('role')) return labelFor(value, USER_ROLE_LABELS);
  if (key === 'systemRecommendation') return labelFor(value, RULE_DECISION_LABELS);
  if (key === 'sourceType') return labelFor(value, SIS_SOURCE_LABELS);
  if (key === 'feedbackType') return labelFor(value, FEEDBACK_LABELS);
  if (key === 'reason' || key === 'escalationReason') return labelFor(value, REVIEW_REASON_LABELS, String(value));
  if (key === 'warning') return String(value);
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (Array.isArray(value)) return value.map(item => String(item)).join(', ');
  if (typeof value === 'object') return Object.entries(value).map(([childKey, childValue]) => `${fieldLabel(childKey)}: ${displayValue(childKey, childValue)}`).join(' · ');
  return String(value);
}

function expiresAtLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'trong thời gian ngắn'
    : date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AgentActionCard({ action, onConfirm, onCancel, busy = false }) {
  const [password, setPassword] = useState('');
  if (!action) return null;
  const preview = action.preview || {};
  const entries = Object.entries(preview).filter(([key]) => !HIDDEN_FIELDS.has(key)).slice(0, 10);

  return (
    <section className="agent-action-card" aria-label="Thao tác cần xác nhận">
      <div className="agent-action-card-title">Vui lòng kiểm tra trước khi xác nhận</div>
      <h3>{ACTION_LABELS[action.toolName] || 'Xác nhận thao tác'}</h3>
      {ACTION_DESCRIPTIONS[action.toolName] && <p className="agent-action-description">{ACTION_DESCRIPTIONS[action.toolName]}</p>}
      {entries.length > 0 && <dl>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{fieldLabel(key)}</dt>
            <dd>{displayValue(key, value)}</dd>
          </div>
        ))}
      </dl>}
      {action.toolName === 'create_user' && (
        <label className="agent-secure-field">
          Mật khẩu ban đầu cho tài khoản mới
          <input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} minLength={6} />
          <small>Mật khẩu chỉ được gửi khi bạn xác nhận và không lưu trong nội dung trò chuyện.</small>
        </label>
      )}
      <small className="agent-action-expiry">Chưa có thay đổi nào được lưu. Yêu cầu này có hiệu lực đến {expiresAtLabel(action.expiresAt)}; quá thời gian này bạn cần tạo lại yêu cầu.</small>
      <div className="agent-action-buttons">
        <button type="button" onClick={() => onConfirm(action, action.toolName === 'create_user' ? { password } : undefined)} disabled={busy || (action.toolName === 'create_user' && password.length < 6)}>
          {busy ? 'Đang xử lý…' : 'Xác nhận và tiếp tục'}
        </button>
        <button type="button" className="agent-secondary-button" onClick={() => onCancel(action)} disabled={busy}>Hủy yêu cầu</button>
      </div>
    </section>
  );
}
