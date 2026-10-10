import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  PlusCircle, RefreshCw, Paperclip, UploadCloud, Sparkles,
  CheckCircle2, AlertTriangle, Printer, Send, Building2, AlertCircle, QrCode,
  MapPin, Shield, User, FileText, Check, AlertOctagon
} from 'lucide-react';
import { API_BASE, SERVER_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { renderSlaBadge } from '../../utils/formatters';
import CaseDiscussion from '../../components/discussion/CaseDiscussion';
import AuditTrailViewer from '../../components/audit/AuditTrailViewer';
import PageSkeleton from '../../components/common/PageSkeleton';
import { openSafeWindow, safeImageUrl } from '../../utils/security';

const ESCALATION_LABELS = {
  OWNERSHIP_UNCLEAR: 'Nghi vấn quyền sở hữu / MSSV không khớp',
  FACT_UNKNOWN: 'Thiếu dữ kiện xác thực / Địa chỉ chưa đủ thành phần',
  DATA_CONFLICT: 'Mâu thuẫn dữ liệu kê khai và hồ sơ lưu trữ',
  AUTHORITY_REQUIRED: 'Cần chuyên viên Phòng Đào tạo xác minh',
  POLICY_OUT_OF_SCOPE: 'Yêu cầu ngoài quy chế tự động chuẩn'
};

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
  const [loading, setLoading] = useState(true);
  const [caseLoadError, setCaseLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [highlightedCaseId, setHighlightedCaseId] = useState(null);

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
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8' }}>Đã gửi (Chờ xử lý)</span>;
      case 'UNDER_REVIEW':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(217, 119, 6, 0.15)', color: '#fbbf24' }}>Đang thẩm định (HITL)</span>;
      case 'APPROVED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(5, 150, 105, 0.2)', color: '#34d399', border: '1px solid rgba(5, 150, 105, 0.3)' }}>✅ Đã cấp Giấy xác nhận</span>;
      case 'REJECTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(225, 29, 72, 0.15)', color: '#f87171' }}>Đã từ chối</span>;
      case 'REQUIRES_SUPPLEMENT':
      case 'INFO_REQUESTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}>Cần bổ sung thông tin</span>;
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
              <Shield size={14} /> Dịch vụ học vụ trực tuyến • Quy trình chuẩn 2026
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.3, margin: '4px 0' }}>
              YÊU CẦU CẤP GIẤY XÁC NHẬN SINH VIÊN
            </h1>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#94a3b8', margin: 0 }}>
              PHỤC VỤ THỦ TỤC TẠM HOÃN GỌI NHẬP NGŨ (NVQS)
            </h2>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.82rem', marginTop: '6px' }}>
              Hệ thống Escalation Referee sẽ tự động đối chiếu thông tin thường trú với hồ sơ đào tạo để cấp Giấy xác nhận có chữ ký số điện tử.
            </p>
          </div>

          <form onSubmit={handleSubmitCase} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* KHỐI 1: THÔNG TIN SINH VIÊN (READ-ONLY AUTHORITATIVE RECORD) */}
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '10px',
              padding: '16px 20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#38bdf8', fontWeight: 700, fontSize: '0.86rem' }}>
                <User size={16} /> THÔNG TIN SINH VIÊN (Dữ liệu gốc từ tài khoản)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '0.84rem' }}>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Họ và tên sinh viên:</span>
                  <strong style={{ color: '#f8fafc' }}>{user?.fullName || 'Sinh viên'}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Mã số sinh viên (MSSV):</span>
                  <strong style={{ color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>{user?.studentCode || user?.username || 'SV2026'}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Khoa / Ngành đào tạo:</span>
                  <strong style={{ color: '#f8fafc' }}>{user?.department || 'Khoa Công Nghệ Thông Tin'}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Trạng thái đào tạo:</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(5, 150, 105, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.76rem' }}>
                    ● Đang học chính khóa (ACTIVE)
                  </span>
                </div>
              </div>
            </div>

            {/* KHỐI 2: MỤC ĐÍCH YÊU CẦU (READ-ONLY) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: '#e2e8f0' }}>
                Mục đích xin cấp giấy xác nhận *
              </label>
              <input
                type="text"
                className="form-input"
                value="Cấp Giấy xác nhận sinh viên phục vụ thủ tục tạm hoãn nghĩa vụ quân sự"
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
                  <MapPin size={16} /> THÔNG TIN ĐỊA CHỈ CƯ TRÚ (Khai báo gửi Ban CHQS)
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  * Bắt buộc khai báo chính xác địa chỉ thường trú
                </span>
              </div>

              {/* LỰA CHỌN LOẠI ĐỊA CHỈ */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                  Loại địa chỉ kê khai:
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
                    <strong style={{ color: '#38bdf8' }}>Thường trú (Hộ khẩu / Đăng ký NVQS)</strong>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="addressType"
                      value="TEMPORARY"
                      checked={addressType === 'TEMPORARY'}
                      onChange={() => setAddressType('TEMPORARY')}
                    />
                    <span style={{ color: '#fbbf24' }}>Tạm trú (Cảnh báo: Thủ tục NVQS yêu cầu Thường trú)</span>
                  </label>
                </div>
                {addressType === 'TEMPORARY' && (
                  <p style={{ fontSize: '0.76rem', color: '#fbbf24', marginTop: '6px', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                    ⚠️ <strong>Cảnh báo nghiệp vụ:</strong> Thủ tục tạm hoãn gọi nhập ngũ yêu cầu nộp Giấy xác nhận về Ban Chỉ huy Quân sự cấp xã/phường nơi đăng ký <strong>thường trú</strong>. Nếu bạn chọn tạm trú, hồ sơ sẽ phải chuyển cán bộ xác minh lại.
                  </p>
                )}
              </div>

              {/* Ô NHẬP ĐỊA CHỈ TỰ DO */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                  Địa chỉ thường trú (Nhập số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố) *
                </label>
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
                  💡 Hệ thống tự động nhận diện viết tắt (P, Q, TPHCM) và chuẩn hóa chữ hoa/thường.
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
                      <Sparkles size={14} /> Chuẩn hóa cú pháp địa chỉ (AI Address Normalizer):
                    </span>
                    {normalizing && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Đang phân tích...</span>}
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
                            }).join(', ')}. Hãy ghi rõ để tránh bị cán bộ trả lại hồ sơ.
                          </span>
                        </div>
                      ) : (
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '0.76rem' }}>
                          <Check size={14} />
                          <span>Đầy đủ các cấp đơn vị hành chính (Số nhà, Tên đường, Phường/Xã, Tỉnh/Thành phố).</span>
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
                  Số điện thoại liên hệ
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="0912xxxxxx"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                  Ghi chú thêm (Tùy chọn)
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
                Tài liệu hỗ trợ kèm theo (Tùy chọn - không bắt buộc)
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
                    <span>{uploadingFile ? 'Đang tải tệp...' : 'Đính kèm ảnh CCCD / Hộ khẩu (nếu có)'}</span>
                  </label>
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>JPG, PNG, PDF (Tối đa 10MB)</span>
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
              <span>{submitting ? 'Hệ thống đang thẩm định hồ sơ...' : 'GỬI YÊU CẦU CẤP GIẤY XÁC NHẬN NVQS'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: DANH SÁCH YÊU CẦU CỦA SINH VIÊN */}
      {activeTab === 'student_cases' && (
        <div className="card-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                Hồ Sơ Của Bạn ({myCases.length})
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Theo dõi tiến độ duyệt và nhận Giấy xác nhận tạm hoãn NVQS có chữ ký số điện tử
              </p>
            </div>
            <button onClick={fetchStudentData} className="btn-secondary">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>

          {caseLoadError && (
            <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(248, 113, 113, 0.35)', background: 'rgba(127, 29, 29, 0.18)', color: '#fecaca', fontSize: '0.84rem' }}>
              {caseLoadError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                const esc = c.escalation || (c.aiExtraction?.escalation) || null;
                const ruleEng = c.ruleEngine || (c.aiExtraction?.ruleEngine) || null;
                const isAutoApproved = ruleEng?.decision === 'AUTO_APPROVE';

                return (
                  <div
                    id={`student-case-${c.id}`}
                    key={c.id}
                    style={{
                      background: '#0f172a',
                      border: `1px solid ${highlightedCaseId === c.id ? '#60a5fa' : (isApproved ? 'rgba(5, 150, 105, 0.4)' : (isNeedingSupplement ? 'rgba(245, 158, 11, 0.5)' : 'var(--border-color)'))}`,
                      borderRadius: '10px',
                      padding: '18px',
                      boxShadow: highlightedCaseId === c.id ? '0 0 0 4px rgba(96, 165, 250, 0.16)' : 'none'
                    }}
                  >
                    {/* CASE HEADER */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: '#818cf8', fontWeight: 800 }}>{c.id}</span>
                        {renderStatusBadge(c.status)}
                        {isAutoApproved && (
                          <span style={{ fontSize: '0.72rem', background: 'rgba(5, 150, 105, 0.15)', color: '#34d399', border: '1px solid rgba(5, 150, 105, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                            ⚡ Tự động phê chuẩn
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', background: '#334155', color: '#93c5fd', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Building2 size={11} /> {c.assignedDepartment || 'Phòng Quản lý Đào tạo'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                        Nộp ngày: {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
                      {c.title}
                    </h3>

                    {/* ĐỊA CHỈ & DỮ LIỆU ĐỐI CHIẾU */}
                    <div style={{ background: '#1e293b', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>
                        <span style={{ color: '#94a3b8' }}>📍 Địa chỉ thường trú đã khai: </span>
                        <strong style={{ color: '#f8fafc' }}>{c.studentClaim?.rawAddress || c.description}</strong>
                      </div>
                      {c.aiExtraction?.normalizedAddress && (
                        <div>
                          <span style={{ color: '#94a3b8' }}>✨ Chuẩn hóa bởi hệ thống: </span>
                          <span style={{ color: '#38bdf8' }}>{c.aiExtraction.normalizedAddress}</span>
                        </div>
                      )}
                    </div>

                    {/* NẾU LEO THANG XÉT DUYỆT */}
                    {esc && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        marginBottom: '12px',
                        fontSize: '0.8rem'
                      }}>
                        <div style={{ color: '#f87171', fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={14} /> Chuyển chuyên viên xem xét ({ESCALATION_LABELS[esc.reason] || esc.reason})
                        </div>
                        <p style={{ color: '#cbd5e1', margin: 0 }}>{esc.explanation}</p>
                      </div>
                    )}

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
                          <span>Giấy xác nhận điện tử đã được ký số HMAC-SHA256 hợp lệ!</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => openSafeWindow(`${API_BASE}/cases/${c.id}/decision`)}
                            className="btn-primary"
                            style={{ background: '#059669', fontSize: '0.8rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Printer size={14} /> In Giấy Xác Nhận NVQS
                          </button>
                          <button
                            onClick={() => openSafeWindow(`/verify/${c.id}`)}
                            className="btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <QrCode size={14} /> Tra Cứu Mã Xác Thực
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
                          <span>Yêu cầu bổ sung thông tin từ chuyên viên:</span>
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
                            <PlusCircle size={14} /> Bổ Sung Thông Tin & Gửi Duyệt Lại
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
                                <Send size={14} /> Gửi Cập Nhật
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
                      <CaseDiscussion caseId={c.id} currentStatus={c.status} />
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
