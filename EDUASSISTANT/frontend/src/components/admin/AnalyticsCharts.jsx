import React from 'react';

const STATUS = [
  ['Chờ duyệt', 'SUBMITTED', '#38bdf8'], ['Đang xử lý', 'UNDER_REVIEW', '#fbbf24'],
  ['Bổ sung', 'REQUIRES_SUPPLEMENT', '#f97316'], ['Đã duyệt', 'APPROVED', '#34d399'], ['Từ chối', 'REJECTED', '#f87171']
];
const REASONS = [
  ['OWNERSHIP_UNCLEAR', 'Thông tin sinh viên chưa khớp', '#ef4444'],
  ['FACT_UNKNOWN', 'Thiếu hoặc khó đọc minh chứng', '#f97316'],
  ['DATA_CONFLICT', 'Thông tin kê khai chưa khớp', '#eab308'],
  ['AUTHORITY_REQUIRED', 'Cần hội đồng xem xét', '#8b5cf6'],
  ['POLICY_OUT_OF_SCOPE', 'Yêu cầu ngoài quy định', '#06b6d4']
];

export default function AnalyticsCharts({ stats }) {
  const total = stats.totalCases || 0;
  const status = stats.statusBreakdown || {};
  const reasons = stats.escalationReasonsBreakdown || {};
  let offset = 0;
  const radius = 52, circumference = 2 * Math.PI * radius;
  const maxReason = Math.max(1, ...REASONS.map(([key]) => reasons[key] || 0));

  return <div className="analytics-grid">
    <section className="analytics-card">
      <div><h3>Phân bố trạng thái</h3><p>Tỷ trọng hồ sơ hiện tại</p></div>
      <div className="donut-layout">
        <svg className="donut-chart" viewBox="0 0 140 140" role="img" aria-label="Biểu đồ trạng thái hồ sơ">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#e7edf4" strokeWidth="16" />
          {STATUS.map(([label, key, color]) => {
            const portion = total ? (status[key] || 0) / total : 0;
            const dash = portion * circumference;
            const circle = <circle key={key} cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="16" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />;
            offset += dash;
            return circle;
          })}
          <text x="70" y="66" textAnchor="middle" className="donut-value">{total}</text><text x="70" y="83" textAnchor="middle" className="donut-label">hồ sơ</text>
        </svg>
        <div className="chart-legend">{STATUS.map(([label, key, color]) => <div key={key}><i style={{ background: color }} />{label}<strong>{status[key] || 0}</strong></div>)}</div>
      </div>
    </section>
    <section className="analytics-card">
      <div><h3>Lý do cần xem xét thêm</h3><p>Xếp hạng theo số hồ sơ cần cán bộ kiểm tra</p></div>
      <div className="bar-chart">{REASONS.map(([key, label, color]) => { const value = reasons[key] || 0; return <div className="bar-row" key={key}><span>{label}</span><div><b style={{ width: `${(value / maxReason) * 100}%`, background: color }} /></div><strong>{value}</strong></div>; })}</div>
    </section>
  </div>;
}
