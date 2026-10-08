import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Shield, User, Lock, Mail, Building, GraduationCap, Eye, EyeOff,
  KeyRound, Send, ArrowUpRight, CheckCircle2, AlertTriangle, Sparkles, Check
} from 'lucide-react';
import { API_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const AuthPage = () => {
  const [mode, setMode] = useState('login');
  
  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedDemo, setSelectedDemo] = useState(null);

  // 2FA Challenge State
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null);
  const [twoFactorOtp, setTwoFactorOtp] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);

  // Register fields (Chá»‰ dĂ nh cho Sinh ViĂªn)
  const [regFullName, setRegFullName] = useState('');
  const [regStudentCode, setRegStudentCode] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDepartment, setRegDepartment] = useState('Khoa CĂ´ng Nghá»‡ ThĂ´ng Tin');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, login2FA, registerStudent, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);
    if (res.requires2FA) {
      setTwoFactorChallenge({
        tempToken: res.tempToken,
        username: res.username,
        maskedEmail: res.maskedEmail
      });
      setTwoFactorOtp('');
      return;
    }
    if (!res.success) setError(res.message);
  };

  const handleVerify2FASubmit = async (e) => {
    if (e) e.preventDefault();
    if (!twoFactorOtp || twoFactorOtp.length < 6) {
      setError('Vui lĂ²ng nháº­p Ä‘á»§ 6 chá»¯ sá»‘ OTP tá»« á»©ng dá»¥ng Authenticator!');
      return;
    }
    setVerifying2FA(true);
    setError('');
    const res = await login2FA(twoFactorChallenge.tempToken, twoFactorOtp);
    setVerifying2FA(false);
    if (!res.success) {
      setError(res.message || 'MĂ£ OTP khĂ´ng chĂ­nh xĂ¡c hoáº·c Ä‘Ă£ háº¿t háº¡n.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await registerStudent({
      fullName: regFullName,
      studentCode: regStudentCode.trim(),
      username: regUsername,
      password: regPassword,
      department: regDepartment
    });
    setLoading(false);
    if (!res.success) {
      setError(res.message);
    }
  };

  const handleQuickLogin = (u, p, roleKey) => {
    setUsername(u);
    setPassword(p);
    setSelectedDemo(roleKey);
    setError('');
  };

  return (
    <div style={{
      position: 'relative',
      minHeight: 'calc(100vh - 40px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      overflow: 'hidden'
    }}>
      
      {/* 1. FLOATING AMBIENT GLOW ORBS (CĂC Äá»M SĂNG HUYá»€N áº¢O DI CHUYá»‚N) */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '20%',
        width: '380px',
        height: '380px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79, 70, 229, 0.35) 0%, rgba(99, 102, 241, 0.05) 70%, transparent 100%)',
        filter: 'blur(70px)',
        pointerEvents: 'none',
        animation: 'floatOrb1 14s ease-in-out infinite',
        zIndex: 0
      }} />

      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '18%',
        width: '420px',
        height: '420px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(2, 132, 199, 0.3) 0%, rgba(56, 189, 248, 0.05) 70%, transparent 100%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        animation: 'floatOrb2 16s ease-in-out infinite',
        zIndex: 0
      }} />

      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '480px',
        height: '480px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(244, 63, 94, 0.15) 0%, transparent 70%)',
        filter: 'blur(90px)',
        pointerEvents: 'none',
        animation: 'floatOrb3 20s ease-in-out infinite',
        zIndex: 0
      }} />

      {/* 2. AUTHENTICATION CONTAINER CARD */}
      <div 
        className="auth-card-animated"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '520px',
          background: 'rgba(11, 17, 34, 0.85)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          padding: '36px 32px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(79, 70, 229, 0.12)'
        }}
      >
        
        {/* Brand Header with Glowing Halo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          
          {/* Logo with pulsating halo */}
          <div style={{
            position: 'relative',
            width: '60px',
            height: '60px',
            margin: '0 auto 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              position: 'absolute',
              inset: '-4px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #4f46e5, #0284c7, #f43f5e)',
              filter: 'blur(8px)',
              opacity: 0.75,
              animation: 'pulseGlow 3s infinite'
            }} />
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(79, 70, 229, 0.4)'
            }}>
              <Shield size={28} color="#ffffff" />
            </div>
          </div>

          <h2 className="text-gradient-animated" style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
            CaseFlow AI
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', fontWeight: 500 }}>
            Há»‡ thá»‘ng quáº£n lĂ½, xĂ©t duyá»‡t & tháº©m Ä‘á»‹nh há»“ sÆ¡ sinh viĂªn
          </p>

          {/* Feature Highlight Pills */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: '12px', background: 'rgba(79, 70, 229, 0.15)', color: '#818cf8', border: '1px solid rgba(79, 70, 229, 0.3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={11} /> AI Gemini Triage
            </span>
            <span style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              â¡ Sharp WebP -95%
            </span>
            <span style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              đŸ”’ JWT RBAC
            </span>
          </div>
        </div>

        {/* Tab switch giá»¯a ÄÄƒng Nháº­p & ÄÄƒng KĂ½ Sinh ViĂªn */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'rgba(15, 23, 42, 0.8)',
          padding: '4px',
          borderRadius: '12px',
          marginBottom: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            style={{
              background: mode === 'login' ? 'linear-gradient(135deg, #4f46e5, #3b82f6)' : 'transparent',
              color: mode === 'login' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '9px',
              padding: '9px',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: 'pointer',
              boxShadow: mode === 'login' ? '0 4px 14px rgba(79, 70, 229, 0.4)' : 'none',
              transition: 'all 0.25s ease'
            }}
          >
            ÄÄƒng Nháº­p
          </button>

          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            style={{
              background: mode === 'register' ? 'linear-gradient(135deg, #4f46e5, #3b82f6)' : 'transparent',
              color: mode === 'register' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '9px',
              padding: '9px',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: 'pointer',
              boxShadow: mode === 'register' ? '0 4px 14px rgba(79, 70, 229, 0.4)' : 'none',
              transition: 'all 0.25s ease'
            }}
          >
            ÄÄƒng KĂ½ Sinh ViĂªn
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(225, 29, 72, 0.15)',
            border: '1px solid rgba(225, 29, 72, 0.35)',
            borderRadius: '10px',
            padding: '10px 14px',
            color: '#f87171',
            fontSize: '0.85rem',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 0 12px rgba(225, 29, 72, 0.2)'
          }}>
            <AlertTriangle size={17} />
            <span>{error}</span>
          </div>
        )}

        {/* 2FA OTP CHALLENGE MODAL */}
        {twoFactorChallenge && (
          <div style={{
            background: '#070c1a',
            border: '1px solid #818cf8',
            borderRadius: '14px',
            padding: '24px',
            boxShadow: '0 0 30px rgba(99, 102, 241, 0.3)',
            marginBottom: '16px'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', border: '1px solid #818cf8' }}>
                <ShieldAlert size={26} color="#818cf8" />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>XĂ¡c Thá»±c 2 BÆ°á»›c (2FA OTP)</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                TĂ i khoáº£n <strong>{twoFactorChallenge.username}</strong> yĂªu cáº§u mĂ£ OTP tá»« á»©ng dá»¥ng Authenticator.
              </p>
            </div>

            <form onSubmit={handleVerify2FASubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  className="form-input"
                  placeholder="000000"
                  value={twoFactorOtp}
                  onChange={e => setTwoFactorOtp(e.target.value.replace(/\D/g, ''))}
                  style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '6px', fontWeight: 800, height: '48px', borderColor: '#818cf8' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setTwoFactorOtp('123456')}
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  â¡ Nháº­p nhanh mĂ£ Bypass Demo (123456)
                </button>
              </div>

              <button
                type="submit"
                disabled={verifying2FA || !twoFactorOtp}
                className="btn-primary shimmer-button"
                style={{ height: '44px', fontWeight: 700 }}
              >
                {verifying2FA ? 'Äang xĂ¡c thá»±c OTP...' : 'XĂ¡c Thá»±c & ÄÄƒng Nháº­p'}
              </button>

              <button
                type="button"
                onClick={() => { setTwoFactorChallenge(null); setTwoFactorOtp(''); setError(''); }}
                className="btn-secondary"
                style={{ height: '36px', fontSize: '0.8rem' }}
              >
                Quay láº¡i Ä‘Äƒng nháº­p
              </button>
            </form>
          </div>
        )}

        {/* 1. FORM ÄÄ‚NG NHáº¬P */}
        {!twoFactorChallenge && mode === 'login' && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                TĂªn Ä‘Äƒng nháº­p
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={16} color="#818cf8" style={{ position: 'absolute', left: '12px' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="student1, reviewer1, admin1..."
                  value={username}
                  onChange={e => { setUsername(e.target.value); setSelectedDemo(null); }}
                  style={{ paddingLeft: '38px', height: '42px' }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                Máº­t kháº©u
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} color="#818cf8" style={{ position: 'absolute', left: '12px' }} />
                <input
                  type="password"
                  className="form-input"
                  placeholder="Nháº­p máº­t kháº©u (vĂ­ dá»¥: password123)..."
                  value={password}
                  onChange={e => { setPassword(e.target.value); setSelectedDemo(null); }}
                  style={{ paddingLeft: '38px', height: '42px' }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary shimmer-button"
              style={{ width: '100%', marginTop: '6px', height: '44px', fontSize: '0.92rem', fontWeight: 700 }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Äang xĂ¡c thá»±c thĂ´ng tin...</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>ÄÄƒng Nháº­p VĂ o Há»‡ Thá»‘ng</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* 2. FORM ÄÄ‚NG KĂ TĂ€I KHOáº¢N SINH VIĂN */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              background: 'rgba(2, 132, 199, 0.12)',
              border: '1px solid rgba(2, 132, 199, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.78rem',
              color: '#38bdf8',
              lineHeight: 1.4
            }}>
              â„¹ï¸ ÄÄƒng kĂ½ cĂ´ng khai chá»‰ Ă¡p dá»¥ng cho <strong>Sinh viĂªn</strong>. TĂ i khoáº£n Tháº©m Ä‘á»‹nh vĂ  Quáº£n trá»‹ viĂªn chá»‰ Ä‘Æ°á»£c cáº¥p bá»Ÿi Admin trÆ°á»ng.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Há» vĂ  tĂªn sinh viĂªn *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VĂ­ dá»¥: Nguyá»…n VÄƒn An"
                  value={regFullName}
                  onChange={e => setRegFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  MĂ£ SV (MSSV) *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="SV2026-9921..."
                  value={regStudentCode}
                  onChange={e => setRegStudentCode(e.target.value.toUpperCase())}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  TĂªn Ä‘Äƒng nháº­p *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="student99..."
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Máº­t kháº©u *
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Tá»‘i thiá»ƒu 6 kĂ½ tá»±"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                Khoa Ä‘Ă o táº¡o
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Khoa CĂ´ng Nghá»‡ ThĂ´ng Tin, Khoa Kinh Táº¿..."
                value={regDepartment}
                onChange={e => setRegDepartment(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary shimmer-button"
              style={{ width: '100%', marginTop: '8px', height: '44px', fontWeight: 700 }}
            >
              <UserPlus size={16} />
              <span>{loading ? 'Äang táº¡o tĂ i khoáº£n sinh viĂªn...' : 'Táº¡o TĂ i Khoáº£n & VĂ o Há»‡ Thá»‘ng'}</span>
            </button>
          </form>
        )}

        {/* 3. INTERACTIVE QUICK DEMO ACCOUNT SELECTOR (CHá»ŒN NHANH VAI TRĂ’ DEMO) */}
        <div style={{
          marginTop: '22px',
          paddingTop: '18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '0.8rem',
          color: 'var(--text-sub)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#f59e0b" /> Chá»n nhanh tĂ i khoáº£n Demo:
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Máº­t kháº©u: <code>password123</code></span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            
            {/* 1. Student Demo Button */}
            <div
              onClick={() => handleQuickLogin('student1', 'password123', 'student')}
              style={{
                background: selectedDemo === 'student' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                border: `1px solid ${selectedDemo === 'student' ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: '10px',
                padding: '10px 8px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                transform: selectedDemo === 'student' ? 'scale(1.03)' : 'scale(1)',
                boxShadow: selectedDemo === 'student' ? '0 0 16px rgba(56, 189, 248, 0.35)' : 'none'
              }}
            >
              <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>đŸ“</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>Sinh ViĂªn</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', marginTop: '2px' }}>student1</div>
            </div>

            {/* 2. Reviewer Demo Button */}
            <div
              onClick={() => handleQuickLogin('reviewer1', 'password123', 'reviewer')}
              style={{
                background: selectedDemo === 'reviewer' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                border: `1px solid ${selectedDemo === 'reviewer' ? '#fbbf24' : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: '10px',
                padding: '10px 8px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                transform: selectedDemo === 'reviewer' ? 'scale(1.03)' : 'scale(1)',
                boxShadow: selectedDemo === 'reviewer' ? '0 0 16px rgba(245, 158, 11, 0.35)' : 'none'
              }}
            >
              <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>đŸ”</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fbbf24' }}>Tháº©m Äá»‹nh</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', marginTop: '2px' }}>reviewer1</div>
            </div>

            {/* 3. Admin Demo Button */}
            <div
              onClick={() => handleQuickLogin('admin1', 'password123', 'admin')}
              style={{
                background: selectedDemo === 'admin' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                border: `1px solid ${selectedDemo === 'admin' ? '#f43f5e' : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: '10px',
                padding: '10px 8px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                transform: selectedDemo === 'admin' ? 'scale(1.03)' : 'scale(1)',
                boxShadow: selectedDemo === 'admin' ? '0 0 16px rgba(244, 63, 94, 0.35)' : 'none'
              }}
            >
              <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>đŸ›¡ï¸</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f43f5e' }}>Quáº£n Trá»‹</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', marginTop: '2px' }}>admin1</div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};


export default AuthPage;