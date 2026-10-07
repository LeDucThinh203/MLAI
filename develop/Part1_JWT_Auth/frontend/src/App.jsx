import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  FileText, History, PlusCircle, RefreshCw, LogOut, CheckCircle2, 
  AlertTriangle, Send, User, Lock, Clock, GraduationCap, UserCheck, 
  Shield, UploadCloud, Paperclip, Cpu, Sparkles, Filter, Check, 
  Eye, EyeOff, FileCheck, Search, ChevronRight, Inbox, ThumbsUp, ThumbsDown,
  HelpCircle, MessageSquare, AlertCircle, UserPlus, Users, Activity,
  BarChart3, Settings, ShieldAlert, Mail, Building, KeyRound,
  X, TrendingUp, PieChart, Layers, FolderPlus, SlidersHorizontal, ArrowUpRight,
  ExternalLink, Image, Download, Maximize2, Trash2, Camera, Key, Save, ShieldCheck,
  Calendar, CalendarDays, CheckCheck, Copy,
  Bell, MessageCircle, QrCode, Award, Timer, Share2, Printer, Building2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : 'http://localhost:3001/api');
const SERVER_BASE = API_BASE.replace(/\/api\/?$/, '');

// ==========================================
// 1. AUTH CONTEXT
// ==========================================
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('cf_token') || null);
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('cf_refresh_token') || null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async (savedToken = token) => {
    if (!savedToken) {
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` }
      });
      if (res.data?.success && res.data?.data?.user) {
        setUser(res.data.data.user);
        setToken(savedToken);
      } else {
        await tryRefreshToken();
      }
    } catch {
      await tryRefreshToken();
    } finally {
      setLoading(false);
    }
  };

  const tryRefreshToken = async () => {
    const savedRefresh = localStorage.getItem('cf_refresh_token');
    if (!savedRefresh) {
      logout();
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: savedRefresh });
      if (res.data?.success && res.data.data?.token) {
        const newToken = res.data.data.token;
        const newRefresh = res.data.data.refreshToken || savedRefresh;
        setToken(newToken);
        setRefreshToken(newRefresh);
        localStorage.setItem('cf_token', newToken);
        localStorage.setItem('cf_refresh_token', newRefresh);
        const meRes = await axios.get(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${newToken}` }
        });
        if (meRes.data?.success) {
          setUser(meRes.data.data.user);
        }
      } else {
        logout();
      }
    } catch {
      logout();
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('cf_token');
    fetchMe(savedToken);
  }, []);

  const login = async (username, password) => {
    try {
      const res = await axios.post(`${API_BASE}/login`, { username, password });
      if (res.data?.success) {
        if (res.data.data?.requires2FA) {
          return {
            success: true,
            requires2FA: true,
            tempToken: res.data.data.tempToken,
            username: res.data.data.username,
            maskedEmail: res.data.data.maskedEmail
          };
        }
        const { token: newToken, refreshToken: newRefresh, user: userData } = res.data.data;
        setToken(newToken);
        if (newRefresh) {
          setRefreshToken(newRefresh);
          localStorage.setItem('cf_refresh_token', newRefresh);
        }
        setUser(userData);
        localStorage.setItem('cf_token', newToken);
        return { success: true, user: userData };
      }
      return { success: false, message: res.data?.message || 'Đăng nhập thất bại' };
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể kết nối đến máy chủ!';
      return { success: false, message: msg };
    }
  };

  const login2FA = async (tempToken, otpCode) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/2fa/login`, { tempToken, otpCode });
      if (res.data?.success) {
        const { token: newToken, refreshToken: newRefresh, user: userData } = res.data.data;
        setToken(newToken);
        if (newRefresh) {
          setRefreshToken(newRefresh);
          localStorage.setItem('cf_refresh_token', newRefresh);
        }
        setUser(userData);
        localStorage.setItem('cf_token', newToken);
        return { success: true, user: userData };
      }
      return { success: false, message: res.data?.message || 'Xác thực OTP thất bại' };
    } catch (err) {
      const msg = err.response?.data?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn!';
      return { success: false, message: msg };
    }
  };

  const registerStudent = async (studentData) => {
    try {
      const res = await axios.post(`${API_BASE}/register`, studentData);
      if (res.data?.success) {
        const { token: newToken, refreshToken: newRefresh, user: userProfile } = res.data.data;
        setToken(newToken);
        if (newRefresh) {
          setRefreshToken(newRefresh);
          localStorage.setItem('cf_refresh_token', newRefresh);
        }
        setUser(userProfile);
        localStorage.setItem('cf_token', newToken);
        return { success: true, user: userProfile, message: res.data.message };
      }
      return { success: false, message: res.data?.message || 'Đăng ký thất bại' };
    } catch (err) {
      const msg = err.response?.data?.message || 'Lỗi đăng ký tài khoản!';
      return { success: false, message: msg };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const res = await axios.put(`${API_BASE}/auth/profile`, profileData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success && res.data?.data?.user) {
        setUser(prev => ({ ...prev, ...res.data.data.user }));
        return { success: true, user: res.data.data.user, message: res.data.message || 'Cập nhật thông tin thành công!' };
      }
      return { success: false, message: res.data?.message || 'Cập nhật thất bại' };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Lỗi cập nhật hồ sơ' };
    }
  };

  const uploadAvatar = async (formData) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/avatar`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      if (res.data?.success && res.data?.data?.user) {
        setUser(prev => ({ ...prev, ...res.data.data.user }));
        return { success: true, avatar: res.data.data.avatar, message: res.data.message };
      }
      return { success: false, message: res.data?.message || 'Tải ảnh đại diện thất bại' };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Lỗi tải ảnh đại diện' };
    }
  };

  const changePassword = async (oldPassword, newPassword, confirmPassword) => {
    try {
      const res = await axios.put(`${API_BASE}/auth/change-password`, {
        oldPassword,
        newPassword,
        confirmPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { success: res.data?.success, message: res.data?.message || 'Đổi mật khẩu thành công' };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Lỗi đổi mật khẩu' };
    }
  };

  const deleteAccount = async (password) => {
    try {
      const res = await axios.delete(`${API_BASE}/auth/account`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { password }
      });
      if (res.data?.success) {
        logout();
        return { success: true, message: res.data.message };
      }
      return { success: false, message: res.data?.message || 'Xóa tài khoản thất bại' };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Lỗi xóa tài khoản' };
    }
  };

  const generate2FA = async () => {
    try {
      const res = await axios.post(`${API_BASE}/auth/2fa/generate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Lỗi tạo mã 2FA' };
    }
  };

  const enable2FA = async (secret, otpCode) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/2fa/enable`, { secret, otpCode }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setUser(prev => ({ ...prev, twoFactorEnabled: true }));
      }
      return res.data;
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Mã OTP không đúng' };
    }
  };

  const disable2FA = async (otpCode) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/2fa/disable`, { otpCode }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setUser(prev => ({ ...prev, twoFactorEnabled: false }));
      }
      return res.data;
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Mã OTP không đúng' };
    }
  };

  const logout = () => {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem('cf_token');
    localStorage.removeItem('cf_refresh_token');
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      refreshToken,
      loading,
      login,
      login2FA,
      registerStudent,
      updateProfile,
      uploadAvatar,
      changePassword,
      deleteAccount,
      generate2FA,
      enable2FA,
      disable2FA,
      fetchMe,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

// ==========================================
// 2. ROUTE BẢO VỆ & HELPER PHÂN LOẠI
// ==========================================
export const ProtectedRoute = ({ children }) => {
  const { user, token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Đang tải dữ liệu hệ thống...
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// ==========================================
// HELPER: SLA DEADLINE TIMER & BADGES
// ==========================================
export const renderSlaBadge = (c) => {
  if (c.status === 'APPROVED') {
    return (
      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <CheckCircle2 size={11} /> Đạt SLA (Hoàn thành)
      </span>
    );
  }
  if (c.status === 'REJECTED') {
    return (
      <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <X size={11} /> Đã đóng
      </span>
    );
  }

  const deadlineMs = c.deadline ? new Date(c.deadline).getTime() : new Date(c.createdAt).getTime() + 48 * 3600 * 1000;
  const nowMs = Date.now();
  const diffHours = (deadlineMs - nowMs) / (1000 * 3600);

  if (diffHours < 0) {
    const overdueH = Math.abs(Math.round(diffHours));
    return (
      <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', background: 'rgba(225, 29, 72, 0.25)', color: '#f43f5e', border: '1px solid #ef4444', display: 'inline-flex', alignItems: 'center', gap: '4px', animation: 'pulse 2s infinite' }}>
        <Timer size={11} /> 🚨 Quá hạn SLA ({overdueH}h)
      </span>
    );
  }

  if (diffHours <= 12) {
    const remainH = Math.max(1, Math.round(diffHours));
    return (
      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <Timer size={11} /> ⚠️ Sắp hết hạn (còn {remainH}h)
      </span>
    );
  }

  const remainH = Math.round(diffHours);
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <Timer size={11} /> ⏳ Còn {remainH}h (SLA 48h)
    </span>
  );
};

// ==========================================
// COMPONENT: THÔNG BÁO THỜI GIAN THỰC (NOTIFICATION BELL)
// ==========================================
const NotificationBell = () => {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const bellContainerRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ right: '0px', width: '360px' });

  const fetchNotifs = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setNotifications(res.data.data.notifications || []);
        setUnreadCount(res.data.data.unreadCount || 0);
      }
    } catch {}
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000); // Polling real-time mỗi 10s
    return () => clearInterval(interval);
  }, [token]);

  // Tự động tính toán vị trí để popup không bao giờ bị khuất/tràn khỏi mép màn hình
  useEffect(() => {
    if (open && bellContainerRef.current) {
      const rect = bellContainerRef.current.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const targetWidth = Math.min(360, screenWidth - 24);

      if (rect.right - targetWidth < 12) {
        const offset = 12 - (rect.right - targetWidth);
        setDropdownPos({ right: `-${offset}px`, width: `${targetWidth}px` });
      } else {
        setDropdownPos({ right: '0px', width: `${targetWidth}px` });
      }
    }
  }, [open]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellContainerRef.current && !bellContainerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  const handleMarkAsRead = async (id) => {
    try {
      await axios.post(`${API_BASE}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
    } catch {} finally {
      setLoading(false);
    }
  };

  return (
    <div ref={bellContainerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title="Thông báo hệ thống"
        style={{
          position: 'relative',
          background: open ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
          border: open ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '50%',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: open ? '#818cf8' : 'var(--text-main)',
          transition: 'all 0.2s'
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            background: 'linear-gradient(135deg, #ef4444, #f43f5e)',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 800,
            borderRadius: '10px',
            minWidth: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            boxShadow: '0 0 8px rgba(244, 63, 94, 0.6)'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div 
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '46px',
            right: dropdownPos.right,
            width: dropdownPos.width,
            maxWidth: 'calc(100vw - 20px)',
            maxHeight: '480px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '14px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 20px rgba(99, 102, 241, 0.15)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header Popover */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={15} color="#818cf8" /> Thông Báo {unreadCount > 0 && <span style={{ color: '#f43f5e' }}>({unreadCount})</span>}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Đọc tất cả
              </button>
            )}
          </div>

          {/* List items */}
          <div style={{ overflowY: 'auto', maxHeight: '400px', display: 'flex', flexDirection: 'column' }}>
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid #1e293b',
                    background: n.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.08)',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: n.isRead ? 600 : 800, 
                      color: n.isRead ? 'var(--text-main)' : '#93c5fd',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1
                    }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-sub)', flexShrink: 0 }}>
                      {new Date(n.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35, wordBreak: 'break-word' }}>
                    {n.message}
                  </p>
                </div>
              ))
            ) : (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.82rem' }}>
                <CheckCheck size={24} style={{ opacity: 0.3, marginBottom: '6px' }} />
                <p>Bạn đã xem hết mọi thông báo!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// COMPONENT: THẢO LUẬN TRỰC TIẾP TRÊN HỒ SƠ (CASE DISCUSSION)
// ==========================================
export const CaseDiscussion = ({ caseId, token, currentUser }) => {
  const [comments, setComments] = useState([]);
  const [inputContent, setInputContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchComments = async () => {
    if (!caseId || !token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/cases/${caseId}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setComments(res.data.data.comments || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [caseId, token]);

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!inputContent.trim() || sending) return;

    setSending(true);
    try {
      const res = await axios.post(`${API_BASE}/cases/${caseId}/comments`, {
        content: inputContent.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success && res.data.data?.comment) {
        setComments(prev => [...prev, res.data.data.comment]);
        setInputContent('');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi gửi bình luận!');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      background: '#070b19',
      border: '1px solid #1e293b',
      borderRadius: '10px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
          <MessageCircle size={15} color="#38bdf8" /> Kênh Trao Đổi & Bình Luận ({comments.length})
        </h4>
        <button
          type="button"
          onClick={fetchComments}
          className="btn-secondary"
          style={{ padding: '2px 8px', fontSize: '0.7rem' }}
          title="Tải lại bình luận"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Comment List */}
      <div style={{
        maxHeight: '220px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingRight: '4px'
      }}>
        {comments.length > 0 ? (
          comments.map((cmt) => {
            const isMe = cmt.authorId === currentUser?.id;
            const isStaff = cmt.authorRole === 'REVIEWER' || cmt.authorRole === 'ADMIN';

            return (
              <div
                key={cmt.id}
                style={{
                  background: isStaff ? 'rgba(59, 130, 246, 0.08)' : 'rgba(15, 23, 42, 0.7)',
                  border: `1px solid ${isStaff ? 'rgba(59, 130, 246, 0.25)' : '#1e293b'}`,
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isStaff ? '#60a5fa' : '#34d399' }}>
                      {cmt.authorName}
                    </span>
                    <span style={{
                      fontSize: '0.64rem',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: isStaff ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: isStaff ? '#93c5fd' : '#6ee7b7',
                      fontWeight: 600
                    }}>
                      {cmt.authorRole === 'ADMIN' ? '🛡️ Admin' : (cmt.authorRole === 'REVIEWER' ? '🔍 Cán Bộ' : '🎓 Sinh Viên')}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-sub)' }}>
                    {new Date(cmt.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                  {cmt.content}
                </p>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-sub)', fontSize: '0.76rem' }}>
            Chưa có trao đổi nào. Bạn có thể để lại câu hỏi hoặc ghi chú tại đây.
          </div>
        )}
      </div>

      {/* Input box */}
      <form onSubmit={handleSendComment} style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          value={inputContent}
          onChange={e => setInputContent(e.target.value)}
          placeholder="Nhập câu hỏi hoặc giải trình thêm..."
          className="form-input"
          style={{ flex: 1, padding: '7px 10px', fontSize: '0.78rem' }}
        />
        <button
          type="submit"
          disabled={sending || !inputContent.trim()}
          className="btn-primary"
          style={{ padding: '7px 12px', fontSize: '0.78rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
          <span>Gửi</span>
        </button>
      </form>
    </div>
  );
};

// ==========================================
// COMPONENT: TRANG XÁC THỰC CÔNG KHAI QR CODE (/verify)
// ==========================================
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
    <div style={{
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
      <div style={{
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
            Hệ thống CaseFlow AI • Trường Đại Học Công Nghệ Quốc Gia
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#818cf8' }}>
            <RefreshCw size={24} className="animate-spin" style={{ marginBottom: '10px' }} />
            <p>Đang giải mã chữ ký số và xác minh chứng nhận...</p>
          </div>
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
                  Văn bản đã được số hóa và ký số điện tử trên hệ thống SQLite trường.
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
                <span style={{ color: 'var(--text-sub)' }}>Chữ ký số (HMAC-SHA256 Token):</span>
                <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(0,0,0,0.4)', padding: '6px 8px', borderRadius: '6px', marginTop: '4px' }}>
                  {data.digitalSignature}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '8px' }}>
              <button
                onClick={() => window.open(`${API_BASE}/cases/${data.caseId}/export-decision`, '_blank')}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={15} /> In / Lưu Bản PDF Quyết Định
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 3. HEADER CHUNG ĐA VAI TRÒ
// ==========================================
const AppHeader = ({ activeTab, setActiveTab, onOpen2FAModal }) => {
  const { user, token, logout } = useAuth();
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
    return 'CỔNG SINH VIÊN';
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
                CaseFlow AI
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

      </div>
    </header>
  );
};

// ==========================================
// 3.5. BỘ XEM NHẬT KÝ KIỂM TOÁN THEO NGÀY (AUDIT TRAIL VIEWER)
// ==========================================
const AuditTrailViewer = ({
  audits = [],
  token,
  onRefresh,
  loading = false,
  title = 'Nhật Ký Hoạt Động Toàn Trường (Audit Trail)',
  subtitle = 'Theo dõi minh bạch toàn bộ các hành động trên hệ thống theo ngày',
  showRoleFilter = true,
  isStudentView = false
}) => {
  const [dateFilterMode, setDateFilterMode] = useState('ALL'); // 'ALL', 'TODAY', 'YESTERDAY', '7DAYS', 'CUSTOM'
  const [customDate, setCustomDate] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupByDay, setGroupByDay] = useState(true);

  // Helper date strings
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date(Date.now() - 86400000);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
  const sevenDaysAgoDate = new Date(Date.now() - 7 * 86400000);
  const sevenDaysAgoStr = sevenDaysAgoDate.toISOString().slice(0, 10);

  // Counters
  const countToday = audits.filter(a => a.timestamp?.startsWith(todayStr)).length;
  const countYesterday = audits.filter(a => a.timestamp?.startsWith(yesterdayStr)).length;
  const count7Days = audits.filter(a => a.timestamp?.slice(0, 10) >= sevenDaysAgoStr).length;

  // Filtered Audits
  const filteredAudits = audits.filter(a => {
    const itemDate = a.timestamp?.slice(0, 10);
    
    // Date Filtering
    if (dateFilterMode === 'TODAY' && itemDate !== todayStr) return false;
    if (dateFilterMode === 'YESTERDAY' && itemDate !== yesterdayStr) return false;
    if (dateFilterMode === '7DAYS' && itemDate < sevenDaysAgoStr) return false;
    if (dateFilterMode === 'CUSTOM' && customDate && itemDate !== customDate) return false;

    // Role Filtering
    if (roleFilter !== 'ALL' && a.actor?.role !== roleFilter) return false;

    // Action Filtering
    if (actionFilter !== 'ALL' && a.action !== actionFilter) return false;

    // Search term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchAction = a.action?.toLowerCase().includes(q);
      const matchCase = a.caseId?.toLowerCase().includes(q);
      const matchName = a.actor?.name?.toLowerCase().includes(q) || a.actor?.username?.toLowerCase().includes(q);
      const matchReason = a.reason?.toLowerCase().includes(q);
      if (!matchAction && !matchCase && !matchName && !matchReason) return false;
    }

    return true;
  });

  // Group by date
  const groupedByDate = filteredAudits.reduce((acc, a) => {
    const dateKey = a.timestamp?.slice(0, 10) || 'KHÁC';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(a);
    return acc;
  }, {});

  const dateKeys = Object.keys(groupedByDate).sort().reverse();

  const getActionStyle = (action = '') => {
    if (action.includes('APPROVE') || action.includes('SUCCESS') || action.includes('ENABLE')) {
      return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
    }
    if (action.includes('REJECT') || action.includes('FAILED') || action.includes('DELETE') || action.includes('FORBIDDEN')) {
      return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
    }
    if (action.includes('ESCALAT') || action.includes('SUPPLEMENT') || action.includes('REVIEW') || action.includes('DISABLE')) {
      return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
    }
    if (action.includes('LOGIN') || action.includes('AUTH') || action.includes('PASSWORD')) {
      return { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' };
    }
    if (action.includes('OCR') || action.includes('UPLOAD')) {
      return { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' };
    }
    return { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.3)' };
  };

  const formatDateHeader = (dateStr) => {
    if (dateStr === todayStr) {
      return `📅 Hôm nay — ${new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    }
    if (dateStr === yesterdayStr) {
      return `📅 Hôm qua — ${yesterdayDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    }
    try {
      const d = new Date(dateStr);
      return `📅 ${d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    } catch {
      return `📅 Ngày: ${dateStr}`;
    }
  };

  const getExportDateParam = () => {
    if (dateFilterMode === 'TODAY') return `&date=${todayStr}`;
    if (dateFilterMode === 'YESTERDAY') return `&date=${yesterdayStr}`;
    if (dateFilterMode === 'CUSTOM' && customDate) return `&date=${customDate}`;
    return '';
  };

  return (
    <div className="card-panel" style={{ padding: '24px' }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff', margin: '0 0 4px 0' }}>
            <History size={22} color="var(--accent-primary)" />
            {title}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: 0 }}>
            {subtitle} • Hiển thị <strong>{filteredAudits.length}</strong> / <strong>{audits.length}</strong> bản ghi
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!isStudentView && token && (
            <button
              onClick={() => window.open(`${API_BASE}/audits/export-csv?token=${token}${getExportDateParam()}`, '_blank')}
              className="btn-secondary"
              style={{
                padding: '7px 14px',
                fontSize: '0.8rem',
                background: 'rgba(5, 150, 105, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(5, 150, 105, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px'
              }}
              title="Xuất danh sách hoạt động ra file CSV cho Excel"
            >
              <Download size={14} />
              <span>Xuất Bảng Audit {dateFilterMode !== 'ALL' ? '(Theo Ngày)' : 'CSV'}</span>
            </button>
          )}

          {onRefresh && (
            <button onClick={onRefresh} className="btn-secondary" style={{ padding: '7px 12px', fontSize: '0.8rem', borderRadius: '8px' }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Làm mới</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTER CONTROLS & DATE SELECTORS */}
      <div style={{
        background: 'rgba(9, 13, 26, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        
        {/* Quick Date Mode Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-sub)', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={14} color="#38bdf8" /> Xem theo ngày:
            </span>

            <button
              onClick={() => { setDateFilterMode('ALL'); setCustomDate(''); }}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 600,
                border: dateFilterMode === 'ALL' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                background: dateFilterMode === 'ALL' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: dateFilterMode === 'ALL' ? '#38bdf8' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Tất cả ngày ({audits.length})
            </button>

            <button
              onClick={() => { setDateFilterMode('TODAY'); setCustomDate(''); }}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 600,
                border: dateFilterMode === 'TODAY' ? '1px solid #34d399' : '1px solid rgba(255, 255, 255, 0.1)',
                background: dateFilterMode === 'TODAY' ? 'rgba(52, 211, 153, 0.2)' : 'transparent',
                color: dateFilterMode === 'TODAY' ? '#34d399' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              ⚡ Hôm nay ({countToday})
            </button>

            <button
              onClick={() => { setDateFilterMode('YESTERDAY'); setCustomDate(''); }}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 600,
                border: dateFilterMode === 'YESTERDAY' ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.1)',
                background: dateFilterMode === 'YESTERDAY' ? 'rgba(251, 191, 36, 0.2)' : 'transparent',
                color: dateFilterMode === 'YESTERDAY' ? '#fbbf24' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              📅 Hôm qua ({countYesterday})
            </button>

            <button
              onClick={() => { setDateFilterMode('7DAYS'); setCustomDate(''); }}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 600,
                border: dateFilterMode === '7DAYS' ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                background: dateFilterMode === '7DAYS' ? 'rgba(129, 140, 248, 0.2)' : 'transparent',
                color: dateFilterMode === '7DAYS' ? '#818cf8' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              7 ngày qua ({count7Days})
            </button>
          </div>

          {/* Group View Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="checkbox"
                checked={groupByDay}
                onChange={e => setGroupByDay(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Gom nhóm theo ngày</span>
            </label>
          </div>
        </div>

        {/* Input Controls Row */}
        <div style={{ display: 'grid', gridTemplateColumns: showRoleFilter ? '1.5fr 1fr 1fr 1fr' : '2fr 1fr 1fr', gap: '10px' }}>
          
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '32px', height: '36px', fontSize: '0.8rem' }}
              placeholder="Tìm theo hành động, người dùng, mã hồ sơ (#CASE)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Custom Date Picker */}
          <div style={{ position: 'relative' }}>
            <input
              type="date"
              className="form-input"
              style={{ height: '36px', fontSize: '0.8rem', color: customDate ? '#38bdf8' : 'var(--text-muted)' }}
              value={customDate}
              onChange={e => {
                setCustomDate(e.target.value);
                if (e.target.value) setDateFilterMode('CUSTOM');
                else setDateFilterMode('ALL');
              }}
            />
          </div>

          {/* Role Filter */}
          {showRoleFilter && (
            <select
              className="form-input"
              style={{ height: '36px', fontSize: '0.8rem' }}
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="ALL">👤 Tất cả vai trò</option>
              <option value="STUDENT">🎓 Sinh Viên</option>
              <option value="REVIEWER">🔍 Cán Bộ Thẩm Định</option>
              <option value="ADMIN">🛡️ Quản Trị Viên</option>
              <option value="GUEST">🌐 Khách / Vãng lai</option>
            </select>
          )}

          {/* Action Filter */}
          <select
            className="form-input"
            style={{ height: '36px', fontSize: '0.8rem' }}
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
          >
            <option value="ALL">⚡ Tất cả hành động</option>
            <option value="CASE_SUBMITTED">📝 Khởi tạo hồ sơ</option>
            <option value="CASE_STATUS_APPROVED">✅ Duyệt chấp thuận</option>
            <option value="CASE_STATUS_REJECTED">❌ Từ chối hồ sơ</option>
            <option value="CASE_STATUS_REQUIRES_SUPPLEMENT">🔄 Yêu cầu bổ sung</option>
            <option value="CASE_AUTO_APPROVED">⚡ Tự động duyệt (Rule Engine)</option>
            <option value="CASE_ESCALATED">🚨 Leo thang nghiệp vụ</option>
            <option value="AUTH_LOGIN">🔑 Đăng nhập hệ thống</option>
            <option value="USER_PROFILE_UPDATED">👤 Cập nhật hồ sơ</option>
            <option value="USER_PASSWORD_CHANGED">🔒 Đổi mật khẩu</option>
            <option value="EVIDENCE_UPLOADED">📎 Tải lên minh chứng</option>
            <option value="OCR_EXTRACTION_PERFORMED">✨ Quét OCR Gemini</option>
            <option value="REPORT_CSV_EXPORTED">📊 Xuất báo cáo CSV</option>
          </select>

        </div>

      </div>

      {/* AUDIT LOG LISTING (GROUPED OR FLAT) */}
      {filteredAudits.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#090d16', borderRadius: '12px', border: '1px dashed #334155', color: 'var(--text-sub)' }}>
          <CalendarDays size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
          <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600, margin: '0 0 4px 0' }}>
            Không tìm thấy bản ghi nhật ký nào
          </p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
            {customDate ? `Không có hoạt động nào trong ngày ${customDate}.` : 'Hãy thử thay đổi bộ lọc ngày hoặc từ khóa tìm kiếm.'}
          </p>
        </div>
      ) : groupByDay ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {dateKeys.map(dateKey => {
            const dayAudits = groupedByDate[dateKey] || [];
            return (
              <div key={dateKey} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                
                {/* Date Group Header */}
                <div style={{
                  background: 'linear-gradient(90deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.6) 100%)',
                  borderLeft: '4px solid #38bdf8',
                  borderRadius: '0 8px 8px 0',
                  padding: '8px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CalendarDays size={16} color="#38bdf8" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc' }}>
                      {formatDateHeader(dateKey)}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    {dayAudits.length} hoạt động
                  </span>
                </div>

                {/* Day Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '8px' }}>
                  {dayAudits.map((a, idx) => {
                    const badge = getActionStyle(a.action);
                    const timeStr = a.timestamp ? new Date(a.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
                    return (
                      <div
                        key={a.id || idx}
                        style={{
                          background: '#0f172a',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '10px',
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '14px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Time & Clock */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '68px', paddingTop: '2px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace' }}>
                            {timeStr}
                          </span>
                          <Clock size={13} color="#64748b" style={{ marginTop: '2px' }} />
                        </div>

                        {/* Content Area */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            
                            {/* Action Badge */}
                            <span style={{
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '5px',
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                              fontFamily: 'monospace'
                            }}>
                              {a.action}
                            </span>

                            {/* Case Link if available */}
                            {a.caseId && (
                              <span style={{
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: '5px',
                                background: 'rgba(56, 189, 248, 0.12)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                fontFamily: 'monospace'
                              }}>
                                #{a.caseId}
                              </span>
                            )}

                            {/* Actor Pill */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.74rem'
                            }}>
                              <User size={12} color="#94a3b8" />
                              <strong style={{ color: '#ffffff' }}>{a.actor?.name || a.actor?.username || 'Hệ thống'}</strong>
                              <span style={{
                                fontSize: '0.68rem',
                                color: a.actor?.role === 'ADMIN' ? '#f43f5e' : (a.actor?.role === 'REVIEWER' ? '#fbbf24' : '#38bdf8'),
                                fontWeight: 700
                              }}>
                                [{a.actor?.role || 'SYSTEM'}]
                              </span>
                            </div>
                          </div>

                          {/* Reason / Detail */}
                          <p style={{ fontSize: '0.84rem', color: '#e2e8f0', margin: 0, lineHeight: 1.45 }}>
                            {a.reason}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* Flat Timeline Mode */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredAudits.map((a, idx) => {
            const badge = getActionStyle(a.action);
            return (
              <div
                key={a.id || idx}
                style={{
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <Clock size={16} color="#818cf8" />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '5px',
                        background: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                        fontFamily: 'monospace'
                      }}>
                        {a.action}
                      </span>
                      {a.caseId && <span style={{ color: '#38bdf8', fontSize: '0.78rem', fontWeight: 700 }}>({a.caseId})</span>}
                    </div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-sub)' }}>
                      {new Date(a.timestamp).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-main)', margin: 0 }}>
                    <strong>{a.actor?.name || a.actor?.username}</strong> ({a.actor?.role}): {a.reason}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

// ==========================================
// 4. GIAO DIỆN SINH VIÊN (STUDENT PORTAL)
// ==========================================
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
      console.error('Lỗi tải dữ liệu sinh viên:', err);
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
          setToastMessage({ type: 'success', text: `✨ OCR đã trích xuất & tự động điền đơn: ${ocr.data.documentType}` });
        }
      }
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Lỗi quét OCR file minh chứng!');
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
                Minh chứng đính kèm & Tự động trích xuất thông tin bằng AI OCR
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
                      <span>{ocrScanning ? 'Đang trích xuất OCR...' : '✨ Quét OCR & Tự Động Điền'}</span>
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
                        <Sparkles size={14} color="#38bdf8" /> AI OCR: {ocrData.documentType}
                      </span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        Độ tin cậy: {Math.round((ocrData.confidenceScore || 0.96) * 100)}% • Tamper: {ocrData.tamperRisk || 'LOW'} (An toàn)
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.76rem', color: 'var(--text-sub)', marginTop: '4px' }}>
                      <div>• Sinh viên: <strong style={{ color: '#fff' }}>{ocrData.studentName}</strong> ({ocrData.studentCode})</div>
                      <div>• Đơn vị cấp: <strong style={{ color: '#fff' }}>{ocrData.issuingAuthority}</strong></div>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>
                      ℹ️ Đã tự động điền Tiêu đề, Phân loại và Nội dung giải trình từ minh chứng. Bạn có thể chỉnh sửa nếu cần.
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
                        Đã tối ưu VLM (-{file.metadata.savings})
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
                            src={c.reviewResult.reviewerAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
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
                              onClick={() => window.open(`${API_BASE}/cases/${c.id}/export-decision?token=${token}`, '_blank')}
                              className="btn-primary shimmer-button"
                              style={{ background: 'linear-gradient(135deg, #059669, #10b981)', fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Printer size={13} />
                              <span>In / Lưu Quyết Định PDF</span>
                            </button>
                            <button
                              onClick={() => window.open(`/verify?caseId=${c.id}`, '_blank')}
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
                        <Sparkles size={13} /> AI Kiểm tra: <strong>{c.aiExtraction.policyRuleMatch || 'Hợp lệ'}</strong>
                      </span>
                      <span style={{ color: '#34d399' }}>Độ tin cậy: {Math.round((c.aiExtraction.confidence || 0.95) * 100)}%</span>
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
          audits={myAudits}
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

// ==========================================
// 5. GIAO DIỆN THẨM ĐỊNH VIÊN (REVIEWER PORTAL)
// ==========================================
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
  const [loading, setLoading] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [reRouting, setReRouting] = useState(false);
  const [targetDepartment, setTargetDepartment] = useState('');
  const [previewModalImg, setPreviewModalImg] = useState(null);

  const [reviewReason, setReviewReason] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

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
    fetchReviewerData();
  }, []);

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

  const handleReviewAction = async (action) => {
    if (!reviewReason || reviewReason.trim().length < 5) {
      setActionMessage({ type: 'error', text: 'Vui lòng nhập lý do / hướng dẫn cụ thể (tối thiểu 5 ký tự)!' });
      return;
    }

    setReviewing(true);
    setActionMessage(null);

    try {
      const res = await axios.post(`${API_BASE}/cases/${selectedCase.id}/review`, {
        action,
        reason: reviewReason.trim()
      }, {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '8px' }}>
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
                    const isImg = f.fileUrl ? (f.fileUrl.endsWith('.webp') || f.fileUrl.endsWith('.png') || f.fileUrl.endsWith('.jpg') || f.fileUrl.endsWith('.jpeg')) : true;
                    const authToken = localStorage.getItem('token') || '';
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

// ==========================================
// 6. GIAO DIỆN ADMIN (QUẢN TRỊ & CẤP TÀI KHOẢN CÁN BỘ)
// ==========================================
const AdminPortal = ({ activeTab, setActiveTab }) => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState(null);

  // States tạo tài khoản cán bộ từ Admin
  const [newFullName, setNewFullName] = useState('');
  const [newStudentCode, setNewStudentCode] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('REVIEWER');
  const [newDepartment, setNewDepartment] = useState('Ban Giám Sát & Xét Duyệt');
  const [creatingUser, setCreatingUser] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (usersRes.data?.success) setUsers(usersRes.data.data.users);
      if (statsRes.data?.success) setStats(statsRes.data.data);
    } catch (err) {
      console.error('Lỗi tải dữ liệu quản trị:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleAdminCreateUser = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    setAdminMessage(null);

    try {
      const res = await axios.post(`${API_BASE}/admin/users/create`, {
        fullName: newFullName,
        studentCode: newRole === 'STUDENT' ? newStudentCode.trim() : undefined,
        username: newUsername,
        password: newPassword,
        role: newRole,
        department: newDepartment
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        setAdminMessage({ type: 'success', text: res.data.message });
        setNewFullName('');
        setNewStudentCode('');
        setNewUsername('');
        setNewPassword('');
        fetchAdminData();
      }
    } catch (err) {
      setAdminMessage({ type: 'error', text: err.response?.data?.message || 'Cấp tài khoản thất bại!' });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleChangeUserRole = async (userId, targetRole) => {
    try {
      const res = await axios.put(`${API_BASE}/admin/users/${userId}/role`, { role: targetRole }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setAdminMessage({ type: 'success', text: res.data.message });
        fetchAdminData();
      }
    } catch (err) {
      setAdminMessage({ type: 'error', text: err.response?.data?.message || 'Lỗi cập nhật quyền!' });
    }
  };

  const filteredUsers = users.filter(u => {
    if (!userSearchTerm.trim()) return true;
    const q = userSearchTerm.toLowerCase().trim();
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.studentCode?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {adminMessage && (
        <div style={{
          background: adminMessage.type === 'success' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(225, 29, 72, 0.15)',
          border: `1px solid ${adminMessage.type === 'success' ? 'rgba(5, 150, 105, 0.3)' : 'rgba(225, 29, 72, 0.3)'}`,
          borderRadius: '8px',
          padding: '12px 16px',
          color: adminMessage.type === 'success' ? '#34d399' : '#f87171',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {adminMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{adminMessage.text}</span>
        </div>
      )}

      {/* 1. TỔNG QUAN QUẢN TRỊ & CƠ CẤU HỒ SƠ */}
      {activeTab === 'admin_overview' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Bảng Điều Khiển Tổng Quan Quản Trị</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Theo dõi chỉ số KPI học vụ, trạng thái thẩm định và phân quyền toàn trường</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => window.open(`${API_BASE}/reports/export-csv?token=${token}`, '_blank')}
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.82rem', background: 'rgba(5, 150, 105, 0.15)', color: '#34d399', border: '1px solid rgba(5, 150, 105, 0.3)' }}
                title="Xuất dữ liệu toàn bộ hồ sơ ra file CSV / Excel UTF-8 BOM"
              >
                <Download size={14} /> Xuất Bảng CSV
              </button>
              <button
                onClick={() => window.open(`${API_BASE}/reports/export-cases-html?token=${token}`, '_blank')}
                className="btn-primary shimmer-button"
                style={{ background: 'linear-gradient(135deg, #059669, #10b981)', padding: '8px 14px', fontSize: '0.82rem' }}
                title="Xuất và in Báo Cáo Bảng Tổng Hợp dạng PDF"
              >
                <FileText size={14} /> In Báo Cáo Bảng (PDF)
              </button>
            </div>
          </div>

          {/* Hàng 4 Thẻ KPI Chính */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="card-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Tổng Số Hồ Sơ</span>
                <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '6px', borderRadius: '8px' }}>
                  <Layers size={18} color="#38bdf8" />
                </div>
              </div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#38bdf8' }}>{stats.totalCases}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.78rem', color: '#34d399' }}>
                <TrendingUp size={14} />
                <span><strong>+{stats.todayCasesCount || 0}</strong> hồ sơ mới trong 24h</span>
              </div>
            </div>

            <div className="card-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Hồ Sơ Chờ Xử Lý</span>
                <div style={{ background: 'rgba(251, 191, 36, 0.15)', padding: '6px', borderRadius: '8px' }}>
                  <Clock size={18} color="#fbbf24" />
                </div>
              </div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#fbbf24' }}>{stats.pendingCases}</h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Mới: <strong>{stats.statusBreakdown?.SUBMITTED || 0}</strong> • Duyệt lại: <strong>{stats.statusBreakdown?.RESUBMITTED || 0}</strong>
              </p>
            </div>

            <div className="card-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Tỷ Lệ Duyệt Thành Công</span>
                <div style={{ background: 'rgba(52, 211, 153, 0.15)', padding: '6px', borderRadius: '8px' }}>
                  <CheckCircle2 size={18} color="#34d399" />
                </div>
              </div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#34d399' }}>{stats.approvalRate}%</h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Đã duyệt: <strong style={{ color: '#34d399' }}>{stats.approvedCases}</strong> • Từ chối: <strong style={{ color: '#f87171' }}>{stats.rejectedCases}</strong>
              </p>
            </div>

            <div className="card-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase' }}>Người Dùng Hệ Thống</span>
                <div style={{ background: 'rgba(129, 140, 248, 0.15)', padding: '6px', borderRadius: '8px' }}>
                  <Users size={18} color="#818cf8" />
                </div>
              </div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#818cf8' }}>{stats.totalUsers}</h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                SV: <strong>{stats.roleBreakdown?.STUDENT || 0}</strong> • Cán bộ: <strong>{stats.roleBreakdown?.REVIEWER || 0}</strong> • Admin: <strong>{stats.roleBreakdown?.ADMIN || 0}</strong>
              </p>
            </div>
          </div>

          {/* HÀNG 2: CƠ CẤU TRẠNG THÁI & CƠ CẤU THEO DANH MỤC */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            
            {/* 1. Cơ cấu trạng thái hồ sơ hiện tại */}
            <div className="card-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PieChart size={18} color="#38bdf8" /> Cơ Cấu Trạng Thái Hồ Sơ
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tổng: <strong>{stats.totalCases}</strong> hồ sơ</span>
              </div>

              {/* Multi-segmented Progress Bar */}
              {stats.totalCases > 0 && (
                <div style={{
                  height: '10px',
                  borderRadius: '6px',
                  background: '#090d16',
                  display: 'flex',
                  overflow: 'hidden',
                  marginBottom: '20px',
                  gap: '2px'
                }}>
                  <div title={`Chờ thẩm định: ${stats.statusBreakdown?.SUBMITTED || 0}`} style={{ width: `${((stats.statusBreakdown?.SUBMITTED || 0) / stats.totalCases) * 100}%`, background: '#38bdf8' }} />
                  <div title={`Đang xử lý: ${stats.statusBreakdown?.UNDER_REVIEW || 0}`} style={{ width: `${((stats.statusBreakdown?.UNDER_REVIEW || 0) / stats.totalCases) * 100}%`, background: '#fbbf24' }} />
                  <div title={`Cần bổ sung: ${stats.statusBreakdown?.REQUIRES_SUPPLEMENT || 0}`} style={{ width: `${((stats.statusBreakdown?.REQUIRES_SUPPLEMENT || 0) / stats.totalCases) * 100}%`, background: '#f59e0b' }} />
                  <div title={`Đã bổ sung lại: ${stats.statusBreakdown?.RESUBMITTED || 0}`} style={{ width: `${((stats.statusBreakdown?.RESUBMITTED || 0) / stats.totalCases) * 100}%`, background: '#a5b4fc' }} />
                  <div title={`Đã phê duyệt: ${stats.statusBreakdown?.APPROVED || 0}`} style={{ width: `${((stats.statusBreakdown?.APPROVED || 0) / stats.totalCases) * 100}%`, background: '#34d399' }} />
                  <div title={`Đã từ chối: ${stats.statusBreakdown?.REJECTED || 0}`} style={{ width: `${((stats.statusBreakdown?.REJECTED || 0) / stats.totalCases) * 100}%`, background: '#f87171' }} />
                </div>
              )}

              {/* Grid 6 trạng thái chi tiết */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #38bdf8' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Chờ thẩm định (SUBMITTED)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                    {stats.statusBreakdown?.SUBMITTED || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.SUBMITTED || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #fbbf24' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Đang thẩm định (UNDER_REVIEW)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fbbf24', marginTop: '2px' }}>
                    {stats.statusBreakdown?.UNDER_REVIEW || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.UNDER_REVIEW || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Cần bổ sung hồ sơ</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>
                    {stats.statusBreakdown?.REQUIRES_SUPPLEMENT || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.REQUIRES_SUPPLEMENT || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #a5b4fc' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Đã nộp bổ sung (RESUBMITTED)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#a5b4fc', marginTop: '2px' }}>
                    {stats.statusBreakdown?.RESUBMITTED || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.RESUBMITTED || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #34d399' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Đã phê duyệt (APPROVED)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>
                    {stats.statusBreakdown?.APPROVED || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.APPROVED || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #f87171' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)' }}>Đã từ chối (REJECTED)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f87171', marginTop: '2px' }}>
                    {stats.statusBreakdown?.REJECTED || 0}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      ({stats.totalCases ? Math.round(((stats.statusBreakdown?.REJECTED || 0) / stats.totalCases) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Cơ cấu theo Danh mục hồ sơ */}
            <div className="card-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={18} color="#818cf8" /> Cơ Cấu Theo Danh Mục
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { label: '🎓 Miễn Giảm Học Phí', count: stats.categoryBreakdown?.TUITION_DISCOUNT || 0, color: '#38bdf8' },
                  { label: '🏆 Học Bổng Khuyến Khích', count: stats.categoryBreakdown?.ACADEMIC_SCHOLARSHIP || 0, color: '#fbbf24' },
                  { label: '🎖️ Điểm Rèn Luyện / MHX', count: stats.categoryBreakdown?.COMMUNITY_SERVICE || 0, color: '#818cf8' },
                  { label: '🆘 Hỗ Trợ Khó Khăn Đột Xuất', count: stats.categoryBreakdown?.EMERGENCY_AID || 0, color: '#f43f5e' }
                ].map((item, idx) => {
                  const pct = stats.totalCases > 0 ? Math.round((item.count / stats.totalCases) * 100) : 0;
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                        <span>{item.label}</span>
                        <span><strong>{item.count}</strong> ({pct}%)</span>
                      </div>
                      <div style={{ height: '7px', background: '#090d16', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: '4px', transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Thông số ưu tiên */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Độ ưu tiên:</span>
                <span>Khẩn cấp: <strong style={{ color: '#f43f5e' }}>{stats.priorityBreakdown?.URGENT || 0}</strong></span>
                <span>Cao: <strong style={{ color: '#fbbf24' }}>{stats.priorityBreakdown?.HIGH || 0}</strong></span>
                <span>Trung bình: <strong style={{ color: '#38bdf8' }}>{stats.priorityBreakdown?.MEDIUM || 0}</strong></span>
              </div>
            </div>

          </div>

          {/* PHÂN TÍCH HIỆU QUẢ RULE ENGINE & 5 NGUYÊN NHÂN LEO THANG NGHIỆP VỤ */}
          <div className="card-panel" style={{ padding: '24px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8' }}>
                  <Cpu size={20} color="#818cf8" /> Phân Tích Hiệu Quả Rule Engine & 5 Lý Do Leo Thang
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>
                  Gemini VLM trích xuất dữ kiện minh chứng • Rule Engine phán quyết tự động duyệt hoặc chuyển tiếp Hội đồng thẩm định
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  ⚡ Tự động duyệt: {stats.autoApprovedCases || 0} hồ sơ
                </span>
                <span style={{ fontSize: '0.78rem', background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                  🚨 Leo thang thẩm định: {stats.escalatedCases || 0} hồ sơ
                </span>
              </div>
            </div>

            {/* 5 Lý do leo thang chi tiết */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#090d16', borderLeft: '4px solid #ef4444', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#f87171', fontWeight: 700 }}>🔒 OWNERSHIP_UNCLEAR</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f87171' }}>{stats.escalationReasonsBreakdown?.OWNERSHIP_UNCLEAR || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>MSSV hoặc họ tên trên minh chứng không khớp tài khoản</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #f97316', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#fb923c', fontWeight: 700 }}>🚨 FACT_UNKNOWN</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fb923c' }}>{stats.escalationReasonsBreakdown?.FACT_UNKNOWN || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Thiếu file minh chứng / Ảnh mờ / OCR độ tin cậy &lt; 75%</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #eab308', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#facc15', fontWeight: 700 }}>⚠️ DATA_CONFLICT</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#facc15' }}>{stats.escalationReasonsBreakdown?.DATA_CONFLICT || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Mâu thuẫn thông tin tự kê khai với thực thể AI OCR</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #8b5cf6', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#c084fc', fontWeight: 700 }}>👑 AUTHORITY_REQUIRED</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c084fc' }}>{stats.escalationReasonsBreakdown?.AUTHORITY_REQUIRED || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Hồ sơ ưu tiên cao / Phúc khảo điểm / Xét duyệt Học bổng</p>
              </div>

              <div style={{ background: '#090d16', borderLeft: '4px solid #06b6d4', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', color: '#22d3ee', fontWeight: 700 }}>📋 POLICY_OUT_OF_SCOPE</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#22d3ee' }}>{stats.escalationReasonsBreakdown?.POLICY_OUT_OF_SCOPE || 0}</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>Yêu cầu ngoại lệ, cứu xét đặc biệt nằm ngoài quy chế</p>
              </div>
            </div>
          </div>

          {/* HÀNG 3: BẢNG HỒ SƠ MỚI TIẾP NHẬN GẦN ĐÂY */}
          {stats.recentCases && stats.recentCases.length > 0 && (
            <div className="card-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderPlus size={18} color="#34d399" /> Dòng Hồ Sơ Mới Tiếp Nhận Gần Đây
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>5 hồ sơ cập nhật mới nhất</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-sub)' }}>
                      <th style={{ padding: '8px' }}>Mã Đơn</th>
                      <th style={{ padding: '8px' }}>Sinh Viên</th>
                      <th style={{ padding: '8px' }}>Tiêu Đề Hồ Sơ</th>
                      <th style={{ padding: '8px' }}>Danh Mục</th>
                      <th style={{ padding: '8px' }}>Trạng Thái</th>
                      <th style={{ padding: '8px' }}>Thời Gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentCases.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', color: '#818cf8', fontWeight: 700 }}>{c.id}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{c.studentName}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-main)' }}>{c.title}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{c.category}</td>
                        <td style={{ padding: '10px 8px' }}>
                          {c.status === 'APPROVED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(5, 150, 105, 0.15)', color: '#34d399' }}>Đã duyệt</span>}
                          {c.status === 'REJECTED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(225, 29, 72, 0.15)', color: '#f87171' }}>Từ chối</span>}
                          {c.status === 'SUBMITTED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8' }}>Chờ duyệt</span>}
                          {c.status === 'UNDER_REVIEW' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(217, 119, 6, 0.15)', color: '#fbbf24' }}>Đang xử lý</span>}
                          {c.status === 'REQUIRES_SUPPLEMENT' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>Cần bổ sung</span>}
                          {c.status === 'RESUBMITTED' && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }}>Đã bổ sung</span>}
                        </td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-sub)', fontSize: '0.76rem' }}>
                          {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* 2. QUẢN LÝ NGƯỜI DÙNG & CẤP TÀI KHOẢN (REVIEWER / ADMIN / SINH VIÊN) */}
      {activeTab === 'admin_users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '24px' }}>
          
          {/* Form Cấp Tài Khoản Mới từ Admin */}
          <div className="card-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={18} color="var(--accent-primary)" /> Cấp Tài Khoản Mới
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '16px' }}>
              Chỉ Admin mới có quyền tạo và cấp phát tài khoản Ban Thẩm định và Quản trị viên:
            </p>

            <form onSubmit={handleAdminCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Họ và tên *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Trần Thị Mai Phương"
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Vai trò cấp quyền (Role) *
                </label>
                <select
                  className="form-input"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                >
                  <option value="REVIEWER">🔍 REVIEWER (Ban Thẩm định hồ sơ)</option>
                  <option value="ADMIN">🛡️ ADMIN (Quản trị viên cấp cao)</option>
                  <option value="STUDENT">🎓 STUDENT (Học sinh / Sinh viên)</option>
                </select>
              </div>

              {newRole === 'STUDENT' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    Mã số sinh viên (MSSV) *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="SV2026-9921, 22120001..."
                    value={newStudentCode}
                    onChange={e => setNewStudentCode(e.target.value.toUpperCase())}
                    required={newRole === 'STUDENT'}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Tên đăng nhập (Username) *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="reviewer2, admin2..."
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Mật khẩu khởi tạo *
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Tối thiểu 6 ký tự..."
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Khoa / Phòng ban
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ban Giám Sát, Phòng Đào Tạo..."
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={creatingUser}
                className="btn-primary"
                style={{ width: '100%', marginTop: '6px', height: '40px' }}
              >
                <UserPlus size={16} />
                <span>{creatingUser ? 'Đang cấp tài khoản...' : 'Cấp Phát Tài Khoản'}</span>
              </button>
            </form>
          </div>

          {/* Bảng Danh Sách & Đổi Role */}
          <div className="card-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="#38bdf8" /> Danh Sách Người Dùng ({filteredUsers.length}/{users.length})
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Tra cứu theo tên, MSSV, tài khoản và phân quyền linh hoạt</p>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Tìm tên, MSSV, user..."
                    value={userSearchTerm}
                    onChange={e => setUserSearchTerm(e.target.value)}
                    style={{ paddingLeft: '30px', paddingRight: userSearchTerm ? '26px' : '8px', fontSize: '0.78rem', height: '34px' }}
                  />
                  {userSearchTerm && (
                    <button
                      onClick={() => setUserSearchTerm('')}
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                      title="Xóa tìm kiếm"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => window.open(`${API_BASE}/admin/users/export-csv?token=${token}`, '_blank')}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', height: '34px', background: 'rgba(5, 150, 105, 0.15)', color: '#34d399', border: '1px solid rgba(5, 150, 105, 0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Xuất bảng người dùng ra file CSV"
                >
                  <Download size={13} />
                  <span>Xuất Bảng User</span>
                </button>
                <button onClick={fetchAdminData} className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem', height: '34px' }} title="Làm mới">
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '560px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-sub)' }}>
                    <th style={{ padding: '8px' }}>Họ Và Tên</th>
                    <th style={{ padding: '8px' }}>Mã SV (MSSV)</th>
                    <th style={{ padding: '8px' }}>Username</th>
                    <th style={{ padding: '8px' }}>Khoa / Ban</th>
                    <th style={{ padding: '8px' }}>Vai Trò</th>
                    <th style={{ padding: '8px' }}>Đổi Quyền</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>{u.fullName}</td>
                      <td style={{ padding: '10px 8px' }}>
                        {u.studentCode ? (
                          <span style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {u.studentCode}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#818cf8', fontFamily: 'var(--font-mono)' }}>{u.username}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{u.department}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span className={`badge badge-${u.role.toLowerCase()}`}>{u.role}</span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <select
                          className="form-input"
                          style={{ width: 'auto', padding: '3px 6px', fontSize: '0.75rem' }}
                          value={u.role}
                          onChange={e => handleChangeUserRole(u.id, e.target.value)}
                        >
                          <option value="STUDENT">STUDENT</option>
                          <option value="REVIEWER">REVIEWER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                    </tr>
                  ))}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-sub)' }}>
                        Không tìm thấy người dùng nào phù hợp với từ khóa "{userSearchTerm}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Tái sử dụng Reviewer Queue & Audit cho Admin */}
      {activeTab === 'reviewer_queue' && <ReviewerPortal activeTab="reviewer_queue" />}
      {activeTab === 'reviewer_audit' && <ReviewerPortal activeTab="reviewer_audit" />}
    </div>
  );
};

// ==========================================
// 7. TRANG AUTH (ĐĂNG NHẬP & TẠO TÀI KHOẢN SINH VIÊN)
// ==========================================
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

  // Register fields (Chỉ dành cho Sinh Viên)
  const [regFullName, setRegFullName] = useState('');
  const [regStudentCode, setRegStudentCode] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDepartment, setRegDepartment] = useState('Khoa Công Nghệ Thông Tin');

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
      setError('Vui lòng nhập đủ 6 chữ số OTP từ ứng dụng Authenticator!');
      return;
    }
    setVerifying2FA(true);
    setError('');
    const res = await login2FA(twoFactorChallenge.tempToken, twoFactorOtp);
    setVerifying2FA(false);
    if (!res.success) {
      setError(res.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
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
      
      {/* 1. FLOATING AMBIENT GLOW ORBS (CÁC ĐỐM SÁNG HUYỀN ẢO DI CHUYỂN) */}
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
            Hệ thống quản lý, xét duyệt & thẩm định hồ sơ sinh viên
          </p>

          {/* Feature Highlight Pills */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: '12px', background: 'rgba(79, 70, 229, 0.15)', color: '#818cf8', border: '1px solid rgba(79, 70, 229, 0.3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={11} /> AI Gemini Triage
            </span>
            <span style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              ⚡ Sharp WebP -95%
            </span>
            <span style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              🔒 JWT RBAC
            </span>
          </div>
        </div>

        {/* Tab switch giữa Đăng Nhập & Đăng Ký Sinh Viên */}
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
            Đăng Nhập
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
            Đăng Ký Sinh Viên
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>Xác Thực 2 Bước (2FA OTP)</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Tài khoản <strong>{twoFactorChallenge.username}</strong> yêu cầu mã OTP từ ứng dụng Authenticator.
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
                  ⚡ Nhập nhanh mã Bypass Demo (123456)
                </button>
              </div>

              <button
                type="submit"
                disabled={verifying2FA || !twoFactorOtp}
                className="btn-primary shimmer-button"
                style={{ height: '44px', fontWeight: 700 }}
              >
                {verifying2FA ? 'Đang xác thực OTP...' : 'Xác Thực & Đăng Nhập'}
              </button>

              <button
                type="button"
                onClick={() => { setTwoFactorChallenge(null); setTwoFactorOtp(''); setError(''); }}
                className="btn-secondary"
                style={{ height: '36px', fontSize: '0.8rem' }}
              >
                Quay lại đăng nhập
              </button>
            </form>
          </div>
        )}

        {/* 1. FORM ĐĂNG NHẬP */}
        {!twoFactorChallenge && mode === 'login' && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                Tên đăng nhập
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
                Mật khẩu
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} color="#818cf8" style={{ position: 'absolute', left: '12px' }} />
                <input
                  type="password"
                  className="form-input"
                  placeholder="Nhập mật khẩu (ví dụ: password123)..."
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
                  <span>Đang xác thực thông tin...</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Đăng Nhập Vào Hệ Thống</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* 2. FORM ĐĂNG KÝ TÀI KHOẢN SINH VIÊN */}
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
              ℹ️ Đăng ký công khai chỉ áp dụng cho <strong>Sinh viên</strong>. Tài khoản Thẩm định và Quản trị viên chỉ được cấp bởi Admin trường.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Họ và tên sinh viên *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={regFullName}
                  onChange={e => setRegFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Mã SV (MSSV) *
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
                  Tên đăng nhập *
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
                  Mật khẩu *
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Tối thiểu 6 ký tự"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                Khoa đào tạo
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Khoa Công Nghệ Thông Tin, Khoa Kinh Tế..."
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
              <span>{loading ? 'Đang tạo tài khoản sinh viên...' : 'Tạo Tài Khoản & Vào Hệ Thống'}</span>
            </button>
          </form>
        )}

        {/* 3. INTERACTIVE QUICK DEMO ACCOUNT SELECTOR (CHỌN NHANH VAI TRÒ DEMO) */}
        <div style={{
          marginTop: '22px',
          paddingTop: '18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '0.8rem',
          color: 'var(--text-sub)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#f59e0b" /> Chọn nhanh tài khoản Demo:
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mật khẩu: <code>password123</code></span>
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
              <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>🎓</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>Sinh Viên</div>
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
              <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>🔍</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fbbf24' }}>Thẩm Định</div>
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
              <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>🛡️</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f43f5e' }}>Quản Trị</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', marginTop: '2px' }}>admin1</div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

// ==========================================
// 7. MODAL XÁC THỰC 2 BƯỚC (2FA SETTINGS POPUP)
// ==========================================
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

// ==========================================
// 8. GIAO DIỆN CÀI ĐẶT TÀI KHOẢN (ACCOUNT SETTINGS PORTAL)
// ==========================================
const PRESET_AVATARS = [
  { label: 'Sinh viên Nam', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
  { label: 'Sinh viên Nữ', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80' },
  { label: 'Thẩm định viên', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' },
  { label: 'Giảng viên', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80' },
  { label: 'Công nghệ / AI', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80' },
  { label: 'Kỹ sư hệ thống', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80' },
  { label: 'Nghiên cứu sinh', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80' },
  { label: 'Quản trị viên', url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&auto=format&fit=crop&q=80' }
];

const AccountSettingsPortal = ({ onOpen2FAModal, onBack }) => {
  const { user, updateProfile, uploadAvatar, changePassword, deleteAccount } = useAuth();

  // Profile Form States
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [studentCode, setStudentCode] = useState(user?.studentCode || '');
  const [email, setEmail] = useState(user?.email || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);

  // Password Form States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState(null);

  // Delete Account States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassInput, setDeletePassInput] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Update local state when user updates
  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setStudentCode(user.studentCode || '');
      setEmail(user.email || '');
      setDepartment(user.department || '');
      setBio(user.bio || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  // Handle Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileFeedback(null);

    const res = await updateProfile({
      fullName,
      studentCode,
      email,
      department,
      bio,
      avatar
    });

    setSavingProfile(false);
    if (res.success) {
      setProfileFeedback({ type: 'success', message: res.message });
      setTimeout(() => setProfileFeedback(null), 4000);
    } else {
      setProfileFeedback({ type: 'error', message: res.message });
    }
  };

  // Handle Local Avatar Upload with Sharp WebP
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileFeedback({ type: 'error', message: 'Kích thước ảnh đại diện không được vượt quá 5MB!' });
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploadingAvatar(true);
    setProfileFeedback(null);

    const res = await uploadAvatar(formData);
    setUploadingAvatar(false);

    if (res.success) {
      if (res.avatar) setAvatar(res.avatar);
      setProfileFeedback({ type: 'success', message: '✨ Ảnh đại diện đã được tải lên và tối ưu hóa WebP thành công!' });
      setTimeout(() => setProfileFeedback(null), 4000);
    } else {
      setProfileFeedback({ type: 'error', message: res.message });
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!oldPassword) {
      setPasswordFeedback({ type: 'error', message: 'Vui lòng nhập mật khẩu hiện tại.' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'Mật khẩu xác nhận không khớp với mật khẩu mới.' });
      return;
    }

    setSavingPassword(true);
    const res = await changePassword(oldPassword, newPassword, confirmPassword);
    setSavingPassword(false);

    if (res.success) {
      setPasswordFeedback({ type: 'success', message: '🎉 Đổi mật khẩu thành công! Hãy lưu giữ mật khẩu mới an toàn.' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordFeedback(null), 5000);
    } else {
      setPasswordFeedback({ type: 'error', message: res.message });
    }
  };

  // Handle Delete Account
  const handleConfirmDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError('');

    if (!deletePassInput) {
      setDeleteError('Vui lòng nhập mật khẩu hiện tại để xác thực yêu cầu xóa tài khoản.');
      return;
    }

    setDeletingAccount(true);
    const res = await deleteAccount(deletePassInput);
    setDeletingAccount(false);

    if (!res.success) {
      setDeleteError(res.message);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', paddingBottom: '60px' }}>
      
      {/* Top Banner Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px 28px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
            padding: '14px',
            borderRadius: '14px',
            display: 'flex',
            boxShadow: '0 0 20px rgba(14, 165, 233, 0.4)'
          }}>
            <Settings size={28} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 4px 0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Cài Đặt Tài Khoản & Hồ Sơ Cá Nhân
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                background: user?.role === 'ADMIN' ? 'rgba(244, 63, 94, 0.2)' : (user?.role === 'REVIEWER' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(56, 189, 248, 0.2)'),
                color: user?.role === 'ADMIN' ? '#f43f5e' : (user?.role === 'REVIEWER' ? '#fbbf24' : '#38bdf8'),
                border: `1px solid ${user?.role === 'ADMIN' ? 'rgba(244, 63, 94, 0.4)' : (user?.role === 'REVIEWER' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(56, 189, 248, 0.4)')}`
              }}>
                {user?.role}
              </span>
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-sub)', margin: 0 }}>
              Quản lý thông tin cá nhân, cập nhật ảnh đại diện, viết lời giới thiệu, đổi mật khẩu và bảo mật 2FA
            </p>
          </div>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px' }}
          >
            Quay Lại Bảng Điều Khiển
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px' }}>
        
        {/* ==========================================
            CỘT 1: HỒ SƠ, AVATAR & GIỚI THIỆU BẢN THÂN
           ========================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card: Hồ Sơ & Giới Thiệu Bản Thân */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <User size={20} color="#38bdf8" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Hồ Sơ & Giới Thiệu Bản Thân
              </h3>
            </div>

            {profileFeedback && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '18px',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: profileFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${profileFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: profileFeedback.type === 'success' ? '#34d399' : '#f87171'
              }}>
                {profileFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span>{profileFeedback.message}</span>
              </div>
            )}

            {/* Avatar Section */}
            <div style={{
              background: 'rgba(9, 13, 26, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '14px',
              padding: '18px',
              marginBottom: '20px'
            }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '12px' }}>
                📸 Ảnh Đại Diện (Avatar)
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {/* Avatar Preview */}
                <div style={{ position: 'relative', width: '84px', height: '84px', flexShrink: 0 }}>
                  <img
                    src={avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                    alt="Avatar Preview"
                    style={{
                      width: '84px',
                      height: '84px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #38bdf8',
                      boxShadow: '0 0 20px rgba(56, 189, 248, 0.35)'
                    }}
                  />
                  {uploadingAvatar && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: 'rgba(0, 0, 0, 0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <RefreshCw size={20} color="#38bdf8" className="animate-spin" />
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label
                    htmlFor="avatar-file-input"
                    className="btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(59, 130, 246, 0.15))',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8'
                    }}
                  >
                    <Camera size={16} />
                    <span>{uploadingAvatar ? 'Đang tải & tối ưu WebP...' : 'Tải Lên Ảnh Mới (JPG, PNG, WEBP)'}</span>
                  </label>
                  <input
                    id="avatar-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarFileChange}
                    style={{ display: 'none' }}
                  />
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-sub)', margin: '6px 0 0 0' }}>
                    Tự động tối ưu hóa WebP chuẩn tỉ lệ 1:1, dung lượng tối đa 5MB.
                  </p>
                </div>
              </div>

              {/* Preset Avatars Selection */}
              <div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  Hoặc chọn nhanh avatar mẫu có sẵn:
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {PRESET_AVATARS.map((item, idx) => (
                    <img
                      key={idx}
                      src={item.url}
                      alt={item.label}
                      title={item.label}
                      onClick={() => setAvatar(item.url)}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        border: avatar === item.url ? '2px solid #38bdf8' : '2px solid transparent',
                        transform: avatar === item.url ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.2s',
                        boxShadow: avatar === item.url ? '0 0 10px rgba(56, 189, 248, 0.5)' : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: user?.role === 'STUDENT' ? '1fr 1fr' : '1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                    Họ và Tên:
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn An"
                  />
                </div>

                {user?.role === 'STUDENT' && (
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                      Mã Số Sinh Viên (MSSV):
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={studentCode}
                      onChange={e => setStudentCode(e.target.value)}
                      placeholder="SV2026-9921"
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                    Địa Chỉ Email:
                  </label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="user@caseflow.ai"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                    Khoa / Ban Phụ Trách:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    placeholder="Khoa Công Nghệ Thông Tin"
                  />
                </div>
              </div>

              {/* Bio / Giới thiệu bản thân */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    📝 Giới Thiệu Bản Thân (Bio):
                  </label>
                  <span style={{ fontSize: '0.74rem', color: bio.length > 450 ? '#f43f5e' : 'var(--text-muted)' }}>
                    {bio.length}/500 ký tự
                  </span>
                </div>
                <textarea
                  rows={4}
                  maxLength={500}
                  className="form-input"
                  style={{ resize: 'vertical', lineHeight: 1.5, minHeight: '90px' }}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Hãy viết vài dòng giới thiệu về bản thân, ngành học, định hướng nghề nghiệp hoặc sở thích cá nhân..."
                />
                <p style={{ fontSize: '0.74rem', color: 'var(--text-sub)', margin: '4px 0 0 0' }}>
                  Thông tin này sẽ hiển thị trong hồ sơ minh chứng và nhật ký thẩm định xử lý đơn.
                </p>
              </div>

              {/* Custom Avatar URL Field */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                  Liên kết ảnh đại diện tùy chỉnh (Avatar URL):
                </label>
                <input
                  type="url"
                  className="form-input"
                  value={avatar}
                  onChange={e => setAvatar(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="btn-primary shimmer-button"
                style={{
                  marginTop: '8px',
                  height: '44px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)'
                }}
              >
                <Save size={16} />
                <span>{savingProfile ? 'Đang lưu hồ sơ...' : 'Lưu Thay Đổi Hồ Sơ'}</span>
              </button>
            </form>
          </div>

        </div>

        {/* ==========================================
            CỘT 2: ĐỔI MẬT KHẨU, 2FA & XÓA TÀI KHOẢN
           ========================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card: Đổi Mật Khẩu */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <KeyRound size={20} color="#fbbf24" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Đổi Mật Khẩu
              </h3>
            </div>

            {passwordFeedback && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '18px',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: passwordFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${passwordFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: passwordFeedback.type === 'success' ? '#34d399' : '#f87171'
              }}>
                {passwordFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span>{passwordFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Mật khẩu hiện tại */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                  Mật Khẩu Hiện Tại:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showOldPass ? 'text' : 'password'}
                    required
                    className="form-input"
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    {showOldPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                  Mật Khẩu Mới (Tối thiểu 6 ký tự):
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    className="form-input"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Xác nhận mật khẩu mới */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                  Xác Nhận Mật Khẩu Mới:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    className="form-input"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && newPassword && (
                  <div style={{ marginTop: '6px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {newPassword === confirmPassword ? (
                      <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={14} /> Mật khẩu xác nhận khớp hoàn toàn
                      </span>
                    ) : (
                      <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={14} /> Mật khẩu xác nhận chưa khớp
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={savingPassword || !oldPassword || !newPassword || newPassword !== confirmPassword}
                className="btn-primary shimmer-button"
                style={{
                  marginTop: '8px',
                  height: '44px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #d97706, #f59e0b)'
                }}
              >
                <Key size={16} />
                <span>{savingPassword ? 'Đang cập nhật mật khẩu...' : 'Cập Nhật Mật Khẩu Mới'}</span>
              </button>
            </form>
          </div>

          {/* Card: Xác Thực 2FA Shortcut */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} color={user?.twoFactorEnabled ? '#34d399' : '#fbbf24'} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  Xác Thực 2 Bước (2FA TOTP)
                </h3>
              </div>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                background: user?.twoFactorEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: user?.twoFactorEnabled ? '#34d399' : '#fbbf24',
                border: `1px solid ${user?.twoFactorEnabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
              }}>
                {user?.twoFactorEnabled ? 'ĐANG BẬT' : 'CHƯA BẬT'}
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Bảo vệ tài khoản an toàn với Google Authenticator / Microsoft Authenticator. Mỗi lần đăng nhập sẽ yêu cầu mã OTP 6 chữ số theo thời gian thực.
            </p>

            <button
              onClick={onOpen2FAModal}
              className="btn-secondary"
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: user?.twoFactorEnabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                border: `1px solid ${user?.twoFactorEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                color: user?.twoFactorEnabled ? '#34d399' : '#fbbf24'
              }}
            >
              <ShieldAlert size={16} />
              <span>{user?.twoFactorEnabled ? 'Cấu Hình Lại / Tắt 2FA' : 'Kích Hoạt Bảo Mật 2FA Ngay'}</span>
            </button>
          </div>

          {/* Card: Danger Zone (Xóa Tài Khoản) */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(239, 68, 68, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertTriangle size={20} color="#f43f5e" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f43f5e' }}>
                Khu Vực Nguy Hiểm (Danger Zone)
              </h3>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Khi xóa tài khoản, toàn bộ dữ liệu phiên làm việc, quyền truy cập và thông tin đăng nhập của bạn sẽ bị xóa vĩnh viễn khỏi cơ sở dữ liệu SQLite và không thể phục hồi.
            </p>

            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(true);
                setDeleteError('');
                setDeletePassInput('');
              }}
              className="btn-danger"
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                boxShadow: '0 4px 15px rgba(220, 38, 38, 0.35)'
              }}
            >
              <Trash2 size={16} />
              <span>Xóa Tài Khoản Vĩnh Viễn</span>
            </button>
          </div>

        </div>

      </div>

      {/* Modal Xác Nhận Xóa Tài Khoản */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 10px 40px rgba(239, 68, 68, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
                <Trash2 size={24} color="#f43f5e" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#f43f5e' }}>
                  Xác Nhận Xóa Tài Khoản
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-sub)', margin: 0 }}>
                  Hành động này không thể hoàn tác!
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: '20px' }}>
              Bạn đang yêu cầu xóa tài khoản <strong>{user?.username}</strong> ({user?.fullName}). Vui lòng nhập mật khẩu hiện tại của bạn để hoàn tất xác nhận:
            </p>

            {deleteError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.82rem',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{deleteError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDeleteAccount}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                  Mật Khẩu Xác Nhận:
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  className="form-input"
                  value={deletePassInput}
                  onChange={e => setDeletePassInput(e.target.value)}
                  placeholder="Nhập mật khẩu của bạn..."
                  style={{ borderColor: '#ef4444' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-secondary"
                  style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '0.86rem' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={deletingAccount || !deletePassInput}
                  className="btn-danger"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {deletingAccount ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  <span>{deletingAccount ? 'Đang xóa...' : 'Xác Nhận Xóa'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

// ==========================================
// 9. ĐIỀU HƯỚNG TỔNG QUAN
// ==========================================
function MainApp() {
  const { user } = useAuth();
  const [show2FAModal, setShow2FAModal] = useState(false);
  
  const getDefaultTab = (role) => {
    if (role === 'ADMIN') return 'admin_overview';
    if (role === 'REVIEWER') return 'reviewer_queue';
    return 'student_submit';
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab(user?.role));

  useEffect(() => {
    if (user) {
      setActiveTab(getDefaultTab(user.role));
    }
  }, [user]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%', background: 'transparent' }}>
      <AppHeader activeTab={activeTab} setActiveTab={setActiveTab} onOpen2FAModal={() => setShow2FAModal(true)} />
      
      <main style={{ flex: 1, width: '100%', maxWidth: '100%', margin: '0', padding: '16px 24px', boxSizing: 'border-box' }}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/verify" element={<PublicVerificationPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                {activeTab === 'account_settings' ? (
                  <AccountSettingsPortal 
                    onOpen2FAModal={() => setShow2FAModal(true)} 
                    onBack={() => setActiveTab(getDefaultTab(user?.role))}
                  />
                ) : (
                  <>
                    {user?.role === 'ADMIN' && (
                      <AdminPortal activeTab={activeTab} setActiveTab={setActiveTab} />
                    )}
                    {user?.role === 'REVIEWER' && (
                      <ReviewerPortal activeTab={activeTab} setActiveTab={setActiveTab} />
                    )}
                    {user?.role === 'STUDENT' && (
                      <StudentPortal activeTab={activeTab} setActiveTab={setActiveTab} />
                    )}
                  </>
                )}
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Standalone Full-Screen 2FA Modal */}
      <TwoFactorModal
        isOpen={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        user={user}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <MainApp />
      </Router>
    </AuthProvider>
  );
}
