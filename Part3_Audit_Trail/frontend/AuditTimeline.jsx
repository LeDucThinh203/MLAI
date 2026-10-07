/**
 * ============================================================================
 * CASEFLOW AI - AUDIT TIMELINE COMPONENT (PART 3 FRONTEND)
 * ============================================================================
 * @component AuditTimeline
 * @description Thành phần giao diện dòng thời gian kiểm toán (Audit Trail Timeline):
 * - Hiển thị toàn bộ lịch sử thao tác: Đăng nhập, Nộp hồ sơ, Quét AI OCR, Phê duyệt, Ký số.
 * - Hỗ trợ lọc theo Mã hành động (Action Type), Vai trò (Role), Ngày thực hiện (Date).
 * - Tự động thích ứng quyền riêng tư: Sinh viên chỉ xem hồ sơ của mình; Cán bộ/Admin xem toàn bộ.
 * - Tích hợp nút xuất báo cáo Audit ra file CSV (UTF-8 có BOM) để lưu trữ theo chuẩn kiểm toán.
 * ============================================================================
 */

import React, { useEffect, useState, useCallback } from 'react';

export const AuditTimeline = ({ apiBase = 'http://localhost:3001/api' }) => {
    // ------------------------------------------------------------------------
    // STATE MANAGEMENT
    // ------------------------------------------------------------------------
    const [audits, setAudits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionFilter, setActionFilter] = useState('ALL');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [dateFilter, setDateFilter] = useState('');
    const [exporting, setExporting] = useState(false);

    /**
     * Tải danh sách Audit Logs từ Backend với bộ lọc hiện tại
     */
    const fetchAudits = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('cf_token');
        const queryParams = new URLSearchParams();

        if (actionFilter !== 'ALL') queryParams.append('action', actionFilter);
        if (roleFilter !== 'ALL') queryParams.append('actorRole', roleFilter);
        if (dateFilter) queryParams.append('date', dateFilter);

        try {
            const res = await fetch(`${apiBase}/audits?${queryParams.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.success && Array.isArray(result.data)) {
                setAudits(result.data);
            }
        } catch (err) {
            console.error('[AuditTimeline] Lỗi khi tải nhật ký kiểm toán:', err);
        } finally {
            setLoading(false);
        }
    }, [apiBase, actionFilter, roleFilter, dateFilter]);

    useEffect(() => {
        fetchAudits();
    }, [fetchAudits]);

    /**
     * Xuất dữ liệu Audit ra tệp tin CSV
     */
    const handleExportCsv = async () => {
        setExporting(true);
        const token = localStorage.getItem('cf_token');
        const queryParams = new URLSearchParams();
        if (actionFilter !== 'ALL') queryParams.append('action', actionFilter);
        if (roleFilter !== 'ALL') queryParams.append('actorRole', roleFilter);
        if (dateFilter) queryParams.append('date', dateFilter);

        try {
            const res = await fetch(`${apiBase}/audits/export-csv?${queryParams.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Audit_Report_${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('[AuditTimeline] Lỗi xuất CSV:', err);
        } finally {
            setExporting(false);
        }
    };

    /**
     * Trả về màu sắc huy hiệu dựa trên loại hành động
     */
    const getActionBadgeColor = (action) => {
        if (action.startsWith('AUTH_')) return { bg: '#e0e7ff', text: '#3730a3' };
        if (action.startsWith('CASE_APPROVED') || action === 'CASE_DIGITAL_SIGNED') return { bg: '#dcfce7', text: '#166534' };
        if (action.startsWith('CASE_REJECTED')) return { bg: '#fee2e2', text: '#991b1b' };
        if (action.startsWith('AI_')) return { bg: '#fef3c7', text: '#92400e' };
        return { bg: '#f1f5f9', text: '#334155' };
    };

    return (
        <div style={{ padding: '24px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            {/* HEADER & XUẤT BÁO CÁO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                        🛡️ Nhật Ký Kiểm Toán (Audit Trail)
                    </h2>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                        Minh bạch 100% mọi hành động bảo mật, tiến trình nộp hồ sơ, xử lý AI và chữ ký điện tử.
                    </p>
                </div>
                <button
                    onClick={handleExportCsv}
                    disabled={exporting || audits.length === 0}
                    style={{
                        padding: '8px 16px',
                        background: '#047857',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '600',
                        fontSize: '13px',
                        cursor: exporting ? 'not-allowed' : 'pointer'
                    }}
                >
                    {exporting ? '⏳ Đang kết xuất...' : '📥 Xuất Báo Cáo CSV'}
                </button>
            </div>

            {/* BỘ LỌC TƯƠNG TÁC */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Hành động</label>
                    <select
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                        <option value="ALL">Tất cả hành động</option>
                        <option value="AUTH_LOGIN">Đăng nhập (AUTH_LOGIN)</option>
                        <option value="CASE_SUBMITTED">Nộp hồ sơ (CASE_SUBMITTED)</option>
                        <option value="CASE_APPROVED">Phê duyệt (CASE_APPROVED)</option>
                        <option value="CASE_REJECTED">Từ chối (CASE_REJECTED)</option>
                        <option value="AI_OCR_PROCESSING">Phân tích Gemini AI</option>
                        <option value="CASE_DIGITAL_SIGNED">Ký số điện tử</option>
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Vai trò thực hiện</label>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                        <option value="ALL">Tất cả vai trò</option>
                        <option value="STUDENT">Sinh viên (STUDENT)</option>
                        <option value="REVIEWER">Cán bộ duyệt (REVIEWER)</option>
                        <option value="ADMIN">Quản trị viên (ADMIN)</option>
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Lọc theo ngày</label>
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                </div>
            </div>

            {/* DANH SÁCH SỰ KIỆN TIMELINE */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>⏳ Đang tải dữ liệu kiểm toán...</div>
            ) : audits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Không có sự kiện nào khớp với bộ lọc.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {audits.map((item) => {
                        const badge = getActionBadgeColor(item.action || '');
                        return (
                            <div key={item.id} style={{ display: 'flex', gap: '16px', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#ffffff' }}>
                                <div style={{ minWidth: '130px', fontSize: '12px', color: '#64748b' }}>
                                    {new Date(item.timestamp).toLocaleString('vi-VN')}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: badge.bg, color: badge.text }}>
                                            {item.action}
                                        </span>
                                        {item.caseId && (
                                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#2563eb' }}>
                                                #{item.caseId}
                                            </span>
                                        )}
                                        <span style={{ fontSize: '13px', color: '#334155' }}>
                                            bởi <strong>{item.actorName || item.actorUsername || 'Hệ thống'}</strong> ({item.actorRole})
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                                        {item.reason || 'Thực hiện thao tác thành công.'}
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

export default AuditTimeline;
