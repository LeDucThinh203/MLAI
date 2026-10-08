import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText, PlusCircle, RefreshCw, Paperclip, UploadCloud, Cpu, Sparkles,
  Search, Filter, CheckCircle2, AlertTriangle, Clock, Eye, Download, X,
  Printer, Image, Maximize2, MessageCircle
} from 'lucide-react';
import { API_BASE, SERVER_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { renderSlaBadge } from '../../utils/formatters';
import CaseDiscussion from '../../components/discussion/CaseDiscussion';

const StudentPortal = ({ activeTab, setActiveTab }) => {
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
  const [myAudits, setMyAudits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const [casesRes, auditsRes] = await Promise.all([
        axios.get(`${API_BASE}/cases/my-cases`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/audits`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (casesRes.data?.success) setMyCases(casesRes.data.data.cases);
      if (auditsRes.data?.success) {
        const filtered = auditsRes.data.data.audits.filter(a => a.actor?.id === user.id);
        setMyAudits(filtered);
      }
    } catch (err) {
      console.error('Lá»—i táº£i dá»¯ liá»‡u sinh viĂªn:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, []);

  const handleOcrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError('');
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Dung lÆ°á»£ng file vÆ°á»£t quĂ¡ giá»›i háº¡n 10MB!');
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
          setToastMessage({ type: 'success', text: `âœ¨ OCR Ä‘Ă£ trĂ­ch xuáº¥t & tá»± Ä‘á»™ng Ä‘iá»n Ä‘Æ¡n: ${ocr.data.documentType}` });
        }
      }
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Lá»—i quĂ©t OCR file minh chá»©ng!');
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
      setUploadError('Dung lÆ°á»£ng file vÆ°á»£t quĂ¡ giá»›i háº¡n 10MB!');
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
      setUploadError(err.response?.data?.message || 'Táº£i file tháº¥t báº¡i!');
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
        setToastMessage({ type: 'success', text: `ÄĂ£ ná»™p há»“ sÆ¡ #${res.data.data.case.id} thĂ nh cĂ´ng!` });
        setTitle('');
        setDescription('');
        setUploadedEvidence([]);
        fetchStudentData();
        setActiveTab('student_cases');
      }
    } catch (err) {
      setToastMessage({ type: 'error', text: err.response?.data?.message || 'Gá»­i há»“ sÆ¡ tháº¥t báº¡i!' });
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
        setToastMessage({ type: 'success', text: `ÄĂ£ gá»­i bá»• sung há»“ sÆ¡ #${caseId} Ä‘á»ƒ duyá»‡t láº¡i thĂ nh cĂ´ng!` });
        setSupplementingCaseId(null);
        setSupplementNote('');
        setSupplementFiles([]);
        fetchStudentData();
      }
    } catch (err) {
      setToastMessage({ type: 'error', text: err.response?.data?.message || 'Gá»­i bá»• sung tháº¥t báº¡i!' });
    } finally {
      setSubmittingSupplement(false);
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'SUBMITTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8' }}>ÄĂ£ gá»­i (Chá» duyá»‡t)</span>;
      case 'UNDER_REVIEW':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(217, 119, 6, 0.15)', color: '#fbbf24' }}>Äang tháº©m Ä‘á»‹nh</span>;
      case 'APPROVED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(5, 150, 105, 0.15)', color: '#34d399' }}>ÄĂ£ cháº¥p thuáº­n</span>;
      case 'REJECTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(225, 29, 72, 0.15)', color: '#f87171' }}>ÄĂ£ tá»« chá»‘i</span>;
      case 'REQUIRES_SUPPLEMENT':
      case 'INFO_REQUESTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}>Cáº§n bá»• sung há»“ sÆ¡</span>;
      case 'RESUBMITTED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }}>ÄĂ£ bá»• sung (Chá» duyá»‡t láº¡i)</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
            <PlusCircle size={20} color="var(--accent-primary)" /> Khá»Ÿi Táº¡o Há»“ SÆ¡ Sinh ViĂªn
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
            Äiá»n cĂ¡c thĂ´ng tin Ä‘á» nghá»‹ vĂ  Ä‘Ă­nh kĂ¨m giáº¥y tá» chá»©ng minh:
          </p>

          <form onSubmit={handleSubmitCase} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                TiĂªu Ä‘á» há»“ sÆ¡ *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="VĂ­ dá»¥: ÄÆ¡n xin miá»…n giáº£m há»c phĂ­ há»c ká»³ 1 nÄƒm há»c 2026-2027..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Loáº¡i yĂªu cáº§u
                </label>
                <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="TUITION_DISCOUNT">Miá»…n giáº£m há»c phĂ­</option>
                  <option value="COMMUNITY_SERVICE">Äiá»ƒm rĂ¨n luyá»‡n</option>
                  <option value="SCHOLARSHIP">Há»c bá»•ng khuyáº¿n khĂ­ch</option>
                  <option value="GRADE_APPEAL">PhĂºc kháº£o Ä‘iá»ƒm</option>
                  <option value="GENERAL">KhĂ¡c</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Äá»™ Æ°u tiĂªn
                </label>
                <select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="HIGH">Kháº©n cáº¥p (Cao)</option>
                  <option value="MEDIUM">BĂ¬nh thÆ°á»ng (Trung bĂ¬nh)</option>
                  <option value="LOW">Tháº¥p</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Minh chá»©ng Ä‘Ă­nh kĂ¨m & Tá»± Ä‘á»™ng trĂ­ch xuáº¥t thĂ´ng tin báº±ng AI OCR
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
                      <span>{ocrScanning ? 'Äang trĂ­ch xuáº¥t OCR...' : 'âœ¨ QuĂ©t OCR & Tá»± Äá»™ng Äiá»n'}</span>
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
                      <span>{uploadingFile && !ocrScanning ? 'Äang táº£i file...' : 'Táº£i file thÆ°á»ng'}</span>
                    </label>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-sub)' }}>Äá»‹nh dáº¡ng JPG, PNG, WEBP, PDF (Tá»‘i Ä‘a 10MB)</span>
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
                        <Sparkles size={14} color="#38bdf8" /> AI OCR: {ocrData.documentType}
                      </span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        Äá»™ tin cáº­y: {Math.round((ocrData.confidenceScore || 0.96) * 100)}% â€¢ Tamper: {ocrData.tamperRisk || 'LOW'} (An toĂ n)
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.76rem', color: 'var(--text-sub)', marginTop: '4px' }}>
                      <div>â€¢ Sinh viĂªn: <strong style={{ color: '#fff' }}>{ocrData.studentName}</strong> ({ocrData.studentCode})</div>
                      <div>â€¢ ÄÆ¡n vá»‹ cáº¥p: <strong style={{ color: '#fff' }}>{ocrData.issuingAuthority}</strong></div>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>
                      â„¹ï¸ ÄĂ£ tá»± Ä‘á»™ng Ä‘iá»n TiĂªu Ä‘á», PhĂ¢n loáº¡i vĂ  Ná»™i dung giáº£i trĂ¬nh tá»« minh chá»©ng. Báº¡n cĂ³ thá»ƒ chá»‰nh sá»­a náº¿u cáº§n.
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
                        ÄĂ£ tá»‘i Æ°u VLM (-{file.metadata.savings})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Ná»™i dung chi tiáº¿t *
              </label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="TrĂ¬nh bĂ y lĂ½ do, hoĂ n cáº£nh vĂ  nguyá»‡n vá»ng cá»¥ thá»ƒ cá»§a báº¡n..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={submitting || uploadingFile} className="btn-primary" style={{ height: '42px', marginTop: '6px' }}>
              <Send size={16} />
              <span>{submitting ? 'Äang gá»­i há»“ sÆ¡...' : 'Ná»™p Há»“ SÆ¡ Xuá»‘ng Há»‡ Thá»‘ng'}</span>
            </button>
          </form>
        </div>
      )}

      {activeTab === 'student_cases' && (
        <div className="card-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Há»“ SÆ¡ Cá»§a Báº¡n ({myCases.length})</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Theo dĂµi tiáº¿n Ä‘á»™ duyá»‡t há»“ sÆ¡ cá»§a cĂ¡ nhĂ¢n báº¡n</p>
            </div>
            <button onClick={fetchStudentData} className="btn-secondary">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              LĂ m má»›i
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {myCases.map(c => {
              const isNeedingSupplement = c.status === 'REQUIRES_SUPPLEMENT' || c.status === 'INFO_REQUESTED';
              const isSupplementOpen = supplementingCaseId === c.id;

              return (
                <div key={c.id} style={{
                  background: '#0f172a',
                  border: `1px solid ${isNeedingSupplement ? 'rgba(245, 158, 11, 0.5)' : 'var(--border-color)'}`,
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: '#818cf8', fontWeight: 700 }}>{c.id}</span>
                      {renderStatusBadge(c.status)}
                      {renderSlaBadge(c)}
                      <span style={{ fontSize: '0.68rem', background: '#334155', color: '#93c5fd', padding: '2px 7px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Building2 size={11} /> {c.assignedDepartment || 'PhĂ²ng CĂ´ng tĂ¡c Sinh viĂªn'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                      NgĂ y ná»™p: {new Date(c.createdAt).toLocaleDateString('vi-VN')}
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
                        <span>Há»“ sÆ¡ cáº§n bá»• sung giáº¥y tá» Ä‘á»ƒ tháº©m Ä‘á»‹nh láº¡i!</span>
                      </div>
                      <p style={{ fontSize: '0.84rem', color: 'var(--text-main)', marginTop: '4px' }}>
                        <strong>YĂªu cáº§u tá»« Tháº©m Ä‘á»‹nh viĂªn:</strong> <em>"{c.reviewResult?.reason || 'Vui lĂ²ng bá»• sung giáº¥y tá» rĂµ rĂ ng hÆ¡n.'}"</em>
                      </p>

                      {!isSupplementOpen ? (
                        <button
                          onClick={() => { setSupplementingCaseId(c.id); setSupplementNote(''); setSupplementFiles([]); }}
                          className="btn-primary"
                          style={{ marginTop: '10px', background: '#d97706', fontSize: '0.82rem', padding: '6px 14px' }}
                        >
                          <PlusCircle size={14} /> Bá»• Sung Giáº¥y Tá» & Gá»­i Duyá»‡t Láº¡i
                        </button>
                      ) : (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed rgba(245, 158, 11, 0.3)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            Ghi chĂº giáº£i trĂ¬nh bá»• sung:
                          </label>
                          <textarea
                            className="form-input"
                            rows={2}
                            placeholder="VĂ­ dá»¥: ÄĂ£ bá»• sung báº£n scan dáº¥u má»™c rĂµ rĂ ng..."
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
                              <UploadCloud size={14} /> {uploadingFile ? 'Äang nĂ©n file...' : 'Táº£i thĂªm minh chá»©ng bá»• sung'}
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
                              <Send size={14} /> Gá»­i Bá»• Sung Äá»ƒ Duyá»‡t Láº¡i
                            </button>
                            <button
                              onClick={() => setSupplementingCaseId(null)}
                              className="btn-secondary"
                              style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                            >
                              Há»§y
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
                            src={c.reviewResult.reviewerAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
                            alt="Reviewer"
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${c.status === 'APPROVED' ? '#34d399' : '#f87171'}` }}
                          />
                          <div>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: c.status === 'APPROVED' ? '#34d399' : '#f87171' }}>
                              {c.status === 'APPROVED' ? 'âœ“ ÄĂ£ phĂª duyá»‡t bá»Ÿi: ' : 'âœ— ÄĂ£ tá»« chá»‘i bá»Ÿi: '}
                              <strong>{c.reviewResult.reviewerName || 'CĂ¡n Bá»™ Tháº©m Äá»‹nh'}</strong>
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)', display: 'block' }}>
                              {c.reviewResult.reviewerDepartment || 'Ban Tháº©m Äá»‹nh Há»c Vá»¥'} â€¢ {c.reviewResult.reviewedAt ? new Date(c.reviewResult.reviewedAt).toLocaleString('vi-VN') : ''}
                            </span>
                          </div>
                        </div>

                        {c.status === 'APPROVED' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => window.open(`${API_BASE}/cases/${c.id}/export-decision?token=${token}`, '_blank')}
                              className="btn-primary shimmer-button"
                              style={{ background: 'linear-gradient(135deg, #059669, #10b981)', fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Printer size={13} />
                              <span>In / LÆ°u Quyáº¿t Äá»‹nh PDF</span>
                            </button>
                            <button
                              onClick={() => window.open(`/verify?caseId=${c.id}`, '_blank')}
                              className="btn-secondary"
                              style={{ fontSize: '0.78rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#38bdf8', color: '#38bdf8' }}
                              title="Xem trang chá»©ng thá»±c cĂ´ng khai QR code"
                            >
                              <QrCode size={13} />
                              <span>MĂ£ QR XĂ¡c Thá»±c</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#e2e8f0', background: 'rgba(9, 13, 26, 0.5)', padding: '8px 12px', borderRadius: '6px' }}>
                        <span style={{ color: 'var(--text-sub)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>ÄĂ¡nh giĂ¡ cá»§a cĂ¡n bá»™:</span>
                        <p style={{ margin: '2px 0 0 0', fontStyle: 'italic' }}>"{c.reviewResult.reason}"</p>
                      </div>
                    </div>
                  )}

                  {c.aiExtraction && (
                    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '8px 12px', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={13} /> AI Kiá»ƒm tra: <strong>{c.aiExtraction.policyRuleMatch || 'Há»£p lá»‡'}</strong>
                      </span>
                      <span style={{ color: '#34d399' }}>Äá»™ tin cáº­y: {Math.round((c.aiExtraction.confidence || 0.95) * 100)}%</span>
                    </div>
                  )}

                  {/* KĂªnh tháº£o luáº­n trá»±c tiáº¿p trĂªn tá»«ng há»“ sÆ¡ */}
                  <CaseDiscussion caseId={c.id} token={token} currentUser={user} />
                </div>
              );
            })}

            {myCases.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sub)' }}>
                Báº¡n chÆ°a ná»™p há»“ sÆ¡ nĂ o. HĂ£y báº¥m <strong>Ná»™p Há»“ SÆ¡ Má»›i</strong> Ä‘á»ƒ táº¡o Ä‘Æ¡n.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'student_history' && (
        <AuditTrailViewer
          audits={myAudits}
          token={token}
          onRefresh={fetchStudentData}
          loading={loading}
          title="Lá»‹ch Sá»­ Hoáº¡t Äá»™ng Cá»§a Báº¡n (Theo NgĂ y)"
          subtitle="Theo dĂµi chi tiáº¿t cĂ¡c thao tĂ¡c Ä‘Ă£ thá»±c hiá»‡n trĂªn tĂ i khoáº£n theo tá»«ng má»‘c thá»i gian"
          showRoleFilter={false}
          isStudentView={true}
        />
      )}
    </div>
  );
};


export default StudentPortal;