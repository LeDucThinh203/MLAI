import React, { useState } from 'react';

const labels = {
  create_case: 'Tạo hồ sơ', supplement_case: 'Bổ sung hồ sơ', add_case_comment: 'Thêm bình luận',
  mark_notification_read: 'Đánh dấu thông báo đã đọc', mark_all_notifications_read: 'Đánh dấu tất cả đã đọc',
  review_case_approve: 'Phê duyệt nội bộ', review_case_reject: 'Từ chối nội bộ',
  review_case_request_info: 'Yêu cầu bổ sung', review_case_stop: 'Dừng workflow', review_case_override: 'Admin override',
  reroute_case: 'Điều phối hồ sơ', submit_reviewer_feedback: 'Gửi reviewer feedback',
  create_sis_record: 'Tạo bản ghi SIS demo', update_sis_record: 'Cập nhật SIS demo',
  verify_demo_sis_record: 'Xác minh SIS demo', create_user: 'Tạo tài khoản', update_user_role: 'Cập nhật vai trò'
};

function displayValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export default function AgentActionCard({ action, onConfirm, onCancel, busy = false }) {
  const [password, setPassword] = useState('');
  const preview = action?.preview || {};
  if (!action) return null;
  return (
    <section className="agent-action-card" aria-label="Thao tác cần xác nhận">
      <div className="agent-action-card-title">Cần bạn xác nhận</div>
      <p>{labels[action.toolName] || 'Thao tác hệ thống'}</p>
      <dl>
        {Object.entries(preview).filter(([key]) => key !== 'toolName').slice(0, 10).map(([key, value]) => (
          <div key={key}><dt>{key}</dt><dd>{displayValue(value)}</dd></div>
        ))}
      </dl>
      {action.toolName === 'create_user' && (
        <label className="agent-secure-field">
          Mật khẩu tạm thời (chỉ gửi khi xác nhận)
          <input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} minLength={6} />
        </label>
      )}
      <small>Không có thay đổi nào được ghi cho đến khi bạn xác nhận. Yêu cầu hết hạn lúc {new Date(action.expiresAt).toLocaleTimeString()}.</small>
      <div className="agent-action-buttons">
        <button type="button" onClick={() => onConfirm(action, action.toolName === 'create_user' ? { password } : undefined)} disabled={busy || (action.toolName === 'create_user' && password.length < 6)}>
          Xác nhận
        </button>
        <button type="button" className="agent-secondary-button" onClick={() => onCancel(action)} disabled={busy}>Hủy</button>
      </div>
    </section>
  );
}
