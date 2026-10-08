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

const CATEGORY_LABELS = {
  TUITION_DISCOUNT: 'Miễn, giảm học phí',
  ACADEMIC_SCHOLARSHIP: 'Học bổng',
  COMMUNITY_SERVICE: 'Hoạt động cộng đồng',
  EMERGENCY_AID: 'Hỗ trợ khó khăn đột xuất',
  GRADE_APPEAL: 'Phúc khảo điểm'
};

const AdminPortal = ({ activeTab, caseToOpen, onCaseOpened }) => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminMessage, setAdminMessage] = useState(null);

  // States tạo tài khoản cán bộ từ Admin
  const [newFullName, setNewFullName] = useState('');
  const [newStudentCode, setNewStudentCode] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('REVIEWER');
  const [newDepartment, setNewDepartment] = useState('Ban Giám Sát & Xét Duyệt');
  const [creatingUser, setCreatingUser] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (usersRes.data?.success) setUsers(usersRes.data.data.users);
      if (statsRes.data?.success) setStats(statsRes.data.data);
    } catch (err) {
      console.error('Lỗi tải dữ liệu quản trị:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchAdminData();
  }, [token]);

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

  if (loading && !stats && users.length === 0) {
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
                onClick={() => window.open(`${API_BASE}/reports/export-csv?token=${token}`, '_blank')}
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.82rem', background: 'rgba(5, 150, 105, 0.15)', color: '#34d399', border: '1px solid rgba(5, 150, 105, 0.3)' }}
                title="Xuất dữ liệu toàn bộ hồ sơ ra file CSV / Excel UTF-8 BOM"
              >
                <Download size={14} /> Xuất Bảng CSV
              </button>
              <button
                onClick={() => window.open(`${API_BASE}/reports/export-cases-html?token=${token}`, '_blank')}
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
            <div className="card-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={18} color="#818cf8" /> Cơ Cấu Theo Danh Mục
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { label: '🎓 Miễn Giảm Học Phí', count: stats.categoryBreakdown?.TUITION_DISCOUNT || 0, color: '#38bdf8' },
                  { label: '🏆 Học Bổng Khuyến Khích', count: stats.categoryBreakdown?.ACADEMIC_SCHOLARSHIP || 0, color: '#fbbf24' },
                  { label: '🎖️ Điểm Rèn Luyện / MHX', count: stats.categoryBreakdown?.COMMUNITY_SERVICE || 0, color: '#818cf8' },
                  { label: '🆘 Hỗ Trợ Khó Khăn Đột Xuất', count: stats.categoryBreakdown?.EMERGENCY_AID || 0, color: '#f43f5e' }
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

              {/* Thông số ưu tiên */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Độ ưu tiên:</span>
                <span>Khẩn cấp: <strong style={{ color: '#f43f5e' }}>{stats.priorityBreakdown?.URGENT || 0}</strong></span>
                <span>Cao: <strong style={{ color: '#fbbf24' }}>{stats.priorityBreakdown?.HIGH || 0}</strong></span>
                <span>Trung bình: <strong style={{ color: '#38bdf8' }}>{stats.priorityBreakdown?.MEDIUM || 0}</strong></span>
              </div>
            </div>

          </div>

          {/* PHÂN TÍCH HIỆU QUẢ RULE ENGINE & 5 NGUYÊN NHÂN LEO THANG NGHIỆP VỤ */}
          <div className="card-panel" style={{ padding: '24px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8' }}>
                  <Cpu size={20} color="#818cf8" /> Phân tích các hồ sơ cần xem xét thêm
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>
                  Hệ thống kiểm tra thông tin hồ sơ và minh chứng để xác định hồ sơ có thể xử lý ngay hoặc cần cán bộ xem xét.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  ⚡ Có thể xử lý tự động: {stats.autoApprovedCases || 0} hồ sơ
                </span>
                <span style={{ fontSize: '0.78rem', background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                  🚨 Cần cán bộ xem xét: {stats.escalatedCases || 0} hồ sơ
                </span>
              </div>
            </div>

            {/* 5 Lý do leo thang chi tiết */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#090d16', borderLeft: '4px solid #ef4444', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#f87171', fontWeight: 700 }}>🔒 Thông tin sinh viên chưa khớp</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f87171' }}>{stats.escalationReasonsBreakdown?.OWNERSHIP_UNCLEAR || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>MSSV hoặc họ tên trên minh chứng không khớp tài khoản</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #f97316', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#fb923c', fontWeight: 700 }}>🚨 Thiếu hoặc khó đọc minh chứng</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fb923c' }}>{stats.escalationReasonsBreakdown?.FACT_UNKNOWN || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Chưa có tệp minh chứng hoặc tệp quá mờ để đọc rõ thông tin</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #eab308', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#facc15', fontWeight: 700 }}>⚠️ Thông tin kê khai chưa khớp</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#facc15' }}>{stats.escalationReasonsBreakdown?.DATA_CONFLICT || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Thông tin sinh viên kê khai khác với thông tin trên minh chứng</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #8b5cf6', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#c084fc', fontWeight: 700 }}>👑 Cần hội đồng xem xét</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c084fc' }}>{stats.escalationReasonsBreakdown?.AUTHORITY_REQUIRED || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Hồ sơ cần quyết định từ cấp có thẩm quyền hoặc hội đồng</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #06b6d4', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#22d3ee', fontWeight: 700 }}>📋 Yêu cầu ngoài quy định</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#22d3ee' }}>{stats.escalationReasonsBreakdown?.POLICY_OUT_OF_SCOPE || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Yêu cầu cần được xem xét riêng vì chưa thuộc quy định hiện hành</p>
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
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ban Giám Sát, Phòng Đào Tạo..."
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value)}
                />
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
                  onClick={() => window.open(`${API_BASE}/admin/users/export-csv?token=${token}`, '_blank')}
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
