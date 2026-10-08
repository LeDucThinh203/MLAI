import React, { useState, useEffect } from 'react';
import {
  X, AlertTriangle, CheckCircle2, Copy, RefreshCw, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const TwoFactorModal = ({ isOpen, onClose, user }) => {
  const { generate2FA, enable2FA, disable2FA } = useAuth();
  const [qrCodeData, setQrCodeData] = useState(null);
  const [twoFactorInputCode, setTwoFactorInputCode] = useState('');
  const [modal2FAMsg, setModal2FAMsg] = useState(null);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setModal2FAMsg(null);
      setTwoFactorInputCode('');
      setCopiedSecret(false);
      if (!user?.twoFactorEnabled) {
        setTwoFactorLoading(true);
        generate2FA().then(res => {
          setTwoFactorLoading(false);
          if (res?.success) {
            setQrCodeData(res.data);
          } else {
            setModal2FAMsg({ type: 'error', text: res?.message || 'Không thể tạo mã 2FA QR.' });
          }
        }).catch(() => {
          setTwoFactorLoading(false);
          setModal2FAMsg({ type: 'error', text: 'Lỗi kết nối khi tạo mã 2FA.' });
        });
      }
    }
  }, [isOpen, user?.twoFactorEnabled]);

  if (!isOpen) return null;

  const handleEnable = async (e) => {
    if (e) e.preventDefault();
    if (!twoFactorInputCode || twoFactorInputCode.trim().length < 6) {
      setModal2FAMsg({ type: 'error', text: 'Vui lòng nhập đủ 6 chữ số OTP từ ứng dụng Authenticator!' });
      return;
    }
    setTwoFactorLoading(true);
    setModal2FAMsg(null);
    const res = await enable2FA(qrCodeData?.secret, twoFactorInputCode.trim());
    setTwoFactorLoading(false);
    if (res?.success) {
      setModal2FAMsg({ type: 'success', text: '✅ Đã kích hoạt Xác thực 2 bước (2FA) thành công!' });
      setTimeout(() => onClose(), 1200);
    } else {
      setModal2FAMsg({ type: 'error', text: res?.message || 'Mã OTP không chính xác!' });
    }
  };

  const handleDisable = async (e) => {
    if (e) e.preventDefault();
    if (!twoFactorInputCode || twoFactorInputCode.trim().length < 6) {
      setModal2FAMsg({ type: 'error', text: 'Vui lòng nhập mã OTP hiện tại (hoặc 123456) để xác nhận tắt 2FA!' });
      return;
    }
    setTwoFactorLoading(true);
    setModal2FAMsg(null);
    const res = await disable2FA(twoFactorInputCode.trim());
    setTwoFactorLoading(false);
    if (res?.success) {
      setModal2FAMsg({ type: 'success', text: '✅ Đã tắt Xác thực 2 bước (2FA) thành công!' });
      setTimeout(() => onClose(), 1200);
    } else {
      setModal2FAMsg({ type: 'error', text: res?.message || 'Mã OTP không chính xác!' });
    }
  };

  const handleCopy = () => {
    if (qrCodeData?.secret) {
      navigator.clipboard?.writeText(qrCodeData.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999999,
        background: 'rgba(2, 6, 23, 0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'linear-gradient(180deg, #0f172a 0%, #070d1e 100%)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: '20px',
          padding: '28px 24px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(99, 102, 241, 0.25)',
          position: 'relative',
          color: '#ffffff',
          boxSizing: 'border-box'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#cbd5e1',
            cursor: 'pointer'
          }}
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: user?.twoFactorEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
            border: `1px solid ${user?.twoFactorEnabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto',
            boxShadow: `0 0 20px ${user?.twoFactorEnabled ? 'rgba(16, 185, 129, 0.25)' : 'rgba(99, 102, 241, 0.25)'}`
          }}>
            <ShieldAlert size={28} color={user?.twoFactorEnabled ? '#34d399' : '#818cf8'} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
            {user?.twoFactorEnabled ? 'Xác Thực 2 Bước Đang Bật' : 'Cài Đặt Xác Thực 2 Bước (2FA)'}
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: '4px' }}>
            {user?.twoFactorEnabled 
              ? 'Tài khoản của bạn được bảo mật an toàn với mã OTP 6 số.' 
              : 'Bảo vệ tài khoản bằng Google Authenticator / Microsoft Authenticator.'}
          </p>
        </div>

        {/* Feedback Alert Message */}
        {modal2FAMsg && (
          <div style={{
            background: modal2FAMsg.type === 'success' ? 'rgba(5, 150, 105, 0.2)' : 'rgba(225, 29, 72, 0.2)',
            border: `1px solid ${modal2FAMsg.type === 'success' ? '#10b981' : '#f43f5e'}`,
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '0.84rem',
            fontWeight: 600,
            color: modal2FAMsg.type === 'success' ? '#34d399' : '#f87171',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {modal2FAMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{modal2FAMsg.text}</span>
          </div>
        )}

        {/* CONTENT FOR ENABLED 2FA */}
        {user?.twoFactorEnabled ? (
          <form onSubmit={handleDisable} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <CheckCircle2 size={24} color="#34d399" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#34d399', fontSize: '0.9rem', display: 'block' }}>2FA Đang Hoạt Động</strong>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Mỗi lần đăng nhập, bạn cần cung cấp mã 6 chữ số từ ứng dụng Authenticator.
                </span>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Nhập mã OTP để xác nhận TẮT 2FA:
                </label>
                <button
                  type="button"
                  onClick={() => setTwoFactorInputCode('123456')}
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.76rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  ⚡ Mã Test (123456)
                </button>
              </div>

              <input
                type="text"
                maxLength={6}
                autoFocus
                className="form-input"
                placeholder="000000"
                value={twoFactorInputCode}
                onChange={e => setTwoFactorInputCode(e.target.value.replace(/\D/g, ''))}
                style={{
                  textAlign: 'center',
                  fontSize: '1.5rem',
                  letterSpacing: '8px',
                  fontWeight: 800,
                  height: '52px',
                  borderColor: '#f43f5e',
                  background: '#050a18',
                  color: '#ffffff',
                  boxShadow: '0 0 15px rgba(244, 63, 94, 0.15)'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={twoFactorLoading || !twoFactorInputCode}
              className="btn-danger"
              style={{ width: '100%', height: '46px', fontSize: '0.92rem', fontWeight: 700, borderRadius: '10px' }}
            >
              {twoFactorLoading ? 'Đang xử lý...' : 'Vô Hiệu Hóa 2FA'}
            </button>
          </form>
        ) : (
          /* CONTENT FOR SETUP / ENABLE 2FA */
          <form onSubmit={handleEnable} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: '#060b18',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px' }}>
                1. Mở ứng dụng <strong>Authenticator</strong> & quét mã QR bên dưới:
              </p>

              {twoFactorLoading && !qrCodeData ? (
                <div style={{ padding: '30px', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <RefreshCw size={18} className="animate-spin" /> Đang tạo mã QR...
                </div>
              ) : qrCodeData?.qrCodeDataUrl ? (
                <div style={{
                  background: '#ffffff',
                  padding: '10px',
                  borderRadius: '12px',
                  width: 'fit-content',
                  margin: '0 auto 12px auto',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
                }}>
                  <img src={qrCodeData.qrCodeDataUrl} alt="2FA QR Code" style={{ width: '160px', height: '160px', display: 'block' }} />
                </div>
              ) : null}

              {qrCodeData?.secret && (
                <div style={{
                  background: 'rgba(15, 23, 42, 0.95)',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600 }}>Khóa bí mật thủ công (Secret Key):</span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="btn-secondary"
                      style={{
                        padding: '3px 10px',
                        fontSize: '0.72rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        borderRadius: '6px',
                        flexShrink: 0
                      }}
                    >
                      <Copy size={12} />
                      {copiedSecret ? 'Đã sao chép ✓' : 'Sao chép'}
                    </button>
                  </div>
                  <div style={{
                    color: '#38bdf8',
                    fontWeight: 700,
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '0.78rem',
                    wordBreak: 'break-all',
                    overflowWrap: 'anywhere',
                    lineHeight: '1.4',
                    background: 'rgba(0, 0, 0, 0.35)',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(56, 189, 248, 0.18)',
                    userSelect: 'all'
                  }}>
                    {qrCodeData.secret}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  2. Nhập mã OTP gồm 6 chữ số:
                </label>
                <button
                  type="button"
                  onClick={() => setTwoFactorInputCode('123456')}
                  style={{ background: 'transparent', border: 'none', color: '#818cf8', fontSize: '0.76rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  ⚡ Nhập nhanh Test (123456)
                </button>
              </div>

              <input
                type="text"
                maxLength={6}
                className="form-input"
                placeholder="000000"
                value={twoFactorInputCode}
                onChange={e => setTwoFactorInputCode(e.target.value.replace(/\D/g, ''))}
                style={{
                  textAlign: 'center',
                  fontSize: '1.5rem',
                  letterSpacing: '8px',
                  fontWeight: 800,
                  height: '52px',
                  borderColor: '#818cf8',
                  background: '#050a18',
                  color: '#ffffff',
                  boxShadow: '0 0 15px rgba(99, 102, 241, 0.2)'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={twoFactorLoading || !twoFactorInputCode}
              className="btn-primary shimmer-button"
              style={{ width: '100%', height: '46px', fontSize: '0.92rem', fontWeight: 700, borderRadius: '10px', background: 'linear-gradient(135deg, #4f46e5, #0284c7)' }}
            >
              {twoFactorLoading ? 'Đang xác thực...' : 'Xác Nhận & Kích Hoạt 2FA'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};


export default TwoFactorModal;
