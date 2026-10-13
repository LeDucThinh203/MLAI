import {
  ADDRESS_TYPE_LABELS,
  CASE_STATUS_LABELS,
  labelFor
} from '../../utils/displayLabels';

const ACTION_LABELS = {
  create_case: 'Tạo hồ sơ yêu cầu xác nhận',
  supplement_case: 'Gửi thông tin bổ sung cho hồ sơ',
  add_case_comment: 'Gửi trao đổi về hồ sơ',
  mark_notification_read: 'Đánh dấu thông báo đã xem',
  mark_all_notifications_read: 'Đánh dấu tất cả thông báo đã xem'
};

const ACTION_DESCRIPTIONS = {
  create_case: 'Kiểm tra lại thông tin bên dưới. Hồ sơ chỉ được gửi sau khi bạn xác nhận.',
  supplement_case: 'Nội dung bổ sung sẽ được thêm vào hồ sơ và chuyển lại cho cán bộ phụ trách.',
  add_case_comment: 'Trao đổi sẽ được thêm vào hồ sơ của bạn sau khi xác nhận.',
  mark_notification_read: 'Thông báo này sẽ được đánh dấu là đã xem.',
  mark_all_notifications_read: 'Tất cả thông báo hiện có sẽ được đánh dấu là đã xem.'
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
  additionalDescription: 'Nội dung bổ sung',
  comment: 'Nội dung trao đổi',
  warning: 'Lưu ý'
};

const HIDDEN_FIELDS = new Set(['toolName', 'notificationId']);

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
  if (key.toLowerCase().includes('status')) return labelFor(value, CASE_STATUS_LABELS);
  if (key === 'warning') return String(value);
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (Array.isArray(value)) return value.map(item => String(item)).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value).map(([childKey, childValue]) => `${fieldLabel(childKey)}: ${displayValue(childKey, childValue)}`).join(' · ');
  }
  return String(value);
}

function expiresAtLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'trong thời gian ngắn'
    : date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AgentActionCard({ action, onConfirm, onCancel, busy = false }) {
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
      <small className="agent-action-expiry">Chưa có thay đổi nào được lưu. Yêu cầu này có hiệu lực đến {expiresAtLabel(action.expiresAt)}; quá thời gian này bạn cần tạo lại yêu cầu.</small>
      <div className="agent-action-buttons">
        <button type="button" onClick={() => onConfirm(action)} disabled={busy}>
          {busy ? 'Đang xử lý…' : 'Xác nhận và tiếp tục'}
        </button>
        <button type="button" className="agent-secondary-button" onClick={() => onCancel(action)} disabled={busy}>Hủy yêu cầu</button>
      </div>
    </section>
  );
}
