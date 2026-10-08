import React, { useState } from 'react';
import {
  Search, RefreshCw, Calendar, Download,
  Clock, User, History, CalendarDays
} from 'lucide-react';
import { API_BASE } from '../../api/client';

const AuditTrailViewer = ({
  audits = [],
  token,
  onRefresh,
  loading = false,
  title = 'Nhật Ký Hoạt Động Toàn Trường (Audit Trail)',
  subtitle = 'Theo dõi minh bạch toàn bộ các hành động trên hệ thống theo ngày',
  showRoleFilter = true,
  isStudentView = false
}) => {
  const [dateFilterMode, setDateFilterMode] = useState('ALL'); // 'ALL', 'TODAY', 'YESTERDAY', '7DAYS', 'CUSTOM'
  const [customDate, setCustomDate] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupByDay, setGroupByDay] = useState(true);

  // Helper date strings
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date(Date.now() - 86400000);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
  const sevenDaysAgoDate = new Date(Date.now() - 7 * 86400000);
  const sevenDaysAgoStr = sevenDaysAgoDate.toISOString().slice(0, 10);

  // Counters
  const countToday = audits.filter(a => a.timestamp?.startsWith(todayStr)).length;
  const countYesterday = audits.filter(a => a.timestamp?.startsWith(yesterdayStr)).length;
  const count7Days = audits.filter(a => a.timestamp?.slice(0, 10) >= sevenDaysAgoStr).length;

  // Filtered Audits
  const filteredAudits = audits.filter(a => {
    const itemDate = a.timestamp?.slice(0, 10);
    
    // Date Filtering
    if (dateFilterMode === 'TODAY' && itemDate !== todayStr) return false;
    if (dateFilterMode === 'YESTERDAY' && itemDate !== yesterdayStr) return false;
    if (dateFilterMode === '7DAYS' && itemDate < sevenDaysAgoStr) return false;
    if (dateFilterMode === 'CUSTOM' && customDate && itemDate !== customDate) return false;

    // Role Filtering
    if (roleFilter !== 'ALL' && a.actor?.role !== roleFilter) return false;

    // Action Filtering
    if (actionFilter !== 'ALL' && a.action !== actionFilter) return false;

    // Search term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchAction = a.action?.toLowerCase().includes(q);
      const matchCase = a.caseId?.toLowerCase().includes(q);
      const matchName = a.actor?.name?.toLowerCase().includes(q) || a.actor?.username?.toLowerCase().includes(q);
      const matchReason = a.reason?.toLowerCase().includes(q);
      if (!matchAction && !matchCase && !matchName && !matchReason) return false;
    }

    return true;
  });

  // Group by date
  const groupedByDate = filteredAudits.reduce((acc, a) => {
    const dateKey = a.timestamp?.slice(0, 10) || 'KHÁC';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(a);
    return acc;
  }, {});

  const dateKeys = Object.keys(groupedByDate).sort().reverse();

  const getActionStyle = (action = '') => {
    if (action.includes('APPROVE') || action.includes('SUCCESS') || action.includes('ENABLE')) {
      return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
    }
    if (action.includes('REJECT') || action.includes('FAILED') || action.includes('DELETE') || action.includes('FORBIDDEN')) {
      return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
    }
    if (action.includes('ESCALAT') || action.includes('SUPPLEMENT') || action.includes('REVIEW') || action.includes('DISABLE')) {
      return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
    }
    if (action.includes('LOGIN') || action.includes('AUTH') || action.includes('PASSWORD')) {
      return { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' };
    }
    if (action.includes('OCR') || action.includes('UPLOAD')) {
      return { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' };
    }
    return { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.3)' };
  };

  const formatDateHeader = (dateStr) => {
    if (dateStr === todayStr) {
      return `📅 Hôm nay — ${new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    }
    if (dateStr === yesterdayStr) {
      return `📅 Hôm qua — ${yesterdayDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    }
    try {
      const d = new Date(dateStr);
      return `📅 ${d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    } catch {
      return `📅 Ngày: ${dateStr}`;
    }
  };

  const getExportDateParam = () => {
    if (dateFilterMode === 'TODAY') return `&date=${todayStr}`;
    if (dateFilterMode === 'YESTERDAY') return `&date=${yesterdayStr}`;
    if (dateFilterMode === 'CUSTOM' && customDate) return `&date=${customDate}`;
    return '';
  };

  return (
    <div className="card-panel" style={{ padding: '24px' }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff', margin: '0 0 4px 0' }}>
            <History size={22} color="var(--accent-primary)" />
            {title}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: 0 }}>
            {subtitle} • Hiển thị <strong>{filteredAudits.length}</strong> / <strong>{audits.length}</strong> bản ghi
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!isStudentView && token && (
            <button
              onClick={() => window.open(`${API_BASE}/audits/export-csv?token=${token}${getExportDateParam()}`, '_blank')}
              className="btn-secondary"
              style={{
                padding: '7px 14px',
                fontSize: '0.8rem',
                background: 'rgba(5, 150, 105, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(5, 150, 105, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px'
              }}
              title="Xuất danh sách hoạt động ra file CSV cho Excel"
            >
              <Download size={14} />
              <span>Xuất Bảng Audit {dateFilterMode !== 'ALL' ? '(Theo Ngày)' : 'CSV'}</span>
            </button>
          )}

          {onRefresh && (
            <button onClick={onRefresh} className="btn-secondary" style={{ padding: '7px 12px', fontSize: '0.8rem', borderRadius: '8px' }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Làm mới</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTER CONTROLS & DATE SELECTORS */}
      <div style={{
        background: 'rgba(9, 13, 26, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        
        {/* Quick Date Mode Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-sub)', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={14} color="#38bdf8" /> Xem theo ngày:
            </span>

            <button
              onClick={() => { setDateFilterMode('ALL'); setCustomDate(''); }}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 600,
                border: dateFilterMode === 'ALL' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                background: dateFilterMode === 'ALL' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: dateFilterMode === 'ALL' ? '#38bdf8' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Tất cả ngày ({audits.length})
            </button>

            <button
              onClick={() => { setDateFilterMode('TODAY'); setCustomDate(''); }}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 600,
                border: dateFilterMode === 'TODAY' ? '1px solid #34d399' : '1px solid rgba(255, 255, 255, 0.1)',
                background: dateFilterMode === 'TODAY' ? 'rgba(52, 211, 153, 0.2)' : 'transparent',
                color: dateFilterMode === 'TODAY' ? '#34d399' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              ⚡ Hôm nay ({countToday})
            </button>

            <button
              onClick={() => { setDateFilterMode('YESTERDAY'); setCustomDate(''); }}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 600,
                border: dateFilterMode === 'YESTERDAY' ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.1)',
                background: dateFilterMode === 'YESTERDAY' ? 'rgba(251, 191, 36, 0.2)' : 'transparent',
                color: dateFilterMode === 'YESTERDAY' ? '#fbbf24' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              📅 Hôm qua ({countYesterday})
            </button>

            <button
              onClick={() => { setDateFilterMode('7DAYS'); setCustomDate(''); }}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 600,
                border: dateFilterMode === '7DAYS' ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                background: dateFilterMode === '7DAYS' ? 'rgba(129, 140, 248, 0.2)' : 'transparent',
                color: dateFilterMode === '7DAYS' ? '#818cf8' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              7 ngày qua ({count7Days})
            </button>
          </div>

          {/* Group View Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="checkbox"
                checked={groupByDay}
                onChange={e => setGroupByDay(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Gom nhóm theo ngày</span>
            </label>
          </div>
        </div>

        {/* Input Controls Row */}
        <div style={{ display: 'grid', gridTemplateColumns: showRoleFilter ? '1.5fr 1fr 1fr 1fr' : '2fr 1fr 1fr', gap: '10px' }}>
          
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '32px', height: '36px', fontSize: '0.8rem' }}
              placeholder="Tìm theo hành động, người dùng, mã hồ sơ (#CASE)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Custom Date Picker */}
          <div style={{ position: 'relative' }}>
            <input
              type="date"
              className="form-input"
              style={{ height: '36px', fontSize: '0.8rem', color: customDate ? '#38bdf8' : 'var(--text-muted)' }}
              value={customDate}
              onChange={e => {
                setCustomDate(e.target.value);
                if (e.target.value) setDateFilterMode('CUSTOM');
                else setDateFilterMode('ALL');
              }}
            />
          </div>

          {/* Role Filter */}
          {showRoleFilter && (
            <select
              className="form-input"
              style={{ height: '36px', fontSize: '0.8rem' }}
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="ALL">👤 Tất cả vai trò</option>
              <option value="STUDENT">🎓 Sinh Viên</option>
              <option value="REVIEWER">🔍 Cán Bộ Thẩm Định</option>
              <option value="ADMIN">🛡️ Quản Trị Viên</option>
              <option value="GUEST">🌐 Khách / Vãng lai</option>
            </select>
          )}

          {/* Action Filter */}
          <select
            className="form-input"
            style={{ height: '36px', fontSize: '0.8rem' }}
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
          >
            <option value="ALL">⚡ Tất cả hành động</option>
            <option value="CASE_SUBMITTED">📝 Khởi tạo hồ sơ</option>
            <option value="CASE_STATUS_APPROVED">✅ Duyệt chấp thuận</option>
            <option value="CASE_STATUS_REJECTED">❌ Từ chối hồ sơ</option>
            <option value="CASE_STATUS_REQUIRES_SUPPLEMENT">🔄 Yêu cầu bổ sung</option>
            <option value="CASE_AUTO_APPROVED">⚡ Tự động duyệt (Rule Engine)</option>
            <option value="CASE_ESCALATED">🚨 Leo thang nghiệp vụ</option>
            <option value="AUTH_LOGIN">🔑 Đăng nhập hệ thống</option>
            <option value="USER_PROFILE_UPDATED">👤 Cập nhật hồ sơ</option>
            <option value="USER_PASSWORD_CHANGED">🔒 Đổi mật khẩu</option>
            <option value="EVIDENCE_UPLOADED">📎 Tải lên minh chứng</option>
            <option value="OCR_EXTRACTION_PERFORMED">✨ Quét OCR Gemini</option>
            <option value="REPORT_CSV_EXPORTED">📊 Xuất báo cáo CSV</option>
          </select>

        </div>

      </div>

      {/* AUDIT LOG LISTING (GROUPED OR FLAT) */}
      {filteredAudits.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#090d16', borderRadius: '12px', border: '1px dashed #334155', color: 'var(--text-sub)' }}>
          <CalendarDays size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
          <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600, margin: '0 0 4px 0' }}>
            Không tìm thấy bản ghi nhật ký nào
          </p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
            {customDate ? `Không có hoạt động nào trong ngày ${customDate}.` : 'Hãy thử thay đổi bộ lọc ngày hoặc từ khóa tìm kiếm.'}
          </p>
        </div>
      ) : groupByDay ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {dateKeys.map(dateKey => {
            const dayAudits = groupedByDate[dateKey] || [];
            return (
              <div key={dateKey} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                
                {/* Date Group Header */}
                <div style={{
                  background: 'linear-gradient(90deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.6) 100%)',
                  borderLeft: '4px solid #38bdf8',
                  borderRadius: '0 8px 8px 0',
                  padding: '8px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CalendarDays size={16} color="#38bdf8" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc' }}>
                      {formatDateHeader(dateKey)}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    {dayAudits.length} hoạt động
                  </span>
                </div>

                {/* Day Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '8px' }}>
                  {dayAudits.map((a, idx) => {
                    const badge = getActionStyle(a.action);
                    const timeStr = a.timestamp ? new Date(a.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
                    return (
                      <div
                        key={a.id || idx}
                        style={{
                          background: '#0f172a',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '10px',
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '14px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Time & Clock */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '68px', paddingTop: '2px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace' }}>
                            {timeStr}
                          </span>
                          <Clock size={13} color="#64748b" style={{ marginTop: '2px' }} />
                        </div>

                        {/* Content Area */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            
                            {/* Action Badge */}
                            <span style={{
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '5px',
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                              fontFamily: 'monospace'
                            }}>
                              {a.action}
                            </span>

                            {/* Case Link if available */}
                            {a.caseId && (
                              <span style={{
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: '5px',
                                background: 'rgba(56, 189, 248, 0.12)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                fontFamily: 'monospace'
                              }}>
                                #{a.caseId}
                              </span>
                            )}

                            {/* Actor Pill */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.74rem'
                            }}>
                              <User size={12} color="#94a3b8" />
                              <strong style={{ color: '#ffffff' }}>{a.actor?.name || a.actor?.username || 'Hệ thống'}</strong>
                              <span style={{
                                fontSize: '0.68rem',
                                color: a.actor?.role === 'ADMIN' ? '#f43f5e' : (a.actor?.role === 'REVIEWER' ? '#fbbf24' : '#38bdf8'),
                                fontWeight: 700
                              }}>
                                [{a.actor?.role || 'SYSTEM'}]
                              </span>
                            </div>
                          </div>

                          {/* Reason / Detail */}
                          <p style={{ fontSize: '0.84rem', color: '#e2e8f0', margin: 0, lineHeight: 1.45 }}>
                            {a.reason}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* Flat Timeline Mode */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredAudits.map((a, idx) => {
            const badge = getActionStyle(a.action);
            return (
              <div
                key={a.id || idx}
                style={{
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <Clock size={16} color="#818cf8" />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '5px',
                        background: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                        fontFamily: 'monospace'
                      }}>
                        {a.action}
                      </span>
                      {a.caseId && <span style={{ color: '#38bdf8', fontSize: '0.78rem', fontWeight: 700 }}>({a.caseId})</span>}
                    </div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-sub)' }}>
                      {new Date(a.timestamp).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-main)', margin: 0 }}>
                    <strong>{a.actor?.name || a.actor?.username}</strong> ({a.actor?.role}): {a.reason}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};


export default AuditTrailViewer;
