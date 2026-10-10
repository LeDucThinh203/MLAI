import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users, RefreshCw, Search, X,
  CheckCircle2, AlertTriangle, KeyRound, Download, Cpu,
  TrendingUp, PieChart, Layers, FolderPlus, SlidersHorizontal,
  FileText, Clock, UserPlus
} from 'lucide-react';
import { API_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ReviewerPortal from '../reviewer/ReviewerPortal';
import PageSkeleton from '../../components/common/PageSkeleton';
import PaginationControls from '../../components/common/PaginationControls';
import AnalyticsCharts from '../../components/admin/AnalyticsCharts';
import { openSafeWindow } from '../../utils/security';

const CATEGORY_LABELS = {
  MILITARY_SERVICE_CONFIRMATION: 'Cấp giấy xác nhận sinh viên tạm hoãn NVQS'
};

const AdminPortal = ({ activeTab, caseToOpen, onCaseOpened }) => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminMessage, setAdminMessage] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [sisRecords, setSisRecords] = useState([]);
  const [sisSearch, setSisSearch] = useState('');
  const [sisStatus, setSisStatus] = useState('');
  const [sisPage, setSisPage] = useState(1);
  const [sisTotal, setSisTotal] = useState(0);
  const [sisLoading, setSisLoading] = useState(false);
  const [sisSaving, setSisSaving] = useState(false);
  const [editingSis, setEditingSis] = useState(null);

  // States tạo tài khoản cán bộ từ Admin
  const [newFullName, setNewFullName] = useState('');
  const [newStudentCode, setNewStudentCode] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('REVIEWER');
  const [newDepartment, setNewDepartment] = useState('Ban Giám Sát & Xét Duyệt');
  const [creatingUser, setCreatingUser] = useState(false);

  const fetchAdminData = async ({
    loadUsers = activeTab === 'admin_users',
    loadStats = activeTab === 'admin_overview'
  } = {}) => {
    if (!loadUsers && !loadStats) return;
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        loadUsers ? axios.get(`${API_BASE}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }) : Promise.resolve(null),
        loadStats ? axios.get(`${API_BASE}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }) : Promise.resolve(null)
      ]);

      if (usersRes?.data?.success) setUsers(usersRes.data.data.users);
      if (statsRes?.data?.success) setStats(statsRes.data.data);
    } catch (err) {
      console.error('Lỗi tải dữ liệu quản trị:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchAdminData();
  }, [token, activeTab]);

  useEffect(() => {
    if (!token || !['admin_policies', 'admin_sis'].includes(activeTab)) return;
    const endpoint = activeTab === 'admin_policies' ? '/admin/policies' : `/admin/sis?pageSize=20&page=${sisPage}&search=${encodeURIComponent(sisSearch)}&academicStatus=${encodeURIComponent(sisStatus)}`;
    if (activeTab === 'admin_sis') setSisLoading(true);
    axios.get(`${API_BASE}${endpoint}`).then(res => {
      if (res.data?.success) {
        if (activeTab === 'admin_policies') setPolicies(res.data.data.policies || []);
        else {
          setSisRecords(res.data.data.records || []);
          setSisTotal(res.data.data.total || 0);
        }
      }
    }).catch((err) => setAdminMessage({ type: 'error', text: err.response?.data?.message || 'Không thể tải dữ liệu quản trị.' }))
      .finally(() => setSisLoading(false));
  }, [token, activeTab, sisPage, sisSearch, sisStatus]);

  const saveSis = async () => {
    if (!editingSis) return;
    setSisSaving(true);
    try {
      const payload = {
        studentCode: editingSis.studentCode,
        fullName: editingSis.fullName,
        academicStatus: editingSis.academicStatus,
        courseStartDate: editingSis.courseStartDate,
        courseEndDate: editingSis.courseEndDate,
        currentTermActive: editingSis.currentTermActive,
        hasCurrentSchedule: editingSis.hasCurrentSchedule,
        registeredPermanentAddress: editingSis.registeredPermanentAddress,
        faculty: editingSis.faculty,
        recordStatus: editingSis.recordStatus
      };
      const res = await axios.put(`${API_BASE}/admin/sis/${editingSis.id}`, payload);
      if (!res.data?.success) throw new Error(res.data?.message || 'Cập nhật SIS thất bại.');
      setEditingSis(null);
      setSisRecords(items => items.map(item => item.id === res.data.data.record.id ? res.data.data.record : item));
      setAdminMessage({ type: 'success', text: 'Cập nhật hồ sơ SIS thành công.' });
    } catch (err) {
      setAdminMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Không thể cập nhật hồ sơ SIS.' });
    } finally {
      setSisSaving(false);
    }
  };

  const handleAdminCreateUser = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    setAdminMessage(null);

    try {
      const res = await axios.post(`${API_BASE}/admin/users/create`, {
        fullName: newFullName,
        studentCode: newRole === 'STUDENT' ? newStudentCode.trim() : undefined,
        username: newUsername,
        password: newPassword,
        role: newRole,
        department: newDepartment
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        setAdminMessage({ type: 'success', text: res.data.message });
        setNewFullName('');
        setNewStudentCode('');
        setNewUsername('');
        setNewPassword('');
        fetchAdminData();
      }
    } catch (err) {
      setAdminMessage({ type: 'error', text: err.response?.data?.message || 'Cấp tài khoản thất bại!' });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleChangeUserRole = async (userId, targetRole) => {
    try {
      const res = await axios.put(`${API_BASE}/admin/users/${userId}/role`, { role: targetRole }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setAdminMessage({ type: 'success', text: res.data.message });
        fetchAdminData();
      }
    } catch (err) {
      setAdminMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi cập nhật quyền!' });
    }
  };

  const filteredUsers = users.filter(u => {
    if (!userSearchTerm.trim()) return true;
    const q = userSearchTerm.toLowerCase().trim();
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.studentCode?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });
  const userPageSize = 10;
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / userPageSize));
  const safeUserPage = Math.min(userPage, userTotalPages);
  const pagedUsers = filteredUsers.slice((safeUserPage - 1) * userPageSize, safeUserPage * userPageSize);

  useEffect(() => { setUserPage(1); }, [userSearchTerm]);

  if (loading && activeTab === 'admin_overview' && !stats) {
    return <PageSkeleton variant="dashboard" label="Đang tải dữ liệu quản trị" />;
  }

  return (
    <div className="portal-content portal-content--admin" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {adminMessage && (
        <div style={{
          background: adminMessage.type === 'success' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(225, 29, 72, 0.15)',
          border: `1px solid ${adminMessage.type === 'success' ? 'rgba(5, 150, 105, 0.3)' : 'rgba(225, 29, 72, 0.3)'}`,
          borderRadius: '8px',
          padding: '12px 16px',
          color: adminMessage.type === 'success' ? '#34d399' : '#f87171',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {adminMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{adminMessage.text}</span>
        </div>
      )}

      {activeTab === 'admin_policies' && <section className="card-panel" style={{ padding: '24px' }}>
        <h2>Policy Registry</h2><p>Quy tắc nghiệp vụ nội bộ đang điều khiển Escalation Referee. Chỉ đọc; Rule Engine production là nguồn thực thi cuối cùng.</p>
        {policies.map(policy => <div key={policy.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}><strong>{policy.id} — {policy.name}</strong><br /><small>{policy.category} · {policy.systemAction} · {policy.escalationReason} · Internal Workflow Policy</small></div>)}
      </section>}

      {activeTab === 'admin_sis' && <section className="card-panel" style={{ padding: '24px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div>
            <h2 style={{ marginBottom: '6px' }}>Dữ liệu SIS sinh viên</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Nguồn dữ liệu nội bộ cho hồ sơ sinh viên. Tổng cộng: <strong>{sisTotal}</strong> bản ghi.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => setSisPage(1)} disabled={sisLoading}>
            <RefreshCw size={15} className={sisLoading ? 'animate-spin' : ''} /> Làm mới
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={sisSearch} onChange={e => { setSisSearch(e.target.value); setSisPage(1); }} placeholder="Tìm theo MSSV, họ tên, khoa hoặc địa chỉ" style={{ width: '100%', paddingLeft: '34px' }} />
          </div>
          <select value={sisStatus} onChange={e => { setSisStatus(e.target.value); setSisPage(1); }} style={{ minWidth: '190px' }}>
            <option value="">Tất cả trạng thái học vụ</option><option value="ACTIVE">Đang học</option><option value="SUSPENDED">Tạm dừng</option><option value="WITHDRAWN">Đã thôi học</option><option value="GRADUATED">Đã tốt nghiệp</option><option value="LEAVE_OF_ABSENCE">Bảo lưu</option><option value="UNKNOWN">Chưa xác định</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
          <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
            <thead><tr style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              <th style={{ padding: '12px' }}>STT</th><th style={{ padding: '12px' }}>Sinh viên</th><th style={{ padding: '12px' }}>Học vụ</th><th style={{ padding: '12px' }}>Khoa</th><th style={{ padding: '12px' }}>Khóa học</th><th style={{ padding: '12px', textAlign: 'right' }}>Thao tác</th>
            </tr></thead>
            <tbody>
              {sisLoading && <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải dữ liệu SIS...</td></tr>}
              {!sisLoading && sisRecords.length === 0 && <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Không có sinh viên phù hợp với bộ lọc.</td></tr>}
              {!sisLoading && sisRecords.map((record, index) => <tr key={record.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                <td style={{ padding: '14px 12px', color: 'var(--text-muted)' }}>{(sisPage - 1) * 20 + index + 1}</td>
                <td style={{ padding: '14px 12px' }}><strong>{record.fullName}</strong><br /><span style={{ color: 'var(--text-muted)' }}>{record.studentCode || 'Chưa có MSSV'}</span></td>
                <td style={{ padding: '14px 12px' }}>{record.academicStatus || 'UNKNOWN'}<br /><small style={{ color: 'var(--text-muted)' }}>{record.recordStatus || 'ACTIVE'}</small></td>
                <td style={{ padding: '14px 12px' }}>{record.faculty || 'Chưa cập nhật'}</td>
                <td style={{ padding: '14px 12px' }}>{record.courseStartDate || '—'} <span style={{ color: 'var(--text-muted)' }}>→</span> {record.courseEndDate || '—'}</td>
                <td style={{ padding: '14px 12px', textAlign: 'right' }}><button type="button" className="btn-secondary" onClick={() => setEditingSis({ ...record, recordStatus: record.recordStatus || 'ACTIVE' })}>Cập nhật</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Hiển thị {sisRecords.length} / {sisTotal} sinh viên · Trang {sisPage} / {Math.max(1, Math.ceil(sisTotal / 20))}</span>
          <PaginationControls page={sisPage} totalItems={sisTotal} pageSize={20} onPageChange={setSisPage} label="sinh viên SIS" />
        </div>

        {editingSis && <div role="dialog" aria-modal="true" aria-labelledby="sis-update-title" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15, 23, 42, 0.66)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <form onSubmit={e => { e.preventDefault(); saveSis(); }} className="card-panel" style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 24px 64px rgba(0,0,0,.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}><div><h3 id="sis-update-title" style={{ margin: 0 }}>Cập nhật hồ sơ SIS</h3><small style={{ color: 'var(--text-muted)' }}>Chỉ cập nhật dữ liệu đã được xác minh.</small></div><button type="button" aria-label="Đóng" className="btn-secondary" onClick={() => setEditingSis(null)}><X size={18} /></button></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <label>MSSV<input value={editingSis.studentCode || ''} onChange={e => setEditingSis({ ...editingSis, studentCode: e.target.value || null })} /></label>
              <label>Họ và tên<input required value={editingSis.fullName || ''} onChange={e => setEditingSis({ ...editingSis, fullName: e.target.value })} /></label>
              <label>Trạng thái học vụ<select value={editingSis.academicStatus || 'UNKNOWN'} onChange={e => setEditingSis({ ...editingSis, academicStatus: e.target.value })}><option value="ACTIVE">Đang học</option><option value="SUSPENDED">Tạm dừng</option><option value="WITHDRAWN">Đã thôi học</option><option value="GRADUATED">Đã tốt nghiệp</option><option value="LEAVE_OF_ABSENCE">Bảo lưu</option><option value="UNKNOWN">Chưa xác định</option></select></label>
              <label>Trạng thái bản ghi<select value={editingSis.recordStatus || 'ACTIVE'} onChange={e => setEditingSis({ ...editingSis, recordStatus: e.target.value })}><option value="ACTIVE">Hoạt động</option><option value="SUSPENDED">Tạm khóa</option></select></label>
              <label>Ngày bắt đầu khóa<input type="date" value={editingSis.courseStartDate || ''} onChange={e => setEditingSis({ ...editingSis, courseStartDate: e.target.value || null })} /></label>
              <label>Ngày kết thúc khóa<input type="date" value={editingSis.courseEndDate || ''} onChange={e => setEditingSis({ ...editingSis, courseEndDate: e.target.value || null })} /></label>
              <label>Khoa / đơn vị<input value={editingSis.faculty || ''} onChange={e => setEditingSis({ ...editingSis, faculty: e.target.value || null })} /></label>
              <label>Địa chỉ thường trú<input value={editingSis.registeredPermanentAddress || ''} onChange={e => setEditingSis({ ...editingSis, registeredPermanentAddress: e.target.value || null })} /></label>
            </div>
            <div style={{ display: 'flex', gap: '20px', marginTop: '16px', flexWrap: 'wrap' }}><label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type="checkbox" checked={Boolean(editingSis.currentTermActive)} onChange={e => setEditingSis({ ...editingSis, currentTermActive: e.target.checked })} /> Có học kỳ đang hoạt động</label><label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type="checkbox" checked={Boolean(editingSis.hasCurrentSchedule)} onChange={e => setEditingSis({ ...editingSis, hasCurrentSchedule: e.target.checked })} /> Có thời khóa biểu hiện tại</label></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}><button type="button" className="btn-secondary" onClick={() => setEditingSis(null)} disabled={sisSaving}>Hủy</button><button type="submit" className="btn-primary" disabled={sisSaving}>{sisSaving ? 'Đang cập nhật...' : 'Cập nhật'}</button></div>
          </form>
        </div>}
      </section>}

      {/* 1. TỔNG QUAN QUẢN TRỊ & CƠ CẤU HỒ SƠ */}
      {activeTab === 'admin_overview' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Bảng Điều Khiển Tổng Quan Quản Trị</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Theo dõi chỉ số KPI học vụ, trạng thái thẩm định và phân quyền toàn trường</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => openSafeWindow(`${API_BASE}/reports/export-csv`)}
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.82rem', background: 'rgba(5, 150, 105, 0.15)', color: '#34d399', border: '1px solid rgba(5, 150, 105, 0.3)' }}
                title="Xuất dữ liệu toàn bộ hồ sơ ra file CSV / Excel UTF-8 BOM"
              >
                <Download size={14} /> Xuất Bảng CSV
              </button>
              <button
                onClick={() => openSafeWindow(`${API_BASE}/reports/export-cases-html`)}
                className="btn-primary shimmer-button"
                style={{ background: 'linear-gradient(135deg, #059669, #10b981)', padding: '8px 14px', fontSize: '0.82rem' }}
                title="Xuất và in Báo Cáo Bảng Tổng Hợp dạng PDF"
              >
                <FileText size={14} /> In Báo Cáo Bảng (PDF)
              </button>
            </div>
          </div>

          {/* Hàng 4 Thẻ KPI Chính */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="card-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Tổng Số Hồ Sơ</span>
                <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '6px', borderRadius: '8px' }}>
                  <Layers size={18} color="#38bdf8" />
                </div>
              </div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#38bdf8' }}>{stats.totalCases}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.78rem', color: '#34d399' }}>
                <TrendingUp size={14} />
                <span><strong>+{stats.todayCasesCount || 0}</strong> hồ sơ mới trong 24h</span>
              </div>
            </div>

            <div className="card-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Hồ Sơ Chờ Xử Lý</span>
                <div style={{ background: 'rgba(251, 191, 36, 0.15)', padding: '6px', borderRadius: '8px' }}>
                  <Clock size={18} color="#fbbf24" />
                </div>
              </div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#fbbf24' }}>{stats.pendingCases}</h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Mới: <strong>{stats.statusBreakdown?.SUBMITTED || 0}</strong> • Duyệt lại: <strong>{stats.statusBreakdown?.RESUBMITTED || 0}</strong>
              </p>
            </div>

            <div className="card-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Tỷ Lệ Duyệt Thành Công</span>
                <div style={{ background: 'rgba(52, 211, 153, 0.15)', padding: '6px', borderRadius: '8px' }}>
                  <CheckCircle2 size={18} color="#34d399" />
                </div>
              </div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#34d399' }}>{stats.approvalRate}%</h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Đã duyệt: <strong style={{ color: '#34d399' }}>{stats.approvedCases}</strong> • Từ chối: <strong style={{ color: '#f87171' }}>{stats.rejectedCases}</strong>
              </p>
            </div>

            <div className="card-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Người Dùng Hệ Thống</span>
                <div style={{ background: 'rgba(129, 140, 248, 0.15)', padding: '6px', borderRadius: '8px' }}>
                  <Users size={18} color="#818cf8" />
                </div>
              </div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#818cf8' }}>{stats.totalUsers}</h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                SV: <strong>{stats.roleBreakdown?.STUDENT || 0}</strong> • Cán bộ: <strong>{stats.roleBreakdown?.REVIEWER || 0}</strong> • Admin: <strong>{stats.roleBreakdown?.ADMIN || 0}</strong>
              </p>
            </div>
          </div>

          <AnalyticsCharts stats={stats} />

          {/* HÀNG BỔ SUNG: ESCALATION REFEREE, OVERRIDE & BENCHMARK METRICS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="card-panel" style={{ padding: '16px', background: '#0a0e17', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Mức chuyển hồ sơ để xem xét</div>
              <h4 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', margin: '6px 0 2px 0' }}>
                {stats.currentEscalationThreshold || '0.75'}
              </h4>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>Mức hệ thống chuyển hồ sơ sang cán bộ kiểm tra [0.65 - 0.90]</p>
            </div>

            <div className="card-panel" style={{ padding: '16px', background: '#0a0e17', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Cán bộ điều chỉnh quyết định</div>
              <h4 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#8b5cf6', margin: '6px 0 2px 0' }}>
                {stats.totalHumanOverrides || 0} lần
              </h4>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>Số hồ sơ cán bộ điều chỉnh so với đề xuất của hệ thống</p>
            </div>

            <div className="card-panel" style={{ padding: '16px', background: '#0a0e17', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Phản Hồi Thẩm Định Viên</div>
              <h4 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', margin: '6px 0 2px 0' }}>
                {stats.totalReviewerFeedback || 0} lượt
              </h4>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                Sót: <strong>{stats.missedEscalationFeedbackCount || 0}</strong> • Thừa: <strong>{stats.unnecessaryEscalationFeedbackCount || 0}</strong>
              </p>
            </div>

            <div className="card-panel" style={{ padding: '16px', background: '#0a0e17', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Độ chính xác đánh giá</div>
              <h4 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399', margin: '6px 0 2px 0' }}>
                {stats.benchmarkMetrics?.decisionAccuracy || 'Chưa có dữ liệu'}
              </h4>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                Tỷ lệ cần xem xét thêm: <strong>{stats.benchmarkMetrics?.missedEscalationRate || 'Chưa có dữ liệu'}</strong>
              </p>
            </div>
          </div>

          {/* HÀNG 2: CƠ CẤU TRẠNG THÁI & CƠ CẤU THEO DANH MỤC */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            
            {/* 1. Cơ cấu trạng thái hồ sơ hiện tại */}
            <div className="card-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PieChart size={18} color="#38bdf8" /> Cơ Cấu Trạng Thái Hồ Sơ
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tổng: <strong>{stats.totalCases}</strong> hồ sơ</span>
              </div>

              {/* Multi-segmented Progress Bar */}
              {stats.totalCases > 0 && (
                <div style={{
                  height: '10px',
                  borderRadius: '6px',
                  background: '#090d16',
                  display: 'flex',
                  overflow: 'hidden',
                  marginBottom: '20px',
                  gap: '2px'
                }}>
                  <div title={`Chờ thẩm định: ${stats.statusBreakdown?.SUBMITTED || 0}`} style={{ width: `${((stats.statusBreakdown?.SUBMITTED || 0) / stats.totalCases) * 100}%`, background: '#38bdf8' }} />
                  <div title={`Đang xử lý: ${stats.statusBreakdown?.UNDER_REVIEW || 0}`} style={{ width: `${((stats.statusBreakdown?.UNDER_REVIEW || 0) / stats.totalCases) * 100}%`, background: '#fbbf24' }} />
                  <div title={`Cần bổ sung: ${stats.statusBreakdown?.REQUIRES_SUPPLEMENT || 0}`} style={{ width: `${((stats.statusBreakdown?.REQUIRES_SUPPLEMENT || 0) / stats.totalCases) * 100}%`, background: '#f59e0b' }} />
                  <div title={`Đã bổ sung lại: ${stats.statusBreakdown?.RESUBMITTED || 0}`} style={{ width: `${((stats.statusBreakdown?.RESUBMITTED || 0) / stats.totalCases) * 100}%`, background: '#a5b4fc' }} />
                  <div title={`Đã phê duyệt: ${stats.statusBreakdown?.APPROVED || 0}`} style={{ width: `${((stats.statusBreakdown?.APPROVED || 0) / stats.totalCases) * 100}%`, background: '#34d399' }} />
                  <div title={`Đã từ chối: ${stats.statusBreakdown?.REJECTED || 0}`} style={{ width: `${((stats.statusBreakdown?.REJECTED || 0) / stats.totalCases) * 100}%`, background: '#f87171' }} />
                </div>
              )}

              {/* Grid 6 trạng thái chi tiết */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #38bdf8' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Chờ cán bộ tiếp nhận</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                    {stats.statusBreakdown?.SUBMITTED || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.SUBMITTED || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #fbbf24' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Đang được xem xét</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fbbf24', marginTop: '2px' }}>
                    {stats.statusBreakdown?.UNDER_REVIEW || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.UNDER_REVIEW || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Cần bổ sung hồ sơ</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>
                    {stats.statusBreakdown?.REQUIRES_SUPPLEMENT || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.REQUIRES_SUPPLEMENT || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #a5b4fc' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Đã gửi thêm thông tin</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#a5b4fc', marginTop: '2px' }}>
                    {stats.statusBreakdown?.RESUBMITTED || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.RESUBMITTED || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #34d399' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Đã duyệt</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>
                    {stats.statusBreakdown?.APPROVED || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.APPROVED || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #f87171' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Đã từ chối</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f87171', marginTop: '2px' }}>
                    {stats.statusBreakdown?.REJECTED || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.REJECTED || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Cơ cấu theo Danh mục hồ sơ */}
            {/* 2. Chỉ số Điều Phối & Ngưỡng Thích Ứng NVQS */}
            <div className="card-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={18} color="#818cf8" /> Hiệu Suất Escalation Referee (NVQS)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { label: '⚡ Tự Động Phê Duyệt (Auto Approved)', count: stats.autoApprovedCases || 0, color: '#10b981' },
                  { label: '🚨 Chuyển Cán Bộ Thẩm Định (Escalated)', count: stats.escalatedCases || 0, color: '#f59e0b' },
                  { label: '🛡️ Can Thiệp Đặc Cách (Human Overrides)', count: stats.totalHumanOverrides || 0, color: '#8b5cf6' },
                  { label: '⛔ Hồ Sơ Tạm Dừng Xử Lý (Stopped)', count: stats.stoppedCases || 0, color: '#ef4444' }
                ].map((item, idx) => {
                  const pct = stats.totalCases > 0 ? Math.round((item.count / stats.totalCases) * 100) : 0;
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                        <span>{item.label}</span>
                        <span><strong>{item.count}</strong> ({pct}%)</span>
                      </div>
                      <div style={{ height: '7px', background: '#090d16', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: '4px', transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ngưỡng tin cậy thích ứng */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Ngưỡng tin cậy thích ứng: <strong style={{ color: '#818cf8' }}>{(stats.currentThreshold !== undefined ? stats.currentThreshold : 0.75)}</strong></span>
                <span>Chờ duyệt: <strong style={{ color: '#38bdf8' }}>{stats.pendingCases || 0}</strong></span>
              </div>
            </div>

          </div>

          {/* PHÂN TÍCH HIỆU QUẢ RULE ENGINE & 5 NGUYÊN NHÂN LEO THANG NGHIỆP VỤ */}
          <div className="card-panel" style={{ padding: '24px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8' }}>
                  <Cpu size={20} color="#818cf8" /> Phân Tích 5 Nguyên Nhân Leo Thang Thẩm Định NVQS
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>
                  Hệ thống phân tách rành mạch 3 tầng dữ liệu và kích hoạt chuyển người duyệt chính xác khi có nghi vấn hoặc vượt thẩm quyền.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  ⚡ Tự động phê duyệt: {stats.autoApprovedCases || 0}
                </span>
                <span style={{ fontSize: '0.78rem', background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                  🚨 Cần chuyên viên: {stats.escalatedCases || 0}
                </span>
              </div>
            </div>

            {/* 5 Lý do leo thang chi tiết */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#090d16', borderLeft: '4px solid #ef4444', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#f87171', fontWeight: 700 }}>🔒 OWNERSHIP_UNCLEAR</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f87171' }}>{stats.escalationReasonsBreakdown?.OWNERSHIP_UNCLEAR || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Nghi vấn quyền sở hữu: MSSV hoặc họ tên không khớp hồ sơ gốc</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #f97316', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#fb923c', fontWeight: 700 }}>🚨 FACT_UNKNOWN</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fb923c' }}>{stats.escalationReasonsBreakdown?.FACT_UNKNOWN || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Thiếu dữ kiện xác thực / Địa chỉ chưa đủ thành phần bắt buộc</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #eab308', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#facc15', fontWeight: 700 }}>⚠️ DATA_CONFLICT</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#facc15' }}>{stats.escalationReasonsBreakdown?.DATA_CONFLICT || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Xung đột dữ liệu: Chọn tạm trú hoặc khác thường trú lưu trữ</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #8b5cf6', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#c084fc', fontWeight: 700 }}>👑 AUTHORITY_REQUIRED</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c084fc' }}>{stats.escalationReasonsBreakdown?.AUTHORITY_REQUIRED || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Vượt thẩm quyền: Sinh viên đình chỉ, bảo lưu, thôi học hoặc thiếu TKB</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #06b6d4', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#22d3ee', fontWeight: 700 }}>📋 POLICY_OUT_OF_SCOPE</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#22d3ee' }}>{stats.escalationReasonsBreakdown?.POLICY_OUT_OF_SCOPE || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Ngoài phạm vi chính sách: Có yêu cầu cứu xét đặc cách cá biệt</p>
              </div>
            </div>
          </div>

          {/* HÀNG 3: BẢNG HỒ SƠ MỚI TIẾP NHẬN GẦN ĐÂY */}
          {stats.recentCases && stats.recentCases.length > 0 && (
            <div className="card-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderPlus size={18} color="#34d399" /> Dòng Hồ Sơ Mới Tiếp Nhận Gần Đây
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>5 hồ sơ cập nhật mới nhất</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-sub)' }}>
                      <th style={{ padding: '8px' }}>Mã Đơn</th>
                      <th style={{ padding: '8px' }}>Sinh Viên</th>
                      <th style={{ padding: '8px' }}>Tiêu Đề Hồ Sơ</th>
                      <th style={{ padding: '8px' }}>Danh Mục</th>
                      <th style={{ padding: '8px' }}>Trạng Thái</th>
                      <th style={{ padding: '8px' }}>Thời Gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentCases.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', color: '#818cf8', fontWeight: 700 }}>{c.id}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{c.studentName}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-main)' }}>{c.title}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{CATEGORY_LABELS[c.category] || c.category}</td>
                        <td style={{ padding: '10px 8px' }}>
                          {c.status === 'APPROVED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(5, 150, 105, 0.15)', color: '#34d399' }}>Đã duyệt</span>}
                          {c.status === 'REJECTED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(225, 29, 72, 0.15)', color: '#f87171' }}>Từ chối</span>}
                          {c.status === 'SUBMITTED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8' }}>Chờ duyệt</span>}
                          {c.status === 'UNDER_REVIEW' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(217, 119, 6, 0.15)', color: '#fbbf24' }}>Đang xử lý</span>}
                          {c.status === 'REQUIRES_SUPPLEMENT' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>Cần bổ sung</span>}
                          {c.status === 'RESUBMITTED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }}>Đã bổ sung</span>}
                        </td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-sub)', fontSize: '0.76rem' }}>
                          {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* 2. QUẢN LÝ NGƯỜI DÙNG & CẤP TÀI KHOẢN (REVIEWER / ADMIN / SINH VIÊN) */}
      {activeTab === 'admin_users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '24px' }}>
          
          {/* Form Cấp Tài Khoản Mới từ Admin */}
          <div className="card-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={18} color="var(--accent-primary)" /> Cấp Tài Khoản Mới
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '16px' }}>
              Chỉ Admin mới có quyền tạo và cấp phát tài khoản Ban Thẩm định và Quản trị viên:
            </p>

            <form onSubmit={handleAdminCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Họ và tên *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Trần Thị Mai Phương"
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Vai trò cấp quyền (Role) *
                </label>
                <select
                  className="form-input"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                >
                  <option value="REVIEWER">🔍 REVIEWER (Ban Thẩm định hồ sơ)</option>
                  <option value="ADMIN">🛡️ ADMIN (Quản trị viên cấp cao)</option>
                  <option value="STUDENT">🎓 STUDENT (Học sinh / Sinh viên)</option>
                </select>
              </div>

              {newRole === 'STUDENT' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    Mã số sinh viên (MSSV) *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="SV2026-9921, 22120001..."
                    value={newStudentCode}
                    onChange={e => setNewStudentCode(e.target.value.toUpperCase())}
                    required={newRole === 'STUDENT'}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Tên đăng nhập (Username) *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="reviewer2, admin2..."
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Mật khẩu khởi tạo *
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Tối thiểu 6 ký tự..."
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Khoa / Phòng ban
                </label>
                <select
                  className="form-input"
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value)}
                >
                  <option value="Ban Giám Sát & Xét Duyệt">Ban Giám Sát & Xét Duyệt</option>
                  <option value="Phòng Quản lý Đào tạo">Phòng Quản lý Đào tạo</option>
                  <option value="Phòng Công tác Sinh viên">Phòng Công tác Sinh viên</option>
                  <option value="Phòng Kế hoạch - Tài chính">Phòng Kế hoạch - Tài chính</option>
                  <option value="Phòng Tổ chức - Hành chính">Phòng Tổ chức - Hành chính</option>
                  <option value="Phòng Khảo thí & Đảm bảo chất lượng">Phòng Khảo thí & Đảm bảo chất lượng</option>
                  <option value="Văn phòng Đoàn - Hội Sinh viên">Văn phòng Đoàn - Hội Sinh viên</option>
                  <option value="Trung tâm Hỗ trợ Sinh viên">Trung tâm Hỗ trợ Sinh viên</option>
                  <option value="Trung tâm Công nghệ Thông tin">Trung tâm Công nghệ Thông tin</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={creatingUser}
                className="btn-primary"
                style={{ width: '100%', marginTop: '6px', height: '40px' }}
              >
                <UserPlus size={16} />
                <span>{creatingUser ? 'Đang cấp tài khoản...' : 'Cấp Phát Tài Khoản'}</span>
              </button>
            </form>
          </div>

          {/* Bảng Danh Sách & Đổi Role */}
          <div className="card-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="#38bdf8" /> Danh Sách Người Dùng ({filteredUsers.length}/{users.length})
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Tra cứu theo tên, MSSV, tài khoản và phân quyền linh hoạt</p>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Tìm tên, MSSV, user..."
                    value={userSearchTerm}
                    onChange={e => setUserSearchTerm(e.target.value)}
                    style={{ paddingLeft: '30px', paddingRight: userSearchTerm ? '26px' : '8px', fontSize: '0.78rem', height: '34px' }}
                  />
                  {userSearchTerm && (
                    <button
                      onClick={() => setUserSearchTerm('')}
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                      title="Xóa tìm kiếm"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => openSafeWindow(`${API_BASE}/admin/users/export-csv`)}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', height: '34px', background: 'rgba(5, 150, 105, 0.15)', color: '#34d399', border: '1px solid rgba(5, 150, 105, 0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Xuất bảng người dùng ra file CSV"
                >
                  <Download size={13} />
                  <span>Xuất Bảng User</span>
                </button>
                <button onClick={fetchAdminData} className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '34px' }} title="Làm mới">
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '560px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-sub)' }}>
                    <th style={{ padding: '8px' }}>Họ Và Tên</th>
                    <th style={{ padding: '8px' }}>Mã SV (MSSV)</th>
                    <th style={{ padding: '8px' }}>Username</th>
                    <th style={{ padding: '8px' }}>Khoa / Ban</th>
                    <th style={{ padding: '8px' }}>Vai Trò</th>
                    <th style={{ padding: '8px' }}>Đổi Quyền</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>{u.fullName}</td>
                      <td style={{ padding: '10px 8px' }}>
                        {u.studentCode ? (
                          <span style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {u.studentCode}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#818cf8', fontFamily: 'var(--font-mono)' }}>{u.username}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{u.department}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span className={`badge badge-${u.role.toLowerCase()}`}>{u.role}</span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <select
                          className="form-input"
                          style={{ width: 'auto', padding: '3px 6px', fontSize: '0.75rem' }}
                          value={u.role}
                          onChange={e => handleChangeUserRole(u.id, e.target.value)}
                        >
                          <option value="STUDENT">STUDENT</option>
                          <option value="REVIEWER">REVIEWER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                    </tr>
                  ))}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-sub)' }}>
                        Không tìm thấy người dùng nào phù hợp với từ khóa "{userSearchTerm}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls page={safeUserPage} totalItems={filteredUsers.length} pageSize={userPageSize} onPageChange={setUserPage} label="tài khoản" />
          </div>

        </div>
      )}

      {/* Tái sử dụng Reviewer Queue & Audit cho Admin */}
      {activeTab === 'reviewer_queue' && <ReviewerPortal activeTab="reviewer_queue" caseToOpen={caseToOpen} onCaseOpened={onCaseOpened} />}
      {activeTab === 'reviewer_audit' && <ReviewerPortal activeTab="reviewer_audit" />}
    </div>
  );
};


export default AdminPortal;
