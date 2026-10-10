import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  PlusCircle, RefreshCw, Paperclip, UploadCloud, Sparkles,
  CheckCircle2, Printer, Send, Building2, AlertCircle, QrCode,
  MapPin, Shield, User, FileText, Check, AlertOctagon
} from 'lucide-react';
import { API_BASE, SERVER_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { renderSlaBadge } from '../../utils/formatters';
import CaseDiscussion from '../../components/discussion/CaseDiscussion';
import AuditTrailViewer from '../../components/audit/AuditTrailViewer';
import PageSkeleton from '../../components/common/PageSkeleton';
import { openSafeWindow, safeImageUrl } from '../../utils/security';

const StudentPortal = ({ activeTab, setActiveTab, caseToOpen, onCaseOpened }) => {
  const { token, user } = useAuth();
  
  // NVQS Domain state
  const [addressType, setAddressType] = useState('PERMANENT'); // PERMANENT | TEMPORARY
  const [rawAddress, setRawAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  
  // Normalization preview state
  const [normalizedPreview, setNormalizedPreview] = useState(null);
  const [normalizing, setNormalizing] = useState(false);
  
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedEvidence, setUploadedEvidence] = useState([]);
  const [uploadError, setUploadError] = useState('');

  const [supplementingCaseId, setSupplementingCaseId] = useState(null);
  const [supplementNote, setSupplementNote] = useState('');
  const [supplementFiles, setSupplementFiles] = useState([]);
  const [submittingSupplement, setSubmittingSupplement] = useState(false);

  const [myCases, setMyCases] = useState([]);
  const [sisRecord, setSisRecord] = useState(null);
  const [sisLoading, setSisLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [caseLoadError, setCaseLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [highlightedCaseId, setHighlightedCaseId] = useState(null);

  useEffect(() => {
    if (!token || !user?.id) return undefined;
    let cancelled = false;
    setSisLoading(true);
    axios.get(`${API_BASE}/sis/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!cancelled) setSisRecord(res.data?.data?.record || null); })
      .catch(() => { if (!cancelled) setSisRecord(null); })
      .finally(() => { if (!cancelled) setSisLoading(false); });
    return () => { cancelled = true; };
  }, [token, user?.id]);

  // Debounced address normalization preview
  useEffect(() => {
    if (!rawAddress || rawAddress.trim().length < 5) {
      setNormalizedPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      setNormalizing(true);
      try {
        const res = await axios.post(`${API_BASE}/ai/normalize-address`, {
          rawAddress: rawAddress,
          addressType: addressType
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.success) {
          setNormalizedPreview(res.data.data);
        }
      } catch (err) {
        // Fallback simple preview
        console.warn('Live normalize preview failed, using local parser:', err);
      } finally {
        setNormalizing(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [rawAddress, addressType, token]);

  const fetchStudentData = async () => {
    setLoading(true);
    setCaseLoadError('');
    try {
      const casesRes = await axios.get(`${API_BASE}/cases/my-cases`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 12000
      });

      if (casesRes.data?.success) {
        setMyCases(casesRes.data.data.cases);
      } else {
        setCaseLoadError(casesRes.data?.message || 'Không thể tải danh sách hồ sơ.');
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu sinh viên:', err);
      setCaseLoadError(err.code === 'ECONNABORTED'
        ? 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.'
        : (err.response?.data?.message || 'Không thể kết nối đến máy chủ.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && (activeTab === 'student_cases' || activeTab === 'student_history')) fetchStudentData();
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
    if (!token || activeTab !== 'student_cases') return undefined;
    const socket = new WebSocket(`${SERVER_BASE.replace(/^http/, 'ws')}/ws/cases`);
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data);
        if (event.type !== 'case_updated' || event.case?.studentId !== user?.id) return;
        setMyCases(current => current.map(item => item.id === event.case.id ? event.case : item));
      } catch { /* Ignore */ }
    };
    return () => socket.close();
  }, [token, user?.id, activeTab]);

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
    if (!rawAddress.trim()) {
      setToastMessage({ type: 'error', text: 'Vui lòng nhập địa chỉ thường trú của bạn!' });
      return;
    }
    setSubmitting(true);
    setToastMessage(null);

    try {
      const res = await axios.post(`${API_BASE}/cases`, {
        title: 'Yêu cầu cấp Giấy xác nhận sinh viên phục vụ tạm hoãn NVQS',
        category: 'MILITARY_SERVICE_CONFIRMATION',
        priority: 'MEDIUM',
        description: rawAddress,
        rawAddress: rawAddress,
        addressType: addressType,
        notes: notes,
        evidenceFiles: uploadedEvidence
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        const createdCase = res.data.data.case || res.data.data;
        const isAuto = createdCase.status === 'APPROVED';
        setToastMessage({
          type: 'success',
          text: isAuto
            ? `🎉 Hồ sơ #${createdCase.id} đã được tự động duyệt thành công! Bạn có thể xem và in Giấy xác nhận ngay.`
            : `Đã gửi yêu cầu #${createdCase.id} thành công! Hệ thống đang chuyển cán bộ thẩm định.`
        });
        setRawAddress('');
        setNotes('');
        setUploadedEvidence([]);
        setNormalizedPreview(null);
        fetchStudentData();
        setActiveTab('student_cases');
      }
    } catch (err) {
      setToastMessage({ type: 'error', text: err.response?.data?.message || 'Gửi yêu cầu thất bại!' });
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
        return <span className="student-case__status student-case__status--submitted">Đã tiếp nhận</span>;
      case 'RESUBMITTED':
        return <span className="student-case__status student-case__status--submitted">Đã gửi thông tin bổ sung</span>;
      case 'UNDER_REVIEW':
        return <span className="student-case__status student-case__status--review">Đang được xem xét</span>;
      case 'APPROVED':
        return <span className="student-case__status student-case__status--approved">Đã xử lý</span>;
      case 'REJECTED':
        return <span className="student-case__status student-case__status--rejected">Không được chấp thuận</span>;
      case 'REQUIRES_SUPPLEMENT':
      case 'INFO_REQUESTED':
        return <span className="student-case__status student-case__status--supplement">Cần bổ sung thông tin</span>;
      default:
        return <span>{status}</span>;
    }
  };

  if (activeTab === 'student_cases' && loading && myCases.length === 0) {
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

      {/* TAB 1: FORM NỘP ĐƠN NVQS */}
      {activeTab === 'student_submit' && (
        <div className="card-panel" style={{ padding: '28px', maxWidth: '880px', margin: '0 auto', width: '100%' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '20px', padding: '4px 12px', fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700, marginBottom: '8px' }}>
              <Shield size={14} /> Nộp giấy tờ trực tuyến
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.3, margin: '4px 0' }}>
              Xin giấy xác nhận sinh viên
            </h1>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#94a3b8', margin: 0 }}>
              Phục vụ hồ sơ nghĩa vụ quân sự
            </h2>
          </div>

          <form onSubmit={handleSubmitCase} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Student-facing copy of the canonical SIS row. */}
            <div style={{ background: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#38bdf8', fontWeight: 700, fontSize: '0.86rem' }}>
                <User size={16} /> Thông tin sinh viên nhà trường đang lưu
              </div>
              {sisLoading ? <p>Đang tải thông tin sinh viên...</p> : sisRecord ? <>
                {sisRecord.source === 'INTERNAL_SIS_DEMO' && <p role="note" style={{ color: '#fbbf24', fontSize: '0.78rem' }}>Đây là thông tin mẫu để minh họa, không phải hồ sơ thật do nhà trường xác nhận.</p>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '0.84rem' }}>
                  <div><span>Họ và tên</span><br /><strong>{sisRecord.fullName || 'Chưa có thông tin'}</strong></div>
                  <div><span>Mã sinh viên</span><br /><strong>{sisRecord.studentCode || 'Chưa có thông tin'}</strong></div>
                  <div><span>Khoa</span><br /><strong>{sisRecord.faculty || 'Chưa có thông tin'}</strong></div>
                  <div><span>Tình trạng học</span><br /><strong>{sisRecord.academicStatus === 'ACTIVE' ? 'Đang học' : sisRecord.academicStatus === 'SUSPENDED' ? 'Tạm dừng học' : sisRecord.academicStatus === 'WITHDRAWN' ? 'Đã thôi học' : sisRecord.academicStatus === 'GRADUATED' ? 'Đã tốt nghiệp' : sisRecord.academicStatus === 'LEAVE_OF_ABSENCE' ? 'Đang bảo lưu' : 'Chưa có thông tin'}</strong></div>
                  <div><span>Thời gian học</span><br /><strong>{sisRecord.courseStartDate || 'Chưa có thông tin'} - {sisRecord.courseEndDate || 'Chưa có thông tin'}</strong></div>
                  <div><span>Đang tham gia học kỳ hiện tại</span><br /><strong>{sisRecord.currentTermActive === true ? 'Rồi' : sisRecord.currentTermActive === false ? 'Chưa' : 'Chưa rõ'}</strong></div>
                  <div><span>Đã có thời khóa biểu</span><br /><strong>{sisRecord.hasCurrentSchedule === true ? 'Rồi' : sisRecord.hasCurrentSchedule === false ? 'Chưa' : 'Chưa rõ'}</strong></div>
                  <div><span>Tình trạng hồ sơ</span><br /><strong>{sisRecord.recordStatus === 'ACTIVE' ? 'Đang sử dụng' : sisRecord.recordStatus === 'SUSPENDED' ? 'Tạm khóa' : 'Chưa rõ'}</strong></div>
                  <div style={{ gridColumn: '1 / -1' }}><span>Địa chỉ thường trú nhà trường đang lưu</span><br /><strong>{sisRecord.registeredPermanentAddress || 'Chưa có thông tin'}</strong></div>
                </div>
              </> : <p role="status">Chưa có thông tin sinh viên do nhà trường cung cấp. Vui lòng liên hệ nhà trường để cập nhật.</p>}
            </div>

            {/* KHỐI 2: MỤC ĐÍCH YÊU CẦU (READ-ONLY) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: '#e2e8f0' }}>
                Bạn cần giấy xác nhận này để làm gì?
              </label>
              <input
                type="text"
                className="form-input"
                value="Xác nhận sinh viên để bổ sung vào hồ sơ nghĩa vụ quân sự"
                readOnly
                style={{ background: '#1e293b', color: '#cbd5e1', cursor: 'not-allowed' }}
              />
            </div>

            {/* KHỐI 3: THÔNG TIN CƯ TRÚ & ĐỊA CHỈ THƯỜNG TRÚ */}
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '10px',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={16} /> Địa chỉ thường trú
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  * Nhập địa chỉ thường trú nhà trường đang lưu
                </span>
              </div>

              {/* LỰA CHỌN LOẠI ĐỊA CHỈ */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                  Bạn muốn gửi loại địa chỉ nào?
                </label>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="addressType"
                      value="PERMANENT"
                      checked={addressType === 'PERMANENT'}
                      onChange={() => setAddressType('PERMANENT')}
                    />
                    <strong style={{ color: '#38bdf8' }}>Thường trú</strong>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="addressType"
                      value="TEMPORARY"
                      checked={addressType === 'TEMPORARY'}
                      onChange={() => setAddressType('TEMPORARY')}
                    />
                    <span style={{ color: '#fbbf24' }}>Tạm trú</span>
                  </label>
                </div>
                {addressType === 'TEMPORARY' && (
                  <p style={{ fontSize: '0.76rem', color: '#fbbf24', marginTop: '6px' }}>Nếu bạn khai địa chỉ tạm trú, nhân viên sẽ kiểm tra yêu cầu của bạn.</p>
                )}
              </div>

              {/* Ô NHẬP ĐỊA CHỈ TỰ DO */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                  Địa chỉ thường trú *</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Ví dụ: 12/4 Nguyễn Đình Chiểu, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh"
                  value={rawAddress}
                  onChange={e => setRawAddress(e.target.value)}
                  required
                  style={{ fontSize: '0.9rem', lineHeight: 1.5 }}
                />
                <span style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                  Ghi số nhà, tên đường hoặc thôn/ấp, phường/xã, tỉnh/thành phố. Nếu có quận/huyện, bạn có thể ghi thêm.
                </span>
              </div>

              {/* LIVE PREVIEW & KIỂM TRA TÍNH ĐẦY ĐỦ CỦA AI */}
              {rawAddress.trim().length >= 5 && (
                <div style={{
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} /> Kiểm tra địa chỉ:
                    </span>
                    {normalizing && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Đang kiểm tra địa chỉ...</span>}
                  </div>

                  {normalizedPreview ? (
                    <div>
                      <div style={{ fontSize: '0.84rem', color: '#f8fafc', fontWeight: 600 }}>
                        {normalizedPreview.normalizedAddress || rawAddress}
                      </div>

                      {/* Cảnh báo thiếu trường */}
                      {normalizedPreview.missingFields && normalizedPreview.missingFields.length > 0 ? (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: '#fb7185', fontSize: '0.78rem' }}>
                          <AlertOctagon size={14} />
                          <span>
                            <strong>Cần bổ sung:</strong> Thiếu{' '}
                            {normalizedPreview.missingFields.map(f => {
                              if (f === 'wardCommune') return 'Phường/Xã';
                              if (f === 'provinceCity') return 'Tỉnh/Thành phố';
                              if (f === 'street') return 'Tên đường/Thôn ấp';
                              if (f === 'houseNumber') return 'Số nhà';
                              return f;
                            }).join(', ')}. Bạn hãy bổ sung thông tin còn thiếu.
                          </span>
                        </div>
                      ) : (
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '0.76rem' }}>
                          <Check size={14} />
                          <span>Địa chỉ đã có số nhà hoặc tên đường, phường/xã và tỉnh/thành phố.</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      Đang phân tích cấu trúc địa chỉ...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* KHỐI 4: GHI CHÚ / THÔNG TIN LIÊN HỆ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                  Số điện thoại để nhà trường liên hệ
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="0912 345 678"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                  Ghi chú (không bắt buộc)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Cần nộp trước đợt gọi khám sức khỏe NVQS tháng 11..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* KHỐI 5: TÀI LIỆU MINH CHỨNG (TÙY CHỌN) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                Giấy tờ liên quan (không bắt buộc)
              </label>
              <div style={{
                border: '1px dashed rgba(148, 163, 184, 0.25)',
                borderRadius: '8px',
                padding: '12px',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="file"
                    id="student-evidence-upload"
                    accept="image/*,application/pdf"
                    onChange={e => handleFileUpload(e, false)}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="student-evidence-upload" className="btn-secondary" style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '6px 12px' }}>
                    <UploadCloud size={14} />
                    <span>{uploadingFile ? 'Đang tải tệp...' : 'Chọn giấy tờ liên quan (nếu có)'}</span>
                  </label>
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Ảnh JPG, PNG hoặc PDF (tối đa 10 MB)</span>
                </div>

                {uploadedEvidence.map((file, idx) => (
                  <div key={idx} style={{ background: '#1e293b', padding: '6px 10px', borderRadius: '4px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
                    <Paperclip size={12} /> {file.metadata?.originalName || file.fileName}
                  </div>
                ))}
              </div>
              {uploadError && <p style={{ fontSize: '0.76rem', color: '#f87171', marginTop: '4px' }}>{uploadError}</p>}
            </div>

            {/* NÚT SUBMIT */}
            <button
              type="submit"
              disabled={submitting || uploadingFile}
              className="btn-primary"
              style={{
                height: '46px',
                fontSize: '0.92rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '6px'
              }}
            >
              <Send size={18} />
              <span>{submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: DANH SÁCH YÊU CẦU CỦA SINH VIÊN */}
      {activeTab === 'student_cases' && (
        <div className="card-panel student-cases-page" style={{ padding: '28px' }}>
          <div className="student-cases-header">
            <div>
              <h2>Yêu cầu của tôi</h2>
              <p>Theo dõi tình trạng xử lý và trao đổi với nhà trường về các yêu cầu bạn đã gửi.</p>
            </div>
            <button onClick={fetchStudentData} className="btn-secondary student-cases-refresh">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>

          {caseLoadError && (
            <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(248, 113, 113, 0.35)', background: 'rgba(127, 29, 29, 0.18)', color: '#fecaca', fontSize: '0.84rem' }}>
              {caseLoadError}
            </div>
          )}

          <div className="student-case-list">
            {myCases.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <FileText size={40} style={{ opacity: 0.4, marginBottom: '10px' }} />
                <p>Bạn chưa có yêu cầu cấp Giấy xác nhận NVQS nào.</p>
                <button
                  onClick={() => setActiveTab('student_submit')}
                  className="btn-primary"
                  style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <PlusCircle size={15} /> Tạo yêu cầu mới ngay
                </button>
              </div>
            ) : (
              myCases.map(c => {
                const isApproved = c.status === 'APPROVED';
                const isNeedingSupplement = c.status === 'REQUIRES_SUPPLEMENT' || c.status === 'INFO_REQUESTED';
                const isSupplementOpen = supplementingCaseId === c.id;

                return (
                  <div
                    id={`student-case-${c.id}`}
                    key={c.id}
                    className={`student-case ${highlightedCaseId === c.id ? 'student-case--highlighted' : ''}`}
                  >
                    {/* CASE HEADER */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div className="student-case__meta">
                <span className="student-case__id">Mã yêu cầu: {c.id}</span>
                        {renderStatusBadge(c.status)}

                <span className="student-case__department"><Building2 size={14} /> Đơn vị tiếp nhận: {c.assignedDepartment || 'Phòng Quản lý Đào tạo'}</span>
                      </div>
              <span className="student-case__date">Ngày gửi: {new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>

                    <h3 className="student-case__title">
                      {c.title}
                    </h3>

                    <div className="student-case__summary">
                      <span>Nội dung bạn đã gửi</span>
                      <p>{c.description || c.studentClaim?.rawAddress || 'Chưa có nội dung mô tả.'}</p>
                    </div>

                    {/* NẾU ĐÃ APPROVED -> CUNG CẤP NÚT IN VÀ TRA CỨU QR */}
                    {isApproved && (
                      <div style={{
                        background: 'rgba(5, 150, 105, 0.1)',
                        border: '1px solid rgba(5, 150, 105, 0.3)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        marginBottom: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 700, fontSize: '0.86rem' }}>
                          <CheckCircle2 size={18} />
                          <span>Yêu cầu đã được xử lý trong hệ thống.</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => openSafeWindow(`${API_BASE}/cases/${c.id}/decision`)}
                            className="btn-primary"
                            style={{ background: '#059669', fontSize: '0.8rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Printer size={14} /> Xem kết quả yêu cầu
                          </button>
                          <button
                            onClick={() => openSafeWindow(`/verify/${c.id}`)}
                            className="btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <QrCode size={14} /> Xem thông tin xác nhận
                          </button>
                        </div>
                      </div>
                    )}

                    {/* NẾU CẦN BỔ SUNG */}
                    {isNeedingSupplement && (
                      <div style={{
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        borderRadius: '8px',
                        padding: '14px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontWeight: 700, fontSize: '0.86rem' }}>
                          <AlertCircle size={16} />
                          <span>Nhà trường cần bạn bổ sung thông tin:</span>
                        </div>
                        <p style={{ fontSize: '0.84rem', color: '#f8fafc', marginTop: '4px' }}>
                          <em>"{c.reviewResult?.reason || 'Vui lòng bổ sung rõ số nhà, đường, phường/xã nơi thường trú.'}"</em>
                        </p>

                        {!isSupplementOpen ? (
                          <button
                            onClick={() => { setSupplementingCaseId(c.id); setSupplementNote(''); setSupplementFiles([]); }}
                            className="btn-primary"
                            style={{ marginTop: '10px', background: '#d97706', fontSize: '0.8rem', padding: '6px 14px' }}
                          >
                            <PlusCircle size={14} /> Gửi thông tin bổ sung
                          </button>
                        ) : (
                          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed rgba(245, 158, 11, 0.3)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <textarea
                              className="form-input"
                              rows={2}
                              placeholder="Ví dụ: Đã ghi rõ Phường Bến Nghé, Quận 1..."
                              value={supplementNote}
                              onChange={e => setSupplementNote(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleSendSupplement(c.id)}
                                disabled={submittingSupplement}
                                className="btn-primary"
                                style={{ background: '#059669', fontSize: '0.8rem', padding: '6px 14px' }}
                              >
                                <Send size={14} /> Gửi bổ sung
                              </button>
                              <button
                                onClick={() => setSupplementingCaseId(null)}
                                className="btn-secondary"
                                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* DISCUSSION & AUDIT TRAIL */}
                    <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.15)', paddingTop: '12px', marginTop: '8px' }}>
                      <CaseDiscussion caseId={c.id} currentStatus={c.status} studentView />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LỊCH SỬ HOẠT ĐỘNG (AUDIT TRAIL) */}
      {activeTab === 'student_history' && (
        <div className="card-panel" style={{ padding: '24px' }}>
          <AuditTrailViewer
            token={token}
            onRefresh={fetchStudentData}
            loading={loading}
            title="Lịch Sử Hoạt Động Của Bạn"
            subtitle="Theo dõi chi tiết các thao tác đã thực hiện trên tài khoản và lịch sử thẩm định hồ sơ NVQS"
            showRoleFilter={false}
            isStudentView={true}
          />
        </div>
      )}
    </div>
  );
};

export default StudentPortal;
