import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { Award, AlertTriangle, CheckCircle2, Printer } from 'lucide-react';
import { API_BASE } from '../../api/client';
import PageSkeleton from '../../components/common/PageSkeleton';

export const PublicVerificationPage = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const caseId = searchParams.get('caseId');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!caseId) {
      setError('Thiếu mã hồ sơ cần xác thực.');
      setLoading(false);
      return;
    }

    axios.get(`${API_BASE}/cases/verify/${caseId}`)
      .then(res => {
        if (res.data?.success) setData(res.data.data);
        else setError(res.data?.message || 'Không tìm thấy thông tin.');
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Hồ sơ không tồn tại hoặc đã bị thu hồi.');
      })
      .finally(() => setLoading(false));
  }, [caseId]);

  return (
    <div className="verification-page" style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      boxSizing: 'border-box'
    }}>
      <div className="verification-card" style={{
        maxWidth: '680px',
        width: '100%',
        background: '#090e1a',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 40px rgba(56, 189, 248, 0.15)'
      }}>
        {/* Header Quốc Gia */}
        <div style={{ textAlign: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '18px', marginBottom: '20px' }}>
          <div style={{ width: '54px', height: '54px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
            <Award size={28} color="#34d399" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', margin: '0 0 4px 0' }}>
            CỔNG TRA CỨU & XÁC THỰC VĂN BẢN ĐIỆN TỬ
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0 }}>
            Hệ thống EDUASSISTANT • Trường Đại Học Công Nghệ Quốc Gia
          </p>
        </div>

        {loading ? (
          <PageSkeleton variant="verification" label="Đang xác minh hồ sơ" />
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '30px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', borderRadius: '12px', color: '#f87171' }}>
            <AlertTriangle size={32} style={{ marginBottom: '8px' }} />
            <h4 style={{ margin: '0 0 6px 0' }}>Không Thể Xác Thực</h4>
            <p style={{ fontSize: '0.85rem', margin: 0 }}>{error}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Status Stamp */}
            <div style={{
              background: data.status === 'APPROVED' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(217, 119, 6, 0.15)',
              border: `1px solid ${data.status === 'APPROVED' ? '#059669' : '#d97706'}`,
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <CheckCircle2 size={28} color={data.status === 'APPROVED' ? '#34d399' : '#fbbf24'} />
              <div>
                <strong style={{ color: data.status === 'APPROVED' ? '#34d399' : '#fbbf24', fontSize: '0.95rem' }}>
                  ✓ Chứng Nhận Hợp Lệ & Toàn Vẹn
                </strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Văn bản có mã xác thực toàn vẹn do hệ thống EDUASSISTANT tạo.
                </p>
              </div>
            </div>

            {/* Grid Information */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#050811', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: 'var(--text-sub)' }}>Mã hồ sơ:</span>
                <div style={{ fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>#{data.caseId}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-sub)' }}>Trạng thái:</span>
                <div style={{ fontWeight: 700, color: '#34d399' }}>{data.status}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-sub)' }}>Họ và tên sinh viên:</span>
                <div style={{ fontWeight: 700, color: '#ffffff' }}>{data.studentName}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-sub)' }}>Mã số sinh viên (MSSV):</span>
                <div style={{ fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>{data.studentCode || 'N/A'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--text-sub)' }}>Tiêu đề hồ sơ:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{data.title}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-sub)' }}>Đơn vị phê chuẩn:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{data.assignedDepartment}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-sub)' }}>Cán bộ phê duyệt:</span>
                <div style={{ fontWeight: 600, color: '#60a5fa' }}>{data.reviewerName}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--text-sub)' }}>Mã xác thực toàn vẹn (HMAC-SHA256):</span>
                <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(0,0,0,0.4)', padding: '6px 8px', borderRadius: '6px', marginTop: '4px' }}>
                  {data.digitalSignature}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '8px' }}>
              <button
                onClick={() => window.print()}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={15} /> In / Lưu Chứng Nhận Xác Thực
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicVerificationPage;
