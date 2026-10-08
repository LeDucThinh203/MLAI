import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Search, RefreshCw, CheckCircle2, Eye,
  ThumbsUp, ThumbsDown, X, Download, Printer, Image,
  Maximize2, Cpu, Paperclip,
  ExternalLink, StopCircle, Sliders, Shield,
  Inbox, FileText, Building2, UserCheck, History, MessageSquare, AlertCircle, QrCode
} from 'lucide-react';
import { API_BASE, SERVER_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { renderSlaBadge } from '../../utils/formatters';
import CaseDiscussion from '../../components/discussion/CaseDiscussion';
import AuditTrailViewer from '../../components/audit/AuditTrailViewer';
import PageSkeleton from '../../components/common/PageSkeleton';

const ReviewerPortal = ({ activeTab }) => {
  const { token, user } = useAuth();
  const [allCases, setAllCases] = useState([]);
  const [audits, setAudits] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [escalationFilter, setEscalationFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [reRouting, setReRouting] = useState(false);
  const [targetDepartment, setTargetDepartment] = useState('');
  const [previewModalImg, setPreviewModalImg] = useState(null);

  const [reviewReason, setReviewReason] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const fetchReviewerData = async () => {
    setLoading(true);
    try {
      const [casesRes, auditsRes] = await Promise.all([
        axios.get(`${API_BASE}/cases`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/audits`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (casesRes.data?.success) {
        setAllCases(casesRes.data.data.cases);
        if (selectedCase) {
          const fresh = casesRes.data.data.cases.find(c => c.id === selectedCase.id);
          if (fresh) setSelectedCase(fresh);
        }
      }
      if (auditsRes.data?.success) setAudits(auditsRes.data.data.audits);
    } catch (err) {
      console.error('Lỗi tải dữ liệu reviewer:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchReviewerData();
  }, [token]);

  const handleReRouteCase = async (newDept) => {
    if (!newDept || !selectedCase) return;
    setReRouting(true);
    try {
      const res = await axios.post(`${API_BASE}/cases/${selectedCase.id}/re-route`, {
        department: newDept
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setActionMessage({ type: 'success', text: res.data.message });
        fetchReviewerData();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi điều phối hồ sơ!' });
    } finally {
      setReRouting(false);
    }
  };

  const handleReviewAction = async (action, overrideTarget = 'APPROVED') => {
    if (!reviewReason || reviewReason.trim().length < 5) {
      setActionMessage({ type: 'error', text: 'Vui lòng nhập lý do / hướng dẫn cụ thể (tối thiểu 5 ký tự)!' });
      return;
    }

    setReviewing(true);
    setActionMessage(null);

    try {
      const payload = {
        action,
        reason: reviewReason.trim()
      };
      if (action === 'OVERRIDE') {
        payload.overrideReason = reviewReason.trim();
        payload.targetStatus = overrideTarget;
      }

      const res = await axios.post(`${API_BASE}/cases/${selectedCase.id}/review`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        setActionMessage({ type: 'success', text: res.data.message });
        setReviewReason('');
        fetchReviewerData();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Thao tác thẩm định thất bại!' });
    } finally {
      setReviewing(false);
    }
  };

  const handleReviewerFeedback = async (feedbackType) => {
    if (!selectedCase) return;
    setSubmittingFeedback(true);
    try {
      const res = await axios.post(`${API_BASE}/cases/${selectedCase.id}/feedback`, {
        type: feedbackType,
        note: feedbackNote || `Đánh giá từ thẩm định viên: ${feedbackType}`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setActionMessage({ type: 'success', text: res.data.message });
        setFeedbackNote('');
        fetchReviewerData();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi gửi phản hồi feedback!' });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleEvaluateRules = async (caseId) => {
    setReEvaluating(true);
    try {
      const res = await axios.post(`${API_BASE}/cases/${caseId}/evaluate-rules`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        const evalResult = res.data.data.evaluation;
        setSelectedCase(prev => ({
          ...prev,
          ruleEngine: evalResult,
          escalation: evalResult.decision === 'ESCALATE_TO_HUMAN' ? {
            reason: evalResult.escalationReason,
            title: evalResult.escalationConfig?.label,
            config: evalResult.escalationConfig,
            ruleMatched: evalResult.ruleMatched,
            explanation: evalResult.explanation,
            discrepancies: evalResult.discrepancies,
            confidence: evalResult.confidence,
            tamperRisk: evalResult.tamperRisk,
            evaluatedAt: evalResult.evaluatedAt,
            suggestedAction: evalResult.suggestedAction
          } : null
        }));
        setActionMessage({ type: 'success', text: `Đã chạy Rule Engine tái thẩm định thành công! (${evalResult.ruleMatched})` });
        fetchReviewerData();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi khi chạy Rule Engine!' });
    } finally {
      setReEvaluating(false);
    }
  };

  const filteredCases = allCases.filter(c => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
    if (departmentFilter !== 'ALL' && c.assignedDepartment !== departmentFilter) return false;
    if (escalationFilter !== 'ALL') {
      const isAuto = c.status === 'APPROVED' || c.ruleEngine?.decision === 'AUTO_APPROVE';
      const escReason = c.escalation?.reason || c.ruleEngine?.escalationReason;
      if (escalationFilter === 'AUTO_APPROVE' && !isAuto) return false;
      if (escalationFilter !== 'AUTO_APPROVE' && escReason !== escalationFilter) return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchName = c.studentName?.toLowerCase().includes(q);
      const matchStudentCode = c.studentCode?.toLowerCase().includes(q) || c.studentId?.toLowerCase().includes(q);
      const matchTitle = c.title?.toLowerCase().includes(q);
      const matchDesc = c.description?.toLowerCase().includes(q);
      const matchId = c.id?.toLowerCase().includes(q);
      const matchDept = c.assignedDepartment?.toLowerCase().includes(q);
      const matchReviewNote = c.reviewNote?.toLowerCase().includes(q);
      const matchSuppReason = c.supplementRequestReason?.toLowerCase().includes(q);
      const matchSuppHistory = c.supplementHistory?.some(s => s.note?.toLowerCase().includes(q));
      
      return Boolean(matchName || matchStudentCode || matchTitle || matchDesc || matchId || matchDept || matchReviewNote || matchSuppReason || matchSuppHistory);
    }
    return true;
  }).sort((a, b) => {
    // Sort logic: Overdue first, then pending, then approved
    const aOverdue = a.deadline && new Date(a.deadline).getTime() < Date.now() && a.status !== 'APPROVED';
    const bOverdue = b.deadline && new Date(b.deadline).getTime() < Date.now() && b.status !== 'APPROVED';
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const renderStatus = (status) => {
    switch (status) {
      case 'SUBMITTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8' }}>Chờ thẩm định</span>;
      case 'UNDER_REVIEW':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(217, 119, 6, 0.15)', color: '#fbbf24' }}>Đang xử lý</span>;
      case 'APPROVED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(5, 150, 105, 0.15)', color: '#34d399' }}>Đã duyệt (Approved)</span>;
      case 'REJECTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(225, 29, 72, 0.15)', color: '#f87171' }}>Đã từ chối (Rejected)</span>;
      case 'REQUIRES_SUPPLEMENT':
      case 'INFO_REQUESTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}>Cần bổ sung hồ sơ</span>;
      case 'RESUBMITTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }}>Đã bổ sung (Chờ duyệt lại)</span>;
      default:
        return <span>{status}</span>;
    }
  };

  const renderEscalationBadge = (c) => {
    const esc = c.escalation || c.ruleEngine?.escalationReason;
    const reasonCode = typeof esc === 'string' ? esc : esc?.reason;
    const isAuto = c.status === 'APPROVED' || c.ruleEngine?.decision === 'AUTO_APPROVE';

    if (isAuto) {
      return (
        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          ⚡ Tự động duyệt (Rule Engine)
        </span>
      );
    }
    if (reasonCode === 'OWNERSHIP_UNCLEAR') {
      return (
        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          🔒 OWNERSHIP_UNCLEAR (Lệch MSSV)
        </span>
      );
    }
    if (reasonCode === 'FACT_UNKNOWN') {
      return (
        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
          🚨 FACT_UNKNOWN (Thiếu dữ kiện/Ảnh mờ)
        </span>
      );
    }
    if (reasonCode === 'DATA_CONFLICT') {
      return (
        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
          ⚠️ DATA_CONFLICT (Mâu thuẫn kê khai)
        </span>
      );
    }
    if (reasonCode === 'AUTHORITY_REQUIRED') {
      return (
        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
          👑 AUTHORITY_REQUIRED (Cần Hội đồng)
        </span>
      );
    }
    if (reasonCode === 'POLICY_OUT_OF_SCOPE') {
      return (
        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
          📋 POLICY_OUT_OF_SCOPE (Ngoài quy chế)
        </span>
      );
    }
    return null;
  };

  if (loading && allCases.length === 0 && audits.length === 0) {
    return <PageSkeleton variant="portal" label="Đang tải hàng đợi thẩm định" />;
  }

  return (
    <div className="portal-content portal-content--reviewer" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {activeTab === 'reviewer_queue' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedCase ? '380px 1.4fr 1.1fr' : '1fr',
          gap: '20px',
          alignItems: 'start',
          width: '100%'
        }}>
          {/* CỘT 1: HÀNG ĐỢI THẨM ĐỊNH & BỘ TÌM KIẾM */}
          <div className="card-panel" style={{ padding: '20px' }}>
            {/* Header hàng đợi */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Inbox size={18} color="var(--accent-amber)" /> Hàng Đợi Thẩm Định
                  <span style={{ fontSize: '0.75rem', background: '#334155', padding: '2px 7px', borderRadius: '12px', color: '#f8fafc' }}>
                    {filteredCases.length} / {allCases.length}
                  </span>
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Chọn hồ sơ để xem Ma trận Rule Engine</p>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  onClick={() => {
                    const q = new URLSearchParams();
                    if (statusFilter !== 'ALL') q.append('status', statusFilter);
                    if (categoryFilter !== 'ALL') q.append('category', categoryFilter);
                    q.append('token', token);
                    window.open(`${API_BASE}/reports/export-csv?${q.toString()}`, '_blank');
                  }}
                  className="btn-secondary"
                  style={{ padding: '5px 8px', fontSize: '0.74rem', background: 'rgba(5, 150, 105, 0.15)', border: '1px solid rgba(5, 150, 105, 0.3)', color: '#34d399' }}
                  title="Xuất bảng hồ sơ hiện tại ra file Excel / CSV (UTF-8 BOM)"
                >
                  <Download size={12} />
                  <span>Bảng CSV</span>
                </button>
                <button
                  onClick={() => {
                    const q = new URLSearchParams();
                    if (statusFilter !== 'ALL') q.append('status', statusFilter);
                    if (categoryFilter !== 'ALL') q.append('category', categoryFilter);
                    q.append('token', token);
                    window.open(`${API_BASE}/reports/export-cases-html?${q.toString()}`, '_blank');
                  }}
                  className="btn-primary shimmer-button"
                  style={{ padding: '5px 8px', fontSize: '0.74rem', background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
                  title="Xuất bảng hồ sơ dạng báo cáo tổng hợp in ấn / PDF"
                >
                  <FileText size={12} />
                  <span>Bảng PDF</span>
                </button>
                <button onClick={fetchReviewerData} className="btn-secondary" style={{ padding: '5px 8px' }} title="Làm mới danh sách">
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* THANH TÌM KIẾM THEO TÊN, MSSV, MÃ HỒ SƠ, LÝ DO GIẢI TRÌNH */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tìm tên, MSSV, mã đơn, lý do..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: '34px', paddingRight: searchTerm ? '32px' : '10px', fontSize: '0.82rem', padding: '8px 34px' }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px'
                    }}
                    title="Xóa tìm kiếm"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* BỘ LỌC KẾT HỢP: TRẠNG THÁI & DANH MỤC & LÝ DO LEO THANG */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <select
                  className="form-input"
                  style={{ width: '100%', padding: '5px 8px', fontSize: '0.78rem' }}
                  value={escalationFilter}
                  onChange={e => setEscalationFilter(e.target.value)}
                >
                  <option value="ALL">⚖️ Tất cả phân loại Rule Engine</option>
                  <option value="AUTO_APPROVE">⚡ Tự động duyệt (Rule Engine Passed)</option>
                  <option value="OWNERSHIP_UNCLEAR">🔒 OWNERSHIP_UNCLEAR (Lệch MSSV/Tên)</option>
                  <option value="FACT_UNKNOWN">🚨 FACT_UNKNOWN (Thiếu dữ kiện/Ảnh mờ)</option>
                  <option value="DATA_CONFLICT">⚠️ DATA_CONFLICT (Kê khai ≠ Minh chứng)</option>
                  <option value="AUTHORITY_REQUIRED">👑 AUTHORITY_REQUIRED (Cần Hội đồng)</option>
                  <option value="POLICY_OUT_OF_SCOPE">📋 POLICY_OUT_OF_SCOPE (Ngoài quy chế)</option>
                </select>

                <select
                  className="form-input"
                  style={{ width: '100%', padding: '5px 8px', fontSize: '0.78rem' }}
                  value={departmentFilter}
                  onChange={e => setDepartmentFilter(e.target.value)}
                >
                  <option value="ALL">🏢 Tất cả phòng ban thụ lý</option>
                  <option value="Phòng Kế hoạch - Tài chính">Phòng Kế hoạch - Tài chính</option>
                  <option value="Phòng Công tác Sinh viên">Phòng Công tác Sinh viên</option>
                  <option value="Phòng Quản lý Đào tạo">Phòng Quản lý Đào tạo</option>
                  <option value="Văn phòng Đoàn - Hội Sinh viên">Văn phòng Đoàn - Hội Sinh viên</option>
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <select
                    className="form-input"
                    style={{ width: '100%', padding: '5px 8px', fontSize: '0.78rem' }}
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">📋 Trạng thái</option>
                    <option value="SUBMITTED">⏳ Chờ duyệt</option>
                    <option value="UNDER_REVIEW">⚠️ Đang xử lý</option>
                    <option value="REQUIRES_SUPPLEMENT">🔄 Cần bổ sung</option>
                    <option value="APPROVED">✅ Đã duyệt</option>
                    <option value="REJECTED">❌ Đã từ chối</option>
                  </select>

                  <select
                    className="form-input"
                    style={{ width: '100%', padding: '5px 8px', fontSize: '0.78rem' }}
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                  >
                    <option value="ALL">🏷️ Danh mục</option>
                    <option value="TUITION_DISCOUNT">🎓 Giảm học phí</option>
                    <option value="ACADEMIC_SCHOLARSHIP">🏆 Học bổng</option>
                    <option value="COMMUNITY_SERVICE">🎖️ Mùa Hè Xanh</option>
                    <option value="GRADE_APPEAL">📝 Phúc khảo</option>
                  </select>
                </div>

                {(searchTerm || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || departmentFilter !== 'ALL' || escalationFilter !== 'ALL') && (
                  <button
                    onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); setCategoryFilter('ALL'); setDepartmentFilter('ALL'); setEscalationFilter('ALL'); }}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.74rem', width: '100%', justifyContent: 'center' }}
                  >
                    Đặt lại toàn bộ bộ lọc
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '680px', overflowY: 'auto' }}>
              {filteredCases.map(c => {
                const isSelected = selectedCase?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => { setSelectedCase(c); setActionMessage(null); setReviewReason(''); setTargetDepartment(c.assignedDepartment || ''); }}
                    style={{
                      background: isSelected ? '#1e293b' : '#0f172a',
                      border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      borderRadius: '8px',
                      padding: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: '#818cf8', fontWeight: 700 }}>{c.id}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {renderStatus(c.status)}
                        {renderSlaBadge(c)}
                      </div>
                    </div>
                    <h3 style={{ fontSize: '0.86rem', fontWeight: 600, lineHeight: 1.3 }}>{c.title}</h3>
                    
                    {/* Escalation or Auto Badge & Department */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                      {renderEscalationBadge(c)}
                      <span style={{ fontSize: '0.66rem', background: '#334155', color: '#93c5fd', padding: '1px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Building2 size={10} /> {c.assignedDepartment || 'Phòng Công tác Sinh viên'}
                      </span>
                    </div>

                    {/* Reviewer Stamp */}
                    {c.reviewResult?.reviewerName && (
                      <div style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: c.status === 'APPROVED' ? '#34d399' : (c.status === 'REJECTED' ? '#f87171' : '#fbbf24'),
                        background: c.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.12)' : (c.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)'),
                        padding: '2px 7px',
                        borderRadius: '4px',
                        width: 'fit-content'
                      }}>
                        <UserCheck size={11} />
                        <span>{c.status === 'APPROVED' ? 'Duyệt bởi: ' : (c.status === 'REJECTED' ? 'Từ chối bởi: ' : 'Xử lý bởi: ')}<strong>{c.reviewResult.reviewerName}</strong></span>
                      </div>
                    )}

                    <div style={{ fontSize: '0.74rem', color: 'var(--text-sub)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                      <span>SV: <strong>{c.studentName}</strong> {c.studentCode && <code style={{ color: '#38bdf8', marginLeft: '4px' }}>({c.studentCode})</code>}</span>
                      <span>{new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                );
              })}

              {filteredCases.length === 0 && (
                <div style={{ textAlign: 'center', padding: '28px 16px', background: '#090d16', borderRadius: '8px', border: '1px dashed #334155', color: 'var(--text-sub)' }}>
                  <Search size={24} style={{ opacity: 0.4, marginBottom: '6px' }} />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>Không tìm thấy hồ sơ nào</p>
                  <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                    {searchTerm ? `Không khớp với "${searchTerm}".` : 'Không có hồ sơ theo bộ lọc.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* CỘT 2: CHI TIẾT HỒ SƠ & MA TRẬN PHÁN QUYẾT RULE ENGINE */}
          {selectedCase && (
            <div className="card-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', color: '#818cf8', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{selectedCase.id}</span>
                    {renderStatus(selectedCase.status)}
                    {renderEscalationBadge(selectedCase)}
                  </div>
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 700, lineHeight: 1.35 }}>{selectedCase.title}</h3>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleEvaluateRules(selectedCase.id)}
                    disabled={reEvaluating}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}
                    title="Chạy lại Rule Engine đánh giá hồ sơ"
                  >
                    <RefreshCw size={12} className={reEvaluating ? 'animate-spin' : ''} />
                    <span>{reEvaluating ? 'Đang chạy Rule...' : 'Tái Thẩm Định Rule'}</span>
                  </button>
                  <button
                    onClick={() => window.open(`${API_BASE}/cases/${selectedCase.id}/export-decision?token=${token}`, '_blank')}
                    className="btn-primary shimmer-button"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'linear-gradient(135deg, #059669, #10b981)' }}
                    title="Xem bản in Quyết định học vụ có mã QR và chữ ký điện tử"
                  >
                    📄 In Quyết Định (PDF)
                  </button>
                  <button onClick={() => setSelectedCase(null)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                    Đóng
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#0f172a', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>Sinh viên nộp:</span>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>{selectedCase.studentName}</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '3px', fontSize: '0.74rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>MSSV: <strong style={{ color: '#38bdf8' }}>{selectedCase.studentCode || 'Chưa cập nhật'}</strong></span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>Danh mục & Độ ưu tiên:</span>
                  <p style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>{selectedCase.category}</p>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ưu tiên: <strong>{selectedCase.priority || 'MEDIUM'}</strong></span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>Nội dung giải trình của sinh viên:</span>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', background: '#0f172a', padding: '10px 12px', borderRadius: '8px', marginTop: '4px', lineHeight: '1.5', border: '1px solid var(--border-color)' }}>
                  {selectedCase.description}
                </p>
              </div>

              {/* ========================================================================= */}
              {/* KHUNG RULE ENGINE & MA TRẬN ĐỐI CHIẾU THỰC THỂ (GEMINI OCR VS FORM) */}
              {/* ========================================================================= */}
              <div style={{
                background: '#090d16',
                border: selectedCase.status === 'APPROVED' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(249, 115, 22, 0.4)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cpu size={16} color={selectedCase.status === 'APPROVED' ? '#34d399' : '#fb923c'} />
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc' }}>
                      Phán Quyết Rule Engine & Ma Trận Thực Thể
                    </h4>
                  </div>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: selectedCase.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: selectedCase.status === 'APPROVED' ? '#34d399' : '#f87171'
                  }}>
                    {selectedCase.status === 'APPROVED' ? '✓ ĐỦ ĐIỀU KIỆN TỰ ĐỘNG DUYỆT' : `🚨 LEO THANG: ${selectedCase.escalation?.reason || 'HUMAN_REVIEW'}`}
                  </span>
                </div>

                {/* Phán quyết chi tiết */}
                <div style={{
                  background: selectedCase.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(249, 115, 22, 0.08)',
                  borderLeft: `4px solid ${selectedCase.status === 'APPROVED' ? '#10b981' : '#f97316'}`,
                  padding: '10px 12px',
                  borderRadius: '0 6px 6px 0',
                  fontSize: '0.8rem',
                  color: '#e2e8f0',
                  lineHeight: '1.45'
                }}>
                  <div style={{ fontWeight: 700, color: selectedCase.status === 'APPROVED' ? '#34d399' : '#fb923c', marginBottom: '4px' }}>
                    Quy tắc kích hoạt: <code>{selectedCase.ruleEngine?.ruleMatched || selectedCase.aiExtraction?.policyRuleMatch || 'RULE_EVALUATED'}</code>
                  </div>
                  <p>{selectedCase.ruleEngine?.explanation || selectedCase.escalation?.explanation || 'Hồ sơ đã được kiểm tra tính pháp lý qua bộ quy chuẩn đào tạo.'}</p>
                  {selectedCase.escalation?.suggestedAction && (
                    <div style={{ marginTop: '6px', fontSize: '0.76rem', color: '#94a3b8' }}>
                      👉 <strong>Khuyến nghị xử lý:</strong> {selectedCase.escalation.suggestedAction}
                    </div>
                  )}
                </div>

                {/* BẢNG SO SÁNH ĐỐI CHIẾU THỰC THỂ (KHAI BÁO VS AI OCR) */}
                {selectedCase.ruleEngine?.discrepancies && selectedCase.ruleEngine.discrepancies.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Bảng So Sánh Đối Chiếu Thực Thể (Form vs Gemini OCR):
                    </span>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#1e293b', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Dữ Kiện Thẩm Định</th>
                            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Sinh Viên Khai Báo</th>
                            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Gemini OCR Trích Xuất</th>
                            <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'center' }}>Kết Quả</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCase.ruleEngine.discrepancies.map((d, dIdx) => (
                            <tr key={dIdx} style={{ borderBottom: '1px solid #1e293b' }}>
                              <td style={{ padding: '6px 8px', color: '#cbd5e1', fontWeight: 600 }}>{d.field}</td>
                              <td style={{ padding: '6px 8px', color: '#94a3b8' }}>{d.studentClaim}</td>
                              <td style={{ padding: '6px 8px', color: '#38bdf8' }}>{d.aiFact}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                {d.match ? (
                                  <span style={{ color: '#34d399', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                    ✓ Khớp
                                  </span>
                                ) : (
                                  <span style={{ color: '#f87171', fontWeight: 700, background: 'rgba(239, 68, 68, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                    ✗ Lệch
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {selectedCase.supplementHistory && selectedCase.supplementHistory.length > 0 && (
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <History size={14} /> Lịch sử sinh viên đã bổ sung:
                  </span>
                  {selectedCase.supplementHistory.map((s, idx) => (
                    <p key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '4px' }}>
                      • [{new Date(s.submittedAt).toLocaleTimeString('vi-VN')}]: <em>"{s.note}"</em>
                    </p>
                  ))}
                </div>
              )}

              {/* THÔNG TIN NGƯỜI ĐÃ PHÊ DUYỆT / TỪ CHỐI (NẾU ĐÃ THẨM ĐỊNH) */}
              {selectedCase.reviewResult && (
                <div style={{
                  background: selectedCase.status === 'APPROVED' ? 'rgba(5, 150, 105, 0.08)' : (selectedCase.status === 'REJECTED' ? 'rgba(225, 29, 72, 0.08)' : 'rgba(217, 119, 6, 0.08)'),
                  border: `1px solid ${selectedCase.status === 'APPROVED' ? '#059669' : (selectedCase.status === 'REJECTED' ? '#e11d48' : '#d97706')}`,
                  borderRadius: '8px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: selectedCase.status === 'APPROVED' ? '#34d399' : (selectedCase.status === 'REJECTED' ? '#f87171' : '#fbbf24'), display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UserCheck size={16} /> Thông Tin Cán Bộ Thẩm Định & Quyết Định
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-sub)' }}>
                      {selectedCase.reviewResult.reviewedAt ? new Date(selectedCase.reviewResult.reviewedAt).toLocaleString('vi-VN') : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#090d16', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
                      {selectedCase.reviewResult.reviewerName?.charAt(0) || 'U'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>{selectedCase.reviewResult.reviewerName}</span>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: '#334155', color: '#93c5fd', fontWeight: 600 }}>
                          {selectedCase.reviewResult.reviewerRole || 'Cán bộ'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Đơn vị: <strong>{selectedCase.reviewResult.reviewerDepartment || 'Phòng Công Tác Sinh Viên'}</strong>
                      </div>
                    </div>
                  </div>

                  {selectedCase.reviewResult.reason && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '6px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-sub)' }}>Ghi chú / Kết luận: </span>
                      {selectedCase.reviewResult.reason}
                    </div>
                  )}
                </div>
              )}

              {/* KHUNG THẨM ĐỊNH TAY (HUMAN REVIEW DECISION) */}
              <div style={{
                background: '#0b1329',
                border: '1px solid #3b82f6',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                    <MessageSquare size={16} /> Quyết Định Thẩm Định Của Cán Bộ (Human Review)
                  </h4>
                  {user && (
                    <span style={{ fontSize: '0.72rem', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      👤 Cán bộ: <strong>{user.fullName || user.username}</strong> ({user.department || user.role})
                    </span>
                  )}
                </div>

                {actionMessage && (
                  <div style={{
                    background: actionMessage.type === 'success' ? 'rgba(5, 150, 105, 0.2)' : 'rgba(225, 29, 72, 0.2)',
                    border: `1px solid ${actionMessage.type === 'success' ? 'rgba(5, 150, 105, 0.4)' : 'rgba(225, 29, 72, 0.4)'}`,
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: actionMessage.type === 'success' ? '#34d399' : '#f87171',
                    fontSize: '0.82rem'
                  }}>
                    {actionMessage.text}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                    Lý do / Hướng dẫn bổ sung hồ sơ * (Bắt buộc)
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Nhập lý do duyệt, từ chối, hoặc ghi rõ các giấy tờ cần bổ sung để duyệt lại..."
                    value={reviewReason}
                    onChange={e => setReviewReason(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <button
                    onClick={() => handleReviewAction('APPROVE')}
                    disabled={reviewing}
                    style={{
                      background: '#059669',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <ThumbsUp size={14} /> Duyệt Đơn
                  </button>

                  <button
                    onClick={() => handleReviewAction('REQUIRE_SUPPLEMENT')}
                    disabled={reviewing}
                    style={{
                      background: '#d97706',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <AlertCircle size={14} /> Cần Bổ Sung
                  </button>

                  <button
                    onClick={() => handleReviewAction('REJECT')}
                    disabled={reviewing}
                    style={{
                      background: '#e11d48',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <ThumbsDown size={14} /> Từ Chối
                  </button>
                </div>

                {/* HÀNG NÚT BỔ SUNG: GHI ĐÈ (OVERRIDE) & DỪNG XỬ LÝ (STOP) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={() => handleReviewAction('OVERRIDE', 'APPROVED')}
                    disabled={reviewing}
                    title="Ghi đè phán quyết hệ thống và cưỡng chế phê duyệt có lý do giải trình"
                    style={{
                      background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    <Shield size={14} /> Ghi Đè (Override)
                  </button>

                  <button
                    onClick={() => handleReviewAction('STOP')}
                    disabled={reviewing}
                    title="Dừng toàn bộ quy trình tự động hóa của hồ sơ này (STOPPED)"
                    style={{
                      background: '#475569',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <StopCircle size={14} /> Dừng Xử Lý (Stop)
                  </button>
                </div>

                {/* REVIEWER FEEDBACK PANEL (ADAPTIVE ESCALATION THRESHOLD SPRINT 2) */}
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: '#0a0e17',
                  borderRadius: '8px',
                  border: '1px solid #1e293b'
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sliders size={14} color="#f59e0b" /> Phản Hồi Đánh Giá (Adaptive Threshold Feedback)
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 8px 0' }}>
                    Đánh giá quyết định của hệ thống để tự động điều chỉnh ngưỡng tin cậy an toàn [0.65 - 0.90]:
                  </p>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ghi chú phản hồi (tùy chọn)..."
                    value={feedbackNote}
                    onChange={e => setFeedbackNote(e.target.value)}
                    style={{ fontSize: '0.74rem', padding: '6px 8px', marginBottom: '8px' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={submittingFeedback}
                      onClick={() => handleReviewerFeedback('CORRECT')}
                      style={{
                        background: '#1e293b',
                        color: '#34d399',
                        border: '1px solid #34d39940',
                        borderRadius: '4px',
                        padding: '6px 4px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      title="Quyết định hệ thống hoàn toàn chính xác"
                    >
                      ✓ Đúng Chuẩn
                    </button>
                    <button
                      type="button"
                      disabled={submittingFeedback}
                      onClick={() => handleReviewerFeedback('MISSED_ESCALATION')}
                      style={{
                        background: '#1e293b',
                        color: '#f97316',
                        border: '1px solid #f9731640',
                        borderRadius: '4px',
                        padding: '6px 4px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      title="Đáng lẽ phải leo thang người duyệt nhưng hệ thống tự duyệt (+0.02 threshold)"
                    >
                      ▲ Sót Leo Thang
                    </button>
                    <button
                      type="button"
                      disabled={submittingFeedback}
                      onClick={() => handleReviewerFeedback('UNNECESSARY_ESCALATION')}
                      style={{
                        background: '#1e293b',
                        color: '#38bdf8',
                        border: '1px solid #38bdf840',
                        borderRadius: '4px',
                        padding: '6px 4px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      title="Đáng lẽ duyệt tự động được nhưng hệ thống lại leo thang thừa (-0.02 threshold)"
                    >
                      ▼ Leo Thang Thừa
                    </button>
                  </div>
                </div>
              </div>

              {/* KHUNG ĐIỀU PHỐI ĐƠN VỊ THỤ LÝ (DEPARTMENT RE-ROUTING) */}
              <div style={{
                background: '#090d16',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={15} color="#38bdf8" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Đơn vị thụ lý:
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>
                    {selectedCase.assignedDepartment || 'Phòng Công tác Sinh viên'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select
                    className="form-input"
                    style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                    value={targetDepartment || selectedCase.assignedDepartment || ''}
                    onChange={e => setTargetDepartment(e.target.value)}
                  >
                    <option value="Phòng Kế hoạch - Tài chính">Phòng Kế hoạch - Tài chính</option>
                    <option value="Phòng Công tác Sinh viên">Phòng Công tác Sinh viên</option>
                    <option value="Phòng Quản lý Đào tạo">Phòng Quản lý Đào tạo</option>
                    <option value="Văn phòng Đoàn - Hội Sinh viên">Văn phòng Đoàn - Hội Sinh viên</option>
                  </select>
                  <button
                    type="button"
                    disabled={reRouting || targetDepartment === selectedCase.assignedDepartment}
                    onClick={() => handleReRouteCase(targetDepartment)}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                    title="Chuyển giao hồ sơ sang phòng ban khác"
                  >
                    {reRouting ? <RefreshCw size={12} className="animate-spin" /> : 'Chuyển'}
                  </button>
                </div>
              </div>

              {selectedCase.status === 'APPROVED' && (
                <div style={{
                  background: 'rgba(5, 150, 105, 0.1)',
                  border: '1px solid rgba(5, 150, 105, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={18} color="#34d399" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399' }}>
                      Quyết định học vụ điện tử đã có hiệu lực
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => window.open(`${API_BASE}/cases/${selectedCase.id}/export-decision?token=${token}`, '_blank')}
                      className="btn-primary shimmer-button"
                      style={{ background: 'linear-gradient(135deg, #059669, #10b981)', fontSize: '0.76rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Printer size={13} /> In / Lưu Quyết Định PDF
                    </button>
                    <button
                      onClick={() => window.open(`/verify?caseId=${selectedCase.id}`, '_blank')}
                      className="btn-secondary"
                      style={{ fontSize: '0.76rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#38bdf8', color: '#38bdf8' }}
                    >
                      <QrCode size={13} /> QR Tra Cứu
                    </button>
                  </div>
                </div>
              )}

              {/* Kênh thảo luận trao đổi trên hồ sơ */}
              <CaseDiscussion caseId={selectedCase.id} token={token} currentUser={user} />
            </div>
          )}

          {/* CỘT 3 (NGOÀI CÙNG BÊN PHẢI): KHUNG MINH CHỨNG KÈM THEO & TRỰC QUAN HÓA */}
          {selectedCase && (
            <div className="card-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Paperclip size={18} color="#38bdf8" /> Minh Chứng Kèm Theo
                </h3>
                <span style={{ fontSize: '0.75rem', background: '#38bdf820', color: '#38bdf8', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                  {selectedCase.evidenceFiles?.length || 0} tệp
                </span>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Xem trước tài liệu minh chứng và kết quả tối ưu nén ảnh Sharp:
              </p>

              {/* Danh sách minh chứng */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '680px', overflowY: 'auto' }}>
                {selectedCase.evidenceFiles && selectedCase.evidenceFiles.length > 0 ? (
                  selectedCase.evidenceFiles.map((f, idx) => {
                    const fileName = f.fileName || f.name || (f.fileUrl ? f.fileUrl.split('/').pop() : `Minh chứng ${idx + 1}`);
                    const isImg = f.fileUrl ? (f.fileUrl.endsWith('.webp') || f.fileUrl.endsWith('.png') || f.fileUrl.endsWith('.jpg') || f.fileUrl.endsWith('.jpeg')) : true;
                    const authToken = localStorage.getItem('cf_token') || localStorage.getItem('token') || '';
                    const fullUrl = f.fileUrl ? `${SERVER_BASE}${f.fileUrl}${f.fileUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(authToken)}` : null;

                    return (
                      <div
                        key={idx}
                        style={{
                          background: '#090d16',
                          border: '1px solid #1e293b',
                          borderRadius: '8px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        {/* Header của từng file */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isImg ? <Image size={15} color="#38bdf8" /> : <FileText size={15} color="#fbbf24" />}
                            {fileName}
                          </span>
                          {f.isOptimized && (
                            <span style={{ fontSize: '0.68rem', background: 'rgba(5, 150, 105, 0.2)', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              ⚡ Sharp WebP
                            </span>
                          )}
                        </div>

                        {/* Image Preview Viewer */}
                        {fullUrl && isImg && (
                          <div 
                            onClick={() => setPreviewModalImg({ url: fullUrl, name: fileName, metadata: f.metadata })}
                            style={{
                              position: 'relative',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              border: '1px solid #334155',
                              background: '#050811',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              cursor: 'pointer',
                              group: 'thumbnail'
                            }}
                            title="Bấm để phóng to xem chi tiết minh chứng"
                          >
                            <img
                              src={fullUrl}
                              alt={fileName}
                              style={{
                                width: '100%',
                                maxHeight: '200px',
                                objectFit: 'contain',
                                display: 'block',
                                transition: 'transform 0.2s ease'
                              }}
                            />
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'rgba(0,0,0,0.35)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: 0,
                              transition: 'opacity 0.2s',
                              color: '#fff',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              gap: '6px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                            >
                              <Maximize2 size={16} /> Phóng to tài liệu
                            </div>
                          </div>
                        )}

                        {/* Metadata & Nén Sharp */}
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-sub)', background: '#0f172a', padding: '8px 10px', borderRadius: '6px' }}>
                          {f.metadata ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Kích thước gốc:</span>
                                <strong>{f.metadata.originalSize}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34d399' }}>
                                <span>Sau nén (Sharp WebP):</span>
                                <strong>{f.metadata.compressedSize} ({f.metadata.savedRatio})</strong>
                              </div>
                              {f.metadata.dimensions && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Độ phân giải:</span>
                                  <span>{f.metadata.dimensions}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Dung lượng:</span>
                              <strong>{f.size || '1.8 MB (Đã tối ưu)'}</strong>
                            </div>
                          )}
                        </div>

                        {/* Link mở file */}
                        {fullUrl && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => setPreviewModalImg({ url: fullUrl, name: fileName, metadata: f.metadata })}
                              className="btn-primary"
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                fontSize: '0.76rem',
                                justifyContent: 'center'
                              }}
                            >
                              <Eye size={13} /> Xem Trực Tiếp
                            </button>
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-secondary"
                              style={{
                                padding: '6px 10px',
                                fontSize: '0.76rem',
                                justifyContent: 'center',
                                textDecoration: 'none',
                                color: '#38bdf8'
                              }}
                              title="Mở tab mới"
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '36px 16px',
                    background: '#090d16',
                    borderRadius: '8px',
                    border: '1px dashed #334155',
                    color: 'var(--text-sub)'
                  }}>
                    <Paperclip size={24} style={{ opacity: 0.4, marginBottom: '6px' }} />
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>Không có minh chứng</p>
                    <p style={{ fontSize: '0.74rem', marginTop: '4px' }}>Hồ sơ này sinh viên chưa đính kèm tệp tài liệu.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reviewer_audit' && (
        <AuditTrailViewer
          audits={audits}
          token={token}
          onRefresh={fetchReviewerData}
          loading={loading}
        />
      )}

      {/* LIGHTBOX MODAL PHÓNG TO MINH CHỨNG TRỰC TIẾP */}
      {previewModalImg && (
        <div 
          onClick={() => setPreviewModalImg(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '900px',
              maxHeight: '90vh',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 18px',
              background: '#090d16',
              borderBottom: '1px solid #1e293b'
            }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Image size={16} color="#38bdf8" /> {previewModalImg.name}
                </h4>
                {previewModalImg.metadata && (
                  <span style={{ fontSize: '0.74rem', color: '#34d399' }}>
                    ⚡ Nén Sharp WebP: {previewModalImg.metadata.compressedSize} (Tiết kiệm {previewModalImg.metadata.savedRatio}) • {previewModalImg.metadata.dimensions}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setPreviewModalImg(null)}
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
              >
                <X size={16} /> Đóng
              </button>
            </div>

            <div style={{ padding: '16px', background: '#050811', overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
              <img 
                src={previewModalImg.url} 
                alt={previewModalImg.name}
                style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: '4px' }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default ReviewerPortal;
