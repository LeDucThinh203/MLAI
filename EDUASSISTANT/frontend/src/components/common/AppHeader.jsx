import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  LogOut, Shield, UserCheck, GraduationCap,
  BarChart3, Settings, ShieldAlert,
  PlusCircle, FileText, History, Inbox, Users
} from 'lucide-react';
import { API_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../notifications/NotificationBell';

const AppHeader = ({ activeTab, setActiveTab, onOpen2FAModal }) => {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const [aiMode, setAiMode] = useState('mock');

  useEffect(() => {
    const fetchAiStatus = async () => {
      if (token) {
        try {
          const res = await axios.get(`${API_BASE}/system/ai-status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data?.success) {
            setAiMode(res.data.data.currentMode);
          }
        } catch {
          // ignore
        }
      }
    };
    fetchAiStatus();
  }, [token]);

  const handleChangeAiMode = async (newMode) => {
    try {
      const res = await axios.post(`${API_BASE}/system/ai-mode`, { mode: newMode }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setAiMode(newMode);
      }
    } catch (err) {
      console.error('Không thể đổi AI mode:', err);
    }
  };

  const getPortalTitle = () => {
    if (user?.role === 'ADMIN') return 'CỔNG QUẢN TRỊ VIÊN';
    if (user?.role === 'REVIEWER') return 'CỔNG THẨM ĐỊNH HỒ SƠ';
    if (user?.role === 'STUDENT') return 'CỔNG SINH VIÊN';
    return 'HỆ THỐNG QUẢN LÝ HỒ SƠ';
  };

  const getPortalIcon = () => {
    if (user?.role === 'ADMIN') return <Shield size={20} color="#ffffff" />;
    if (user?.role === 'REVIEWER') return <UserCheck size={20} color="#ffffff" />;
    return <GraduationCap size={20} color="#ffffff" />;
  };

  const getPortalColor = () => {
    if (user?.role === 'ADMIN') return 'var(--accent-rose)';
    if (user?.role === 'REVIEWER') return 'var(--accent-amber)';
    return 'var(--accent-primary)';
  };

  return (
    <header style={{
      background: 'rgba(9, 13, 26, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '10px 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.5)'
    }}>
      <div style={{ width: '100%', maxWidth: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: getPortalColor(),
            padding: '8px',
            borderRadius: '10px',
            display: 'flex',
            boxShadow: `0 0 16px ${getPortalColor()}50`
          }}>
            {getPortalIcon()}
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.01em' }}>
              {getPortalTitle()}
              <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)', fontWeight: 700 }}>
                EDUASSISTANT
              </span>
            </h1>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-sub)' }}>
              {user?.department || 'Trường Đại Học'}
            </p>
          </div>
        </div>

        {/* Tab Menus theo 3 Role */}
        {user && (
          <nav style={{ display: 'flex', gap: '6px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {user.role === 'STUDENT' && (
              <>
                <button
                  onClick={() => setActiveTab('student_submit')}
                  style={{
                    background: activeTab === 'student_submit' ? 'linear-gradient(135deg, #4f46e5, #3b82f6)' : 'transparent',
                    color: activeTab === 'student_submit' ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '6px 14px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: activeTab === 'student_submit' ? '0 2px 10px rgba(79, 70, 229, 0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <PlusCircle size={15} /> Nộp Hồ Sơ
                </button>
                <button
                  onClick={() => setActiveTab('student_cases')}
                  style={{
                    background: activeTab === 'student_cases' ? 'linear-gradient(135deg, #4f46e5, #3b82f6)' : 'transparent',
                    color: activeTab === 'student_cases' ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '6px 14px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: activeTab === 'student_cases' ? '0 2px 10px rgba(79, 70, 229, 0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <FileText size={15} /> Hồ Sơ Của Tôi
                </button>
                <button
                  onClick={() => setActiveTab('student_history')}
                  style={{
                    background: activeTab === 'student_history' ? 'linear-gradient(135deg, #4f46e5, #3b82f6)' : 'transparent',
                    color: activeTab === 'student_history' ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '6px 14px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: activeTab === 'student_history' ? '0 2px 10px rgba(79, 70, 229, 0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <History size={15} /> Lịch Sử Hoạt Động
                </button>
              </>
            )}

            {user.role === 'REVIEWER' && (
              <>
                <button
                  onClick={() => setActiveTab('reviewer_queue')}
                  style={{
                    background: activeTab === 'reviewer_queue' ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'transparent',
                    color: activeTab === 'reviewer_queue' ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '6px 14px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: activeTab === 'reviewer_queue' ? '0 2px 10px rgba(217, 119, 6, 0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <Inbox size={15} /> Hàng Đợi Thẩm Định
                </button>
                <button
                  onClick={() => setActiveTab('reviewer_audit')}
                  style={{
                    background: activeTab === 'reviewer_audit' ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'transparent',
                    color: activeTab === 'reviewer_audit' ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '6px 14px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: activeTab === 'reviewer_audit' ? '0 2px 10px rgba(217, 119, 6, 0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <History size={15} /> Nhật Ký Audit
                </button>
              </>
            )}

            {user.role === 'ADMIN' && (
              <>
                <button
                  onClick={() => setActiveTab('admin_overview')}
                  style={{
                    background: activeTab === 'admin_overview' ? 'linear-gradient(135deg, #e11d48, #f43f5e)' : 'transparent',
                    color: activeTab === 'admin_overview' ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '6px 14px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: activeTab === 'admin_overview' ? '0 2px 10px rgba(225, 29, 72, 0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <BarChart3 size={15} /> Tổng Quan
                </button>
                <button
                  onClick={() => setActiveTab('admin_users')}
                  style={{
                    background: activeTab === 'admin_users' ? 'linear-gradient(135deg, #e11d48, #f43f5e)' : 'transparent',
                    color: activeTab === 'admin_users' ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '6px 14px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: activeTab === 'admin_users' ? '0 2px 10px rgba(225, 29, 72, 0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <Users size={15} /> Quản Lý & Cấp Tài Khoản
                </button>
                <button
                  onClick={() => setActiveTab('reviewer_queue')}
                  style={{
                    background: activeTab === 'reviewer_queue' ? 'linear-gradient(135deg, #e11d48, #f43f5e)' : 'transparent',
                    color: activeTab === 'reviewer_queue' ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '6px 14px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: activeTab === 'reviewer_queue' ? '0 2px 10px rgba(225, 29, 72, 0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <Inbox size={15} /> Thẩm Định Toàn Quyền
                </button>
                <button
                  onClick={() => setActiveTab('reviewer_audit')}
                  style={{
                    background: activeTab === 'reviewer_audit' ? 'linear-gradient(135deg, #e11d48, #f43f5e)' : 'transparent',
                    color: activeTab === 'reviewer_audit' ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '6px 14px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: activeTab === 'reviewer_audit' ? '0 2px 10px rgba(225, 29, 72, 0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <History size={15} /> Nhật Ký Audit
                </button>
              </>
            )}
          </nav>
        )}

        {/* User Status & Actions */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {user.role !== 'STUDENT' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#090d16',
                border: '1px solid #1e293b',
                borderRadius: '20px',
                padding: '4px 10px',
                fontSize: '0.78rem'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: aiMode === 'live' ? '#10b981' : (aiMode === 'cache' ? '#f59e0b' : '#38bdf8'),
                  boxShadow: `0 0 6px ${aiMode === 'live' ? '#10b981' : '#38bdf8'}`
                }} />
                <span style={{ color: 'var(--text-sub)', fontWeight: 600, fontSize: '0.72rem' }}>AI:</span>
                <select
                  value={aiMode}
                  onChange={e => handleChangeAiMode(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: aiMode === 'live' ? '#34d399' : (aiMode === 'cache' ? '#fbbf24' : '#38bdf8'),
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="mock" style={{ background: '#1e293b', color: '#fff' }}>MOCK Engine</option>
                  <option value="cache" style={{ background: '#1e293b', color: '#fff' }}>CACHE Store</option>
                  <option value="live" style={{ background: '#1e293b', color: '#fff' }}>LIVE Gemini</option>
                </select>
              </div>
            )}

            {/* Notification Hub */}
            <NotificationBell />

            {/* Profile Pill Card */}
            <div 
              onClick={() => setActiveTab('account_settings')}
              title="Nhấn để mở Cài đặt tài khoản & Hồ sơ"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: activeTab === 'account_settings' ? 'rgba(56, 189, 248, 0.15)' : '#090d16',
                border: activeTab === 'account_settings' ? '1px solid #38bdf8' : '1px solid #1e293b',
                borderRadius: '24px',
                padding: '4px 12px 4px 6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: activeTab === 'account_settings' ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none'
              }}
            >
              <img
                src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt="Avatar"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: `2px solid ${user.role === 'ADMIN' ? '#f43f5e' : (user.role === 'REVIEWER' ? '#fbbf24' : '#38bdf8')}`
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.25 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {user.fullName || user.username}
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: user.role === 'ADMIN' ? '#f43f5e' : (user.role === 'REVIEWER' ? '#fbbf24' : '#38bdf8')
                }}>
                  {user.role === 'ADMIN' ? '🛡️ Quản trị viên' : (user.role === 'REVIEWER' ? '🔍 Ban Thẩm Định' : '🎓 Sinh Viên')}
                </span>
              </div>
            </div>

            {/* Account Settings Tab Button */}
            <button
              onClick={() => setActiveTab('account_settings')}
              className="btn-secondary"
              title="Cài đặt tài khoản (Đổi mật khẩu, avatar, giới thiệu, xóa tài khoản)"
              style={{
                borderRadius: '20px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                border: activeTab === 'account_settings' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                background: activeTab === 'account_settings' ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(59, 130, 246, 0.25))' : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === 'account_settings' ? '#38bdf8' : 'var(--text-main)',
                boxShadow: activeTab === 'account_settings' ? '0 0 10px rgba(56, 189, 248, 0.3)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Settings size={14} />
              <span>Cài Đặt</span>
            </button>
            
            {/* 2FA Security Settings Button */}
            <button
              onClick={onOpen2FAModal}
              className="btn-secondary"
              title="Quản lý Xác thực 2 bước (2FA)"
              style={{
                borderRadius: '20px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                border: user.twoFactorEnabled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                background: user.twoFactorEnabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                color: user.twoFactorEnabled ? '#34d399' : '#fbbf24'
              }}
            >
              <ShieldAlert size={14} />
              <span>{user.twoFactorEnabled ? '2FA: ĐÃ BẬT' : 'KÍCH HOẠT 2FA'}</span>
            </button>

            {/* Logout Button */}
            <button 
              onClick={logout} 
              className="btn-danger" 
              title="Đăng xuất tài khoản"
              style={{
                borderRadius: '20px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <LogOut size={13} />
              <span>Đăng xuất</span>
            </button>
          </div>
        )}

        {/* Guest Navigation when unauthenticated */}
        {!user && (
          <nav style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/login"
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'none',
                background: location.pathname === '/login' ? 'linear-gradient(135deg, #4f46e5, #3b82f6)' : 'rgba(255, 255, 255, 0.05)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s'
              }}
            >
              🔐 Đăng Nhập
            </Link>
            <Link
              to="/verify"
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'none',
                background: location.pathname === '/verify' ? 'linear-gradient(135deg, #059669, #10b981)' : 'rgba(255, 255, 255, 0.05)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s'
              }}
            >
              🔍 Tra Cứu Hồ Sơ
            </Link>
            <Link
              to="/judge"
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'none',
                background: location.pathname === '/judge' ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'rgba(255, 255, 255, 0.05)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s'
              }}
            >
              ⚖️ Ban Giám Khảo
            </Link>
          </nav>
        )}

      </div>
    </header>
  );
};


export default AppHeader;
