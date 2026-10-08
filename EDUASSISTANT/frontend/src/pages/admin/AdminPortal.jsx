import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users, BarChart3, Settings, ShieldAlert, RefreshCw, Search, Filter,
  CheckCircle2, AlertTriangle, KeyRound, Download, Cpu, Sparkles,
  TrendingUp, PieChart, Layers, FolderPlus, SlidersHorizontal, ArrowUpRight
} from 'lucide-react';
import { API_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import AuditTrailViewer from '../../components/audit/AuditTrailViewer';

const AdminPortal = ({ activeTab, setActiveTab }) => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState(null);

  // States táº¡o tĂ i khoáº£n cĂ¡n bá»™ tá»« Admin
  const [newFullName, setNewFullName] = useState('');
  const [newStudentCode, setNewStudentCode] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('REVIEWER');
  const [newDepartment, setNewDepartment] = useState('Ban GiĂ¡m SĂ¡t & XĂ©t Duyá»‡t');
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
      console.error('Lá»—i táº£i dá»¯ liá»‡u quáº£n trá»‹:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

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
      setAdminMessage({ type: 'error', text: err.response?.data?.message || 'Cáº¥p tĂ i khoáº£n tháº¥t báº¡i!' });
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
      setAdminMessage({ type: 'error', text: err.response?.data?.message || 'Lá»—i cáº­p nháº­t quyá»n!' });
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

      {/* 1. Tá»”NG QUAN QUáº¢N TRá» & CÆ  Cáº¤U Há»’ SÆ  */}
      {activeTab === 'admin_overview' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Báº£ng Äiá»u Khiá»ƒn Tá»•ng Quan Quáº£n Trá»‹</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Theo dĂµi chá»‰ sá»‘ KPI há»c vá»¥, tráº¡ng thĂ¡i tháº©m Ä‘á»‹nh vĂ  phĂ¢n quyá»n toĂ n trÆ°á»ng</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => window.open(`${API_BASE}/reports/export-csv?token=${token}`, '_blank')}
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.82rem', background: 'rgba(5, 150, 105, 0.15)', color: '#34d399', border: '1px solid rgba(5, 150, 105, 0.3)' }}
                title="Xuáº¥t dá»¯ liá»‡u toĂ n bá»™ há»“ sÆ¡ ra file CSV / Excel UTF-8 BOM"
              >
                <Download size={14} /> Xuáº¥t Báº£ng CSV
              </button>
              <button
                onClick={() => window.open(`${API_BASE}/reports/export-cases-html?token=${token}`, '_blank')}
                className="btn-primary shimmer-button"
                style={{ background: 'linear-gradient(135deg, #059669, #10b981)', padding: '8px 14px', fontSize: '0.82rem' }}
                title="Xuáº¥t vĂ  in BĂ¡o CĂ¡o Báº£ng Tá»•ng Há»£p dáº¡ng PDF"
              >
                <FileText size={14} /> In BĂ¡o CĂ¡o Báº£ng (PDF)
              </button>
            </div>
          </div>

          {/* HĂ ng 4 Tháº» KPI ChĂ­nh */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="card-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Tá»•ng Sá»‘ Há»“ SÆ¡</span>
                <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '6px', borderRadius: '8px' }}>
                  <Layers size={18} color="#38bdf8" />
                </div>
              </div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#38bdf8' }}>{stats.totalCases}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.78rem', color: '#34d399' }}>
                <TrendingUp size={14} />
                <span><strong>+{stats.todayCasesCount || 0}</strong> há»“ sÆ¡ má»›i trong 24h</span>
              </div>
            </div>

            <div className="card-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Há»“ SÆ¡ Chá» Xá»­ LĂ½</span>
                <div style={{ background: 'rgba(251, 191, 36, 0.15)', padding: '6px', borderRadius: '8px' }}>
                  <Clock size={18} color="#fbbf24" />
                </div>
              </div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#fbbf24' }}>{stats.pendingCases}</h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Má»›i: <strong>{stats.statusBreakdown?.SUBMITTED || 0}</strong> â€¢ Duyá»‡t láº¡i: <strong>{stats.statusBreakdown?.RESUBMITTED || 0}</strong>
              </p>
            </div>

            <div className="card-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Tá»· Lá»‡ Duyá»‡t ThĂ nh CĂ´ng</span>
                <div style={{ background: 'rgba(52, 211, 153, 0.15)', padding: '6px', borderRadius: '8px' }}>
                  <CheckCircle2 size={18} color="#34d399" />
                </div>
              </div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#34d399' }}>{stats.approvalRate}%</h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                ÄĂ£ duyá»‡t: <strong style={{ color: '#34d399' }}>{stats.approvedCases}</strong> â€¢ Tá»« chá»‘i: <strong style={{ color: '#f87171' }}>{stats.rejectedCases}</strong>
              </p>
            </div>

            <div className="card-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>NgÆ°á»i DĂ¹ng Há»‡ Thá»‘ng</span>
                <div style={{ background: 'rgba(129, 140, 248, 0.15)', padding: '6px', borderRadius: '8px' }}>
                  <Users size={18} color="#818cf8" />
                </div>
              </div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#818cf8' }}>{stats.totalUsers}</h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                SV: <strong>{stats.roleBreakdown?.STUDENT || 0}</strong> â€¢ CĂ¡n bá»™: <strong>{stats.roleBreakdown?.REVIEWER || 0}</strong> â€¢ Admin: <strong>{stats.roleBreakdown?.ADMIN || 0}</strong>
              </p>
            </div>
          </div>

          {/* HĂ€NG 2: CÆ  Cáº¤U TRáº NG THĂI & CÆ  Cáº¤U THEO DANH Má»¤C */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            
            {/* 1. CÆ¡ cáº¥u tráº¡ng thĂ¡i há»“ sÆ¡ hiá»‡n táº¡i */}
            <div className="card-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PieChart size={18} color="#38bdf8" /> CÆ¡ Cáº¥u Tráº¡ng ThĂ¡i Há»“ SÆ¡
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tá»•ng: <strong>{stats.totalCases}</strong> há»“ sÆ¡</span>
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
                  <div title={`Chá» tháº©m Ä‘á»‹nh: ${stats.statusBreakdown?.SUBMITTED || 0}`} style={{ width: `${((stats.statusBreakdown?.SUBMITTED || 0) / stats.totalCases) * 100}%`, background: '#38bdf8' }} />
                  <div title={`Äang xá»­ lĂ½: ${stats.statusBreakdown?.UNDER_REVIEW || 0}`} style={{ width: `${((stats.statusBreakdown?.UNDER_REVIEW || 0) / stats.totalCases) * 100}%`, background: '#fbbf24' }} />
                  <div title={`Cáº§n bá»• sung: ${stats.statusBreakdown?.REQUIRES_SUPPLEMENT || 0}`} style={{ width: `${((stats.statusBreakdown?.REQUIRES_SUPPLEMENT || 0) / stats.totalCases) * 100}%`, background: '#f59e0b' }} />
                  <div title={`ÄĂ£ bá»• sung láº¡i: ${stats.statusBreakdown?.RESUBMITTED || 0}`} style={{ width: `${((stats.statusBreakdown?.RESUBMITTED || 0) / stats.totalCases) * 100}%`, background: '#a5b4fc' }} />
                  <div title={`ÄĂ£ phĂª duyá»‡t: ${stats.statusBreakdown?.APPROVED || 0}`} style={{ width: `${((stats.statusBreakdown?.APPROVED || 0) / stats.totalCases) * 100}%`, background: '#34d399' }} />
                  <div title={`ÄĂ£ tá»« chá»‘i: ${stats.statusBreakdown?.REJECTED || 0}`} style={{ width: `${((stats.statusBreakdown?.REJECTED || 0) / stats.totalCases) * 100}%`, background: '#f87171' }} />
                </div>
              )}

              {/* Grid 6 tráº¡ng thĂ¡i chi tiáº¿t */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #38bdf8' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Chá» tháº©m Ä‘á»‹nh (SUBMITTED)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                    {stats.statusBreakdown?.SUBMITTED || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.SUBMITTED || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #fbbf24' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Äang tháº©m Ä‘á»‹nh (UNDER_REVIEW)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fbbf24', marginTop: '2px' }}>
                    {stats.statusBreakdown?.UNDER_REVIEW || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.UNDER_REVIEW || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Cáº§n bá»• sung há»“ sÆ¡</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>
                    {stats.statusBreakdown?.REQUIRES_SUPPLEMENT || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.REQUIRES_SUPPLEMENT || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #a5b4fc' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>ÄĂ£ ná»™p bá»• sung (RESUBMITTED)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#a5b4fc', marginTop: '2px' }}>
                    {stats.statusBreakdown?.RESUBMITTED || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.RESUBMITTED || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #34d399' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>ÄĂ£ phĂª duyá»‡t (APPROVED)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>
                    {stats.statusBreakdown?.APPROVED || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.APPROVED || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #f87171' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>ÄĂ£ tá»« chá»‘i (REJECTED)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f87171', marginTop: '2px' }}>
                    {stats.statusBreakdown?.REJECTED || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.REJECTED || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. CÆ¡ cáº¥u theo Danh má»¥c há»“ sÆ¡ */}
            <div className="card-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={18} color="#818cf8" /> CÆ¡ Cáº¥u Theo Danh Má»¥c
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { label: 'đŸ“ Miá»…n Giáº£m Há»c PhĂ­', count: stats.categoryBreakdown?.TUITION_DISCOUNT || 0, color: '#38bdf8' },
                  { label: 'đŸ† Há»c Bá»•ng Khuyáº¿n KhĂ­ch', count: stats.categoryBreakdown?.ACADEMIC_SCHOLARSHIP || 0, color: '#fbbf24' },
                  { label: 'đŸ–ï¸ Äiá»ƒm RĂ¨n Luyá»‡n / MHX', count: stats.categoryBreakdown?.COMMUNITY_SERVICE || 0, color: '#818cf8' },
                  { label: 'đŸ†˜ Há»— Trá»£ KhĂ³ KhÄƒn Äá»™t Xuáº¥t', count: stats.categoryBreakdown?.EMERGENCY_AID || 0, color: '#f43f5e' }
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

              {/* ThĂ´ng sá»‘ Æ°u tiĂªn */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Äá»™ Æ°u tiĂªn:</span>
                <span>Kháº©n cáº¥p: <strong style={{ color: '#f43f5e' }}>{stats.priorityBreakdown?.URGENT || 0}</strong></span>
                <span>Cao: <strong style={{ color: '#fbbf24' }}>{stats.priorityBreakdown?.HIGH || 0}</strong></span>
                <span>Trung bĂ¬nh: <strong style={{ color: '#38bdf8' }}>{stats.priorityBreakdown?.MEDIUM || 0}</strong></span>
              </div>
            </div>

          </div>

          {/* PHĂ‚N TĂCH HIá»†U QUáº¢ RULE ENGINE & 5 NGUYĂN NHĂ‚N LEO THANG NGHIá»†P Vá»¤ */}
          <div className="card-panel" style={{ padding: '24px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8' }}>
                  <Cpu size={20} color="#818cf8" /> PhĂ¢n TĂ­ch Hiá»‡u Quáº£ Rule Engine & 5 LĂ½ Do Leo Thang
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>
                  Gemini VLM trĂ­ch xuáº¥t dá»¯ kiá»‡n minh chá»©ng â€¢ Rule Engine phĂ¡n quyáº¿t tá»± Ä‘á»™ng duyá»‡t hoáº·c chuyá»ƒn tiáº¿p Há»™i Ä‘á»“ng tháº©m Ä‘á»‹nh
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  â¡ Tá»± Ä‘á»™ng duyá»‡t: {stats.autoApprovedCases || 0} há»“ sÆ¡
                </span>
                <span style={{ fontSize: '0.78rem', background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                  đŸ¨ Leo thang tháº©m Ä‘á»‹nh: {stats.escalatedCases || 0} há»“ sÆ¡
                </span>
              </div>
            </div>

            {/* 5 LĂ½ do leo thang chi tiáº¿t */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#090d16', borderLeft: '4px solid #ef4444', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#f87171', fontWeight: 700 }}>đŸ”’ OWNERSHIP_UNCLEAR</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f87171' }}>{stats.escalationReasonsBreakdown?.OWNERSHIP_UNCLEAR || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>MSSV hoáº·c há» tĂªn trĂªn minh chá»©ng khĂ´ng khá»›p tĂ i khoáº£n</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #f97316', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#fb923c', fontWeight: 700 }}>đŸ¨ FACT_UNKNOWN</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fb923c' }}>{stats.escalationReasonsBreakdown?.FACT_UNKNOWN || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Thiáº¿u file minh chá»©ng / áº¢nh má» / OCR Ä‘á»™ tin cáº­y &lt; 75%</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #eab308', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#facc15', fontWeight: 700 }}>â ï¸ DATA_CONFLICT</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#facc15' }}>{stats.escalationReasonsBreakdown?.DATA_CONFLICT || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>MĂ¢u thuáº«n thĂ´ng tin tá»± kĂª khai vá»›i thá»±c thá»ƒ AI OCR</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #8b5cf6', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#c084fc', fontWeight: 700 }}>đŸ‘‘ AUTHORITY_REQUIRED</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c084fc' }}>{stats.escalationReasonsBreakdown?.AUTHORITY_REQUIRED || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Há»“ sÆ¡ Æ°u tiĂªn cao / PhĂºc kháº£o Ä‘iá»ƒm / XĂ©t duyá»‡t Há»c bá»•ng</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #06b6d4', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#22d3ee', fontWeight: 700 }}>đŸ“‹ POLICY_OUT_OF_SCOPE</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#22d3ee' }}>{stats.escalationReasonsBreakdown?.POLICY_OUT_OF_SCOPE || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>YĂªu cáº§u ngoáº¡i lá»‡, cá»©u xĂ©t Ä‘áº·c biá»‡t náº±m ngoĂ i quy cháº¿</p>
              </div>
            </div>
          </div>

          {/* HĂ€NG 3: Báº¢NG Há»’ SÆ  Má»I TIáº¾P NHáº¬N Gáº¦N ÄĂ‚Y */}
          {stats.recentCases && stats.recentCases.length > 0 && (
            <div className="card-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderPlus size={18} color="#34d399" /> DĂ²ng Há»“ SÆ¡ Má»›i Tiáº¿p Nháº­n Gáº§n ÄĂ¢y
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>5 há»“ sÆ¡ cáº­p nháº­t má»›i nháº¥t</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-sub)' }}>
                      <th style={{ padding: '8px' }}>MĂ£ ÄÆ¡n</th>
                      <th style={{ padding: '8px' }}>Sinh ViĂªn</th>
                      <th style={{ padding: '8px' }}>TiĂªu Äá» Há»“ SÆ¡</th>
                      <th style={{ padding: '8px' }}>Danh Má»¥c</th>
                      <th style={{ padding: '8px' }}>Tráº¡ng ThĂ¡i</th>
                      <th style={{ padding: '8px' }}>Thá»i Gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentCases.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', color: '#818cf8', fontWeight: 700 }}>{c.id}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{c.studentName}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-main)' }}>{c.title}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{c.category}</td>
                        <td style={{ padding: '10px 8px' }}>
                          {c.status === 'APPROVED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(5, 150, 105, 0.15)', color: '#34d399' }}>ÄĂ£ duyá»‡t</span>}
                          {c.status === 'REJECTED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(225, 29, 72, 0.15)', color: '#f87171' }}>Tá»« chá»‘i</span>}
                          {c.status === 'SUBMITTED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8' }}>Chá» duyá»‡t</span>}
                          {c.status === 'UNDER_REVIEW' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(217, 119, 6, 0.15)', color: '#fbbf24' }}>Äang xá»­ lĂ½</span>}
                          {c.status === 'REQUIRES_SUPPLEMENT' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>Cáº§n bá»• sung</span>}
                          {c.status === 'RESUBMITTED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }}>ÄĂ£ bá»• sung</span>}
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

      {/* 2. QUáº¢N LĂ NGÆ¯á»œI DĂ™NG & Cáº¤P TĂ€I KHOáº¢N (REVIEWER / ADMIN / SINH VIĂN) */}
      {activeTab === 'admin_users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '24px' }}>
          
          {/* Form Cáº¥p TĂ i Khoáº£n Má»›i tá»« Admin */}
          <div className="card-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={18} color="var(--accent-primary)" /> Cáº¥p TĂ i Khoáº£n Má»›i
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '16px' }}>
              Chá»‰ Admin má»›i cĂ³ quyá»n táº¡o vĂ  cáº¥p phĂ¡t tĂ i khoáº£n Ban Tháº©m Ä‘á»‹nh vĂ  Quáº£n trá»‹ viĂªn:
            </p>

            <form onSubmit={handleAdminCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Há» vĂ  tĂªn *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VĂ­ dá»¥: Tráº§n Thá»‹ Mai PhÆ°Æ¡ng"
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Vai trĂ² cáº¥p quyá»n (Role) *
                </label>
                <select
                  className="form-input"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                >
                  <option value="REVIEWER">đŸ” REVIEWER (Ban Tháº©m Ä‘á»‹nh há»“ sÆ¡)</option>
                  <option value="ADMIN">đŸ›¡ï¸ ADMIN (Quáº£n trá»‹ viĂªn cáº¥p cao)</option>
                  <option value="STUDENT">đŸ“ STUDENT (Há»c sinh / Sinh viĂªn)</option>
                </select>
              </div>

              {newRole === 'STUDENT' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    MĂ£ sá»‘ sinh viĂªn (MSSV) *
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
                  TĂªn Ä‘Äƒng nháº­p (Username) *
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
                  Máº­t kháº©u khá»Ÿi táº¡o *
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Tá»‘i thiá»ƒu 6 kĂ½ tá»±..."
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Khoa / PhĂ²ng ban
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ban GiĂ¡m SĂ¡t, PhĂ²ng ÄĂ o Táº¡o..."
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
                <span>{creatingUser ? 'Äang cáº¥p tĂ i khoáº£n...' : 'Cáº¥p PhĂ¡t TĂ i Khoáº£n'}</span>
              </button>
            </form>
          </div>

          {/* Báº£ng Danh SĂ¡ch & Äá»•i Role */}
          <div className="card-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="#38bdf8" /> Danh SĂ¡ch NgÆ°á»i DĂ¹ng ({filteredUsers.length}/{users.length})
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Tra cá»©u theo tĂªn, MSSV, tĂ i khoáº£n vĂ  phĂ¢n quyá»n linh hoáº¡t</p>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="TĂ¬m tĂªn, MSSV, user..."
                    value={userSearchTerm}
                    onChange={e => setUserSearchTerm(e.target.value)}
                    style={{ paddingLeft: '30px', paddingRight: userSearchTerm ? '26px' : '8px', fontSize: '0.78rem', height: '34px' }}
                  />
                  {userSearchTerm && (
                    <button
                      onClick={() => setUserSearchTerm('')}
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                      title="XĂ³a tĂ¬m kiáº¿m"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => window.open(`${API_BASE}/admin/users/export-csv?token=${token}`, '_blank')}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', height: '34px', background: 'rgba(5, 150, 105, 0.15)', color: '#34d399', border: '1px solid rgba(5, 150, 105, 0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Xuáº¥t báº£ng ngÆ°á»i dĂ¹ng ra file CSV"
                >
                  <Download size={13} />
                  <span>Xuáº¥t Báº£ng User</span>
                </button>
                <button onClick={fetchAdminData} className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '34px' }} title="LĂ m má»›i">
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '560px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-sub)' }}>
                    <th style={{ padding: '8px' }}>Há» VĂ  TĂªn</th>
                    <th style={{ padding: '8px' }}>MĂ£ SV (MSSV)</th>
                    <th style={{ padding: '8px' }}>Username</th>
                    <th style={{ padding: '8px' }}>Khoa / Ban</th>
                    <th style={{ padding: '8px' }}>Vai TrĂ²</th>
                    <th style={{ padding: '8px' }}>Äá»•i Quyá»n</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
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
                        KhĂ´ng tĂ¬m tháº¥y ngÆ°á»i dĂ¹ng nĂ o phĂ¹ há»£p vá»›i tá»« khĂ³a "{userSearchTerm}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TĂ¡i sá»­ dá»¥ng Reviewer Queue & Audit cho Admin */}
      {activeTab === 'reviewer_queue' && <ReviewerPortal activeTab="reviewer_queue" />}
      {activeTab === 'reviewer_audit' && <ReviewerPortal activeTab="reviewer_audit" />}
    </div>
  );
};


export default AdminPortal;