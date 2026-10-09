import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  PlusCircle, RefreshCw, Paperclip, UploadCloud, Sparkles,
  CheckCircle2, AlertTriangle, Printer, Send, Building2, AlertCircle, QrCode
} from 'lucide-react';
import { API_BASE, SERVER_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { renderSlaBadge } from '../../utils/formatters';
import CaseDiscussion from '../../components/discussion/CaseDiscussion';
import AuditTrailViewer from '../../components/audit/AuditTrailViewer';
import PageSkeleton from '../../components/common/PageSkeleton';
import { openSafeWindow, safeImageUrl } from '../../utils/security';

const REVIEW_RESULT_LABELS = {
  RULE_STANDARD_VERIFIED: 'Thông tin hồ sơ đã được kiểm tra',
  RULE_TUITION_DISCOUNT_STANDARD_APPLICATION: 'Hồ sơ có đủ thông tin cơ bản',
  RULE_INSUFFICIENT_INFORMATION: 'Cần bổ sung thêm thông tin',
  RULE_GENERAL_INQUIRY: 'Yêu cầu của bạn đã được ghi nhận',
  RULE_TUITION_DISCOUNT_INSUFFICIENT_DETAILS: 'Cần bổ sung thêm thông tin',
  RULE_TUITION_DISCOUNT_INSUFFICIENT_INFO: 'Cần bổ sung thêm thông tin',
  RULE_INCOMPLETE_CONTENT: 'Nội dung cần được bổ sung'
};

const getReviewResultLabel = (result) => REVIEW_RESULT_LABELS[result] || 'Thông tin hồ sơ đã được kiểm tra';

const StudentPortal = ({ activeTab, setActiveTab, caseToOpen, onCaseOpened }) => {
  const { token, user } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('TUITION_DISCOUNT');
  const [priority, setPriority] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedEvidence, setUploadedEvidence] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [ocrData, setOcrData] = useState(null);
  const [ocrScanning, setOcrScanning] = useState(false);

  const [supplementingCaseId, setSupplementingCaseId] = useState(null);
  const [supplementNote, setSupplementNote] = useState('');
  const [supplementFiles, setSupplementFiles] = useState([]);
  const [submittingSupplement, setSubmittingSupplement] = useState(false);

  const [myCases, setMyCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [highlightedCaseId, setHighlightedCaseId] = useState(null);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const casesRes = await axios.get(`${API_BASE}/cases/my-cases`, { headers: { Authorization: `Bearer ${token}` } });

      if (casesRes.data?.success) setMyCases(casesRes.data.data.cases);
    } catch (err) {
      console.error('Lỗi tải dữ liệu sinh viên:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The default tab is the submission form; defer the case-list request
    // until the user actually opens it.
    if (token && activeTab === 'student_cases') fetchStudentData();
  }, [token, activeTab]);

  useEffect(() => {
    if (!caseToOpen || activeTab !== 'student_cases' || loading) return;
    const target = document.getElementById(`student-case-${caseToOpen}`);
    if (!target) return;
    setHighlightedCaseId(caseToOpen);
    requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    const timer = window.setTimeout(() => setHighlightedCaseId(null), 2400);
    onCaseOpened?.();
    return () => window.clearTimeout(timer);
  }, [caseToOpen, activeTab, loading, myCases, onCaseOpened]);

  useEffect(() => {
    if (!token) return undefined;
    const socket = new WebSocket(`${SERVER_BASE.replace(/^http/, 'ws')}/ws/cases`);
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data);
        if (event.type !== 'case_updated' || event.case?.studentId !== user?.id) return;
        setMyCases(current => current.map(item => item.id === event.case.id ? event.case : item));
      } catch { /* Ignore malformed realtime payloads. */ }
    };
    return () => socket.close();
  }, [token, user?.id]);

  const handleOcrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError('');
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Dung lượng file vượt quá giới hạn 10MB!');
      return;
    }

    const formData = new FormData();
    formData.append('evidence', file);

    setOcrScanning(true);
    setUploadingFile(true);
    try {
      const res = await axios.post(`${API_BASE}/upload/evidence-ocr`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data?.success) {
        const { file: fileData, ocr } = res.data.data;
        setUploadedEvidence(prev => [...prev, fileData]);
        if (ocr && ocr.data) {
          setOcrData(ocr.data);
          if (ocr.data.suggestedTitle) {
            setTitle(ocr.data.suggestedTitle);
          }
          if (ocr.data.suggestedCategory) {
            setCategory(ocr.data.suggestedCategory);
          }
          if (ocr.data.suggestedDescription) {
            setDescription(ocr.data.suggestedDescription);
          }
          setToastMessage({ type: 'success', text: `✨ Đã đọc tài liệu và điền sẵn một số thông tin: ${ocr.data.documentType}` });
        }
      }
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Không thể đọc thông tin từ tài liệu. Bạn vẫn có thể tải tệp lên theo cách thông thường.');
    } finally {
      setOcrScanning(false);
      setUploadingFile(false);
    }
  };

  const handleFileUpload = async (e, isSupplement = false) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError('');
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Dung lượng file vượt quá giới hạn 10MB!');
      return;
    }

    const formData = new FormData();
    formData.append('evidence', file);

    setUploadingFile(true);
    try {
      const res = await axios.post(`${API_BASE}/upload/evidence`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data?.success) {
        if (isSupplement) {
          setSupplementFiles(prev => [...prev, res.data.data]);
        } else {
          setUploadedEvidence(prev => [...prev, res.data.data]);
        }
      }
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Tải file thất bại!');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmitCase = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setToastMessage(null);

    try {
      const res = await axios.post(`${API_BASE}/cases`, {
        title,
        category,
        priority,
        description,
        evidenceFiles: uploadedEvidence
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        setToastMessage({ type: 'success', text: `Đã nộp hồ sơ #${res.data.data.case.id} thành công!` });
        setTitle('');
        setDescription('');
        setUploadedEvidence([]);
        fetchStudentData();
        setActiveTab('student_cases');
      }
    } catch (err) {
      setToastMessage({ type: 'error', text: err.response?.data?.message || 'Gửi hồ sơ thất bại!' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendSupplement = async (caseId) => {
    setSubmittingSupplement(true);
    try {
      const res = await axios.post(`${API_BASE}/cases/${caseId}/supplement`, {
        additionalDescription: supplementNote,
        newEvidenceFiles: supplementFiles
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        setToastMessage({ type: 'success', text: `Đã gửi bổ sung hồ sơ #${caseId} để duyệt lại thành công!` });
        setSupplementingCaseId(null);
        setSupplementNote('');
        setSupplementFiles([]);
        fetchStudentData();
      }
    } catch (err) {
      setToastMessage({ type: 'error', text: err.response?.data?.message || 'Gửi bổ sung thất bại!' });
    } finally {
      setSubmittingSupplement(false);
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'SUBMITTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8' }}>Đã gửi (Chờ duyệt)</span>;
      case 'UNDER_REVIEW':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(217, 119, 6, 0.15)', color: '#fbbf24' }}>Đang thẩm định</span>;
      case 'APPROVED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(5, 150, 105, 0.15)', color: '#34d399' }}>Đã chấp thuận</span>;
      case 'REJECTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(225, 29, 72, 0.15)', color: '#f87171' }}>Đã từ chối</span>;
      case 'REQUIRES_SUPPLEMENT':
      case 'INFO_REQUESTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}>Cần bổ sung hồ sơ</span>;
      case 'RESUBMITTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }}>Đã bổ sung (Chờ duyệt lại)</span>;
      default:
        return <span>{status}</span>;
    }
  };

  if (loading && myCases.length === 0) {
    return <PageSkeleton variant="portal" label="Đang tải hồ sơ sinh viên" />;
  }

  return (
    <div className="portal-content portal-content--student" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {toastMessage && (
        <div style={{
          background: toastMessage.type === 'success' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(225, 29, 72, 0.15)',
          border: `1px solid ${toastMessage.type === 'success' ? 'rgba(5, 150, 105, 0.3)' : 'rgba(225, 29, 72, 0.3)'}`,
          borderRadius: '8px',
          padding: '12px 16px',
          color: toastMessage.type === 'success' ? '#34d399' : '#f87171',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {activeTab === 'student_submit' && (
        <div className="card-panel" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={20} color="var(--accent-primary)" /> Khởi Tạo Hồ Sơ Sinh Viên
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
            Điền các thông tin đề nghị và đính kèm giấy tờ chứng minh:
          </p>

          <form onSubmit={handleSubmitCase} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Tiêu đề hồ sơ *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Ví dụ: Đơn xin miễn giảm học phí học kỳ 1 năm học 2026-2027..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Loại yêu cầu
                </label>
                <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="TUITION_DISCOUNT">Miễn giảm học phí</option>
                  <option value="COMMUNITY_SERVICE">Điểm rèn luyện</option>
                  <option value="SCHOLARSHIP">Học bổng khuyến khích</option>
                  <option value="GRADE_APPEAL">Phúc khảo điểm</option>
                  <option value="GENERAL">Khác</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Độ ưu tiên
                </label>
                <select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="HIGH">Khẩn cấp (Cao)</option>
                  <option value="MEDIUM">Bình thường (Trung bình)</option>
                  <option value="LOW">Thấp</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Tài liệu minh chứng
              </label>
              <div style={{
                border: '1px dashed var(--border-color)',
                borderRadius: '8px',
                padding: '14px',
                background: '#0f172a',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="file"
                      id="student-ocr-upload"
                      accept="image/*,application/pdf"
                      onChange={handleOcrUpload}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="student-ocr-upload" className="btn-primary shimmer-button" style={{ cursor: 'pointer', fontSize: '0.82rem', padding: '6px 14px', background: 'linear-gradient(135deg, #4f46e5, #0284c7)' }}>
                      <Sparkles size={15} />
                      <span>{ocrScanning ? 'Đang đọc thông tin từ tài liệu...' : '✨ Đọc tài liệu & điền thông tin'}</span>
                    </label>

                    <input
                      type="file"
                      id="student-evidence-upload"
                      accept="image/*,application/pdf"
                      onChange={e => handleFileUpload(e, false)}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="student-evidence-upload" className="btn-secondary" style={{ cursor: 'pointer', fontSize: '0.82rem', padding: '6px 12px' }}>
                      <UploadCloud size={15} />
                      <span>{uploadingFile && !ocrScanning ? 'Đang tải file...' : 'Tải file thường'}</span>
                    </label>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-sub)' }}>Định dạng JPG, PNG, WEBP, PDF (Tối đa 10MB)</span>
                </div>

                {/* AI OCR RESULT PREVIEW BANNER */}
                {ocrData && (
                  <div style={{
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={14} color="#38bdf8" /> Thông tin đọc từ tài liệu: {ocrData.documentType}
                      </span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        Mức độ rõ ràng: {Math.round((ocrData.confidenceScore || 0.96) * 100)}% • Kiểm tra chỉnh sửa: {(ocrData.tamperRisk || 'LOW') === 'LOW' ? 'Không phát hiện bất thường' : 'Cần kiểm tra thêm'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.76rem', color: 'var(--text-sub)', marginTop: '4px' }}>
                      <div>• Sinh viên: <strong style={{ color: '#fff' }}>{ocrData.studentName}</strong> ({ocrData.studentCode})</div>
                      <div>• Đơn vị cấp: <strong style={{ color: '#fff' }}>{ocrData.issuingAuthority}</strong></div>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>
                      ℹ️ Hệ thống đã điền sẵn tiêu đề, loại hồ sơ và nội dung dựa trên tài liệu. Bạn hãy kiểm tra và chỉnh sửa nếu cần.
                    </p>
                  </div>
                )}

                {uploadError && <p style={{ fontSize: '0.78rem', color: '#f87171' }}>{uploadError}</p>}

                {uploadedEvidence.map((file, idx) => (
                  <div key={idx} style={{ background: '#1e293b', padding: '8px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Paperclip size={14} color="#38bdf8" />
                      <span>{file.metadata?.originalName || file.fileName}</span>
                    </div>
                    {file.metadata?.isOptimized && (
                      <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600, background: 'rgba(5, 150, 105, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                        Đã giảm dung lượng tệp (-{file.metadata.savings})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Nội dung chi tiết *
              </label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Trình bày lý do, hoàn cảnh và nguyện vọng cụ thể của bạn..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={submitting || uploadingFile} className="btn-primary" style={{ height: '42px', marginTop: '6px' }}>
              <Send size={16} />
              <span>{submitting ? 'Đang gửi hồ sơ...' : 'Nộp Hồ Sơ Xuống Hệ Thống'}</span>
            </button>
          </form>
        </div>
      )}

      {activeTab === 'student_cases' && (
        <div className="card-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Hồ Sơ Của Bạn ({myCases.length})</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Theo dõi tiến độ duyệt hồ sơ của cá nhân bạn</p>
            </div>
            <button onClick={fetchStudentData} className="btn-secondary">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {myCases.map(c => {
              const isNeedingSupplement = c.status === 'REQUIRES_SUPPLEMENT' || c.status === 'INFO_REQUESTED';
              const isSupplementOpen = supplementingCaseId === c.id;

              return (
                <div id={`student-case-${c.id}`} key={c.id} style={{
                  background: '#0f172a',
                  border: `1px solid ${highlightedCaseId === c.id ? '#60a5fa' : (isNeedingSupplement ? 'rgba(245, 158, 11, 0.5)' : 'var(--border-color)')}`,
                  borderRadius: '8px',
                  padding: '16px',
                  boxShadow: highlightedCaseId === c.id ? '0 0 0 4px rgba(96, 165, 250, 0.16)' : 'none',
                  transition: 'border-color 0.25s, box-shadow 0.25s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: '#818cf8', fontWeight: 700 }}>{c.id}</span>
                      {renderStatusBadge(c.status)}
                      {renderSlaBadge(c)}
                      <span style={{ fontSize: '0.68rem', background: '#334155', color: '#93c5fd', padding: '2px 7px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Building2 size={11} /> {c.assignedDepartment || 'Phòng Công tác Sinh viên'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                      Ngày nộp: {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>{c.title}</h3>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '12px' }}>{c.description}</p>

                  {isNeedingSupplement && (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      borderRadius: '8px',
                      padding: '14px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontWeight: 700, fontSize: '0.88rem' }}>
                        <AlertCircle size={18} />
                        <span>Hồ sơ cần bổ sung giấy tờ để thẩm định lại!</span>
                      </div>
                      <p style={{ fontSize: '0.84rem', color: 'var(--text-main)', marginTop: '4px' }}>
                        <strong>Yêu cầu từ Thẩm định viên:</strong> <em>"{c.reviewResult?.reason || 'Vui lòng bổ sung giấy tờ rõ ràng hơn.'}"</em>
                      </p>

                      {!isSupplementOpen ? (
                        <button
                          onClick={() => { setSupplementingCaseId(c.id); setSupplementNote(''); setSupplementFiles([]); }}
                          className="btn-primary"
                          style={{ marginTop: '10px', background: '#d97706', fontSize: '0.82rem', padding: '6px 14px' }}
                        >
                          <PlusCircle size={14} /> Bổ Sung Giấy Tờ & Gửi Duyệt Lại
                        </button>
                      ) : (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed rgba(245, 158, 11, 0.3)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            Ghi chú giải trình bổ sung:
                          </label>
                          <textarea
                            className="form-input"
                            rows={2}
                            placeholder="Ví dụ: Đã bổ sung bản scan dấu mộc rõ ràng..."
                            value={supplementNote}
                            onChange={e => setSupplementNote(e.target.value)}
                          />

                          <div>
                            <input
                              type="file"
                              id={`supplement-upload-${c.id}`}
                              accept="image/*,application/pdf"
                              onChange={e => handleFileUpload(e, true)}
                              style={{ display: 'none' }}
                            />
                            <label htmlFor={`supplement-upload-${c.id}`} className="btn-secondary" style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '5px 10px' }}>
                              <UploadCloud size={14} /> {uploadingFile ? 'Đang nén file...' : 'Tải thêm minh chứng bổ sung'}
                            </label>
                          </div>

                          {supplementFiles.map((f, i) => (
                            <div key={i} style={{ fontSize: '0.78rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Paperclip size={12} /> {f.metadata?.originalName || f.fileName}
                            </div>
                          ))}

                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                            <button
                              onClick={() => handleSendSupplement(c.id)}
                              disabled={submittingSupplement || uploadingFile}
                              className="btn-primary"
                              style={{ background: '#059669', fontSize: '0.82rem', padding: '6px 14px' }}
                            >
                              <Send size={14} /> Gửi Bổ Sung Để Duyệt Lại
                            </button>
                            <button
                              onClick={() => setSupplementingCaseId(null)}
                              className="btn-secondary"
                              style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {c.reviewResult && !isNeedingSupplement && (
                    <div style={{
                      background: c.status === 'APPROVED' ? 'linear-gradient(135deg, rgba(5, 150, 105, 0.15), rgba(16, 185, 129, 0.08))' : 'linear-gradient(135deg, rgba(225, 29, 72, 0.15), rgba(244, 63, 94, 0.08))',
                      border: `1px solid ${c.status === 'APPROVED' ? 'rgba(5, 150, 105, 0.35)' : 'rgba(225, 29, 72, 0.35)'}`,
                      borderRadius: '10px',
                      padding: '14px 16px',
                      marginBottom: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img
                            src={safeImageUrl(c.reviewResult.reviewerAvatar, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150')}
                            alt="Reviewer"
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${c.status === 'APPROVED' ? '#34d399' : '#f87171'}` }}
                          />
                          <div>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: c.status === 'APPROVED' ? '#34d399' : '#f87171' }}>
                              {c.status === 'APPROVED' ? '✓ Đã phê duyệt bởi: ' : '✗ Đã từ chối bởi: '}
                              <strong>{c.reviewResult.reviewerName || 'Cán Bộ Thẩm Định'}</strong>
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)', display: 'block' }}>
                              {c.reviewResult.reviewerDepartment || 'Ban Thẩm Định Học Vụ'} • {c.reviewResult.reviewedAt ? new Date(c.reviewResult.reviewedAt).toLocaleString('vi-VN') : ''}
                            </span>
                          </div>
                        </div>

                        {c.status === 'APPROVED' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => openSafeWindow(`${API_BASE}/cases/${encodeURIComponent(c.id)}/export-decision`)}
                              className="btn-primary shimmer-button"
                              style={{ background: 'linear-gradient(135deg, #059669, #10b981)', fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Printer size={13} />
                              <span>In / Lưu Quyết Định PDF</span>
                            </button>
                            <button
                              onClick={() => openSafeWindow(`/verify?caseId=${encodeURIComponent(c.id)}`)}
                              className="btn-secondary"
                              style={{ fontSize: '0.78rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#38bdf8', color: '#38bdf8' }}
                              title="Xem trang chứng thực công khai QR code"
                            >
                              <QrCode size={13} />
                              <span>Mã QR Xác Thực</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#e2e8f0', background: 'rgba(9, 13, 26, 0.5)', padding: '8px 12px', borderRadius: '6px' }}>
                        <span style={{ color: 'var(--text-sub)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>Đánh giá của cán bộ:</span>
                        <p style={{ margin: '2px 0 0 0', fontStyle: 'italic' }}>"{c.reviewResult.reason}"</p>
                      </div>
                    </div>
                  )}

                  {c.aiExtraction && (
                    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '8px 12px', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={13} /> Kiểm tra ban đầu: <strong>{getReviewResultLabel(c.aiExtraction.policyRuleMatch)}</strong>
                      </span>
                      <span style={{ color: '#34d399' }}>Mức độ khớp thông tin: {Math.round((c.aiExtraction.confidence || 0.95) * 100)}%</span>
                    </div>
                  )}

                  {/* Kênh thảo luận trực tiếp trên từng hồ sơ */}
                  <CaseDiscussion caseId={c.id} token={token} currentUser={user} />
                </div>
              );
            })}

            {myCases.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sub)' }}>
                Bạn chưa nộp hồ sơ nào. Hãy bấm <strong>Nộp Hồ Sơ Mới</strong> để tạo đơn.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'student_history' && (
        <AuditTrailViewer
          token={token}
          onRefresh={fetchStudentData}
          loading={loading}
          title="Lịch Sử Hoạt Động Của Bạn (Theo Ngày)"
          subtitle="Theo dõi chi tiết các thao tác đã thực hiện trên tài khoản theo từng mốc thời gian"
          showRoleFilter={false}
          isStudentView={true}
        />
      )}
    </div>
  );
};


export default StudentPortal;
