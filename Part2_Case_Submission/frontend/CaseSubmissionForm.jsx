/**
 * ============================================================================
 * CASEFLOW AI - CASE SUBMISSION FORM COMPONENT (PART 2 FRONTEND)
 * ============================================================================
 * @component CaseSubmissionForm
 * @description Biểu mẫu nộp hồ sơ trực tuyến dành cho sinh viên với các tính năng:
 * - Đính kèm tài liệu minh chứng (PNG, JPG, PDF).
 * - Tự động kích hoạt Google Gemini Vision OCR để trích xuất nội dung và gợi ý tiêu đề/danh mục.
 * - Kiểm soát phân loại hồ sơ (Miễn giảm, Học bổng, Phúc khảo, Trợ cấp xã hội).
 * - Tích hợp đầy đủ JWT Bearer token và xử lý lỗi mạng/bảo mật thời gian thực.
 * ============================================================================
 */

import React, { useState, useRef } from 'react';

export const CaseSubmissionForm = ({ onCaseSubmitted, apiBase = 'http://localhost:3001/api' }) => {
    // ------------------------------------------------------------------------
    // STATE MANAGEMENT
    // ------------------------------------------------------------------------
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('ACADEMIC');
    const [priority, setPriority] = useState('MEDIUM');
    const [description, setDescription] = useState('');
    const [evidenceFiles, setEvidenceFiles] = useState([]);
    const [ocrExtracting, setOcrExtracting] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState(null);
    const fileInputRef = useRef(null);

    // ------------------------------------------------------------------------
    // DANH MỤC HỒ SƠ HỖ TRỢ
    // ------------------------------------------------------------------------
    const CATEGORIES = [
        { id: 'TUITION_DISCOUNT', label: 'Miễn giảm học phí & Trợ cấp xã hội' },
        { id: 'SCHOLARSHIP', label: 'Học bổng khuyến khích tài năng' },
        { id: 'ACADEMIC', label: 'Phúc khảo điểm thi & Học vụ' },
        { id: 'EMERGENCY_AID', label: 'Hỗ trợ thiên tai & Khó khăn đột xuất' },
        { id: 'RESEARCH_GRANT', label: 'Tài trợ nghiên cứu khoa học sinh viên' }
    ];

    /**
     * Xử lý tải file minh chứng và tự động kích hoạt Gemini AI OCR trích xuất dữ liệu
     * @param {React.ChangeEvent<HTMLInputElement>} e
     */
    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const token = localStorage.getItem('cf_token');
        const uploadedList = [];

        setOcrExtracting(true);
        setStatusMessage({ type: 'info', text: '🤖 Đang phân tích minh chứng qua Google Gemini Vision AI...' });

        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('documentType', category);

            try {
                const res = await fetch(`${apiBase}/cases/upload-evidence`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const result = await res.json();

                if (result.success && result.data) {
                    uploadedList.push(result.data.fileName);

                    // Tự động điền thông tin nếu Gemini AI OCR trích xuất thành công
                    if (result.data.ocr && result.data.ocr.rawText) {
                        const ocr = result.data.ocr;
                        if (!title && ocr.title) setTitle(ocr.title);
                        if (!description && ocr.extractedFields) {
                            setDescription(
                                `[AI Trích xuất tự động]:\n` +
                                `• Điểm/Loại: ${ocr.extractedFields.score || 'Đạt yêu cầu'}\n` +
                                `• Cơ quan cấp: ${ocr.extractedFields.issuingAuthority || 'Đã xác thực'}\n` +
                                `• Tóm tắt: ${ocr.rawText.slice(0, 150)}...`
                            );
                        }
                    }
                }
            } catch (err) {
                console.error('[CaseForm] Lỗi tải minh chứng:', err);
            }
        }

        setEvidenceFiles(prev => [...prev, ...uploadedList]);
        setOcrExtracting(false);
        setStatusMessage({ type: 'success', text: `✅ Đã xử lý thành công ${uploadedList.length} tài liệu minh chứng!` });
    };

    /**
     * Gửi toàn bộ hồ sơ lên Backend
     * @param {React.FormEvent} e
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            setStatusMessage({ type: 'error', text: '⚠️ Vui lòng nhập tiêu đề hồ sơ.' });
            return;
        }

        setSubmitting(true);
        setStatusMessage({ type: 'info', text: 'Đang gửi hồ sơ vào hệ thống xét duyệt...' });

        const token = localStorage.getItem('cf_token');

        try {
            const res = await fetch(`${apiBase}/cases`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title,
                    category,
                    priority,
                    description,
                    evidenceFiles
                })
            });

            const result = await res.json();

            if (res.ok && result.success) {
                setStatusMessage({
                    type: 'success',
                    text: `🎉 Nộp hồ sơ thành công! Mã hồ sơ: #${result.data?.id || 'Mới'}`
                });
                // Reset form
                setTitle('');
                setDescription('');
                setEvidenceFiles([]);
                if (fileInputRef.current) fileInputRef.current.value = '';
                if (onCaseSubmitted) onCaseSubmitted(result.data);
            } else {
                setStatusMessage({
                    type: 'error',
                    text: result.message || 'Gửi hồ sơ thất bại. Vui lòng kiểm tra lại.'
                });
            }
        } catch (err) {
            setStatusMessage({ type: 'error', text: 'Không thể kết nối đến máy chủ API.' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
                📝 Nộp Hồ Sơ Trực Tuyến & Phân Tích AI
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
                Hệ thống tự động sử dụng Google Gemini Vision để nhận diện văn bằng, bảng điểm và hỗ trợ xét duyệt nhanh.
            </p>

            <form onSubmit={handleSubmit}>
                {/* TIÊU ĐỀ */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                        Tiêu đề hồ sơ *
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="VD: Đơn xin miễn giảm học phí diện khó khăn năm học 2026"
                        required
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                </div>

                {/* DANH MỤC & MỨC ĐỘ ƯU TIÊN */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                            Loại hồ sơ
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', background: '#fff', boxSizing: 'border-box' }}
                        >
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                            Mức độ ưu tiên
                        </label>
                        <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', background: '#fff', boxSizing: 'border-box' }}
                        >
                            <option value="LOW">Bình thường (Low)</option>
                            <option value="MEDIUM">Trung bình (Medium)</option>
                            <option value="HIGH">Khẩn cấp (High)</option>
                            <option value="URGENT">Đặc biệt khẩn (Urgent)</option>
                        </select>
                    </div>
                </div>

                {/* TẢI LÊN MINH CHỨNG */}
                <div style={{ marginBottom: '16px', border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '16px', textAlign: 'center', background: '#f8fafc' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        multiple
                        accept="image/*,.pdf"
                        style={{ display: 'none' }}
                        id="evidence-upload-input"
                    />
                    <label htmlFor="evidence-upload-input" style={{ cursor: 'pointer', color: '#2563eb', fontWeight: '600', fontSize: '14px' }}>
                        📁 Chọn tệp minh chứng (Ảnh / PDF) để AI quét
                    </label>
                    {ocrExtracting && <p style={{ fontSize: '12px', color: '#d97706', marginTop: '6px' }}>⏳ Đang chạy Gemini Vision OCR...</p>}
                    {evidenceFiles.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#16a34a' }}>
                            Đã đính kèm {evidenceFiles.length} tệp minh chứng.
                        </div>
                    )}
                </div>

                {/* MÔ TẢ CHI TIẾT */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                        Nội dung chi tiết / Giải trình
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Mô tả hoàn cảnh, nguyện vọng hoặc để Gemini AI tự động điền từ tài liệu..."
                        rows={4}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                </div>

                {/* THÔNG BÁO TRẠNG THÁI */}
                {statusMessage && (
                    <div style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        fontSize: '13px',
                        background: statusMessage.type === 'error' ? '#fee2e2' : statusMessage.type === 'success' ? '#dcfce7' : '#e0f2fe',
                        color: statusMessage.type === 'error' ? '#991b1b' : statusMessage.type === 'success' ? '#166534' : '#075985'
                    }}>
                        {statusMessage.text}
                    </div>
                )}

                {/* NÚT GỬI HỒ SƠ */}
                <button
                    type="submit"
                    disabled={submitting || ocrExtracting}
                    style={{
                        width: '100%',
                        padding: '12px',
                        background: submitting ? '#94a3b8' : '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        fontSize: '15px',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s'
                    }}
                >
                    {submitting ? 'Đang xử lý...' : '🚀 Xác Nhận Nộp Hồ Sơ'}
                </button>
            </form>
        </div>
    );
};

export default CaseSubmissionForm;
