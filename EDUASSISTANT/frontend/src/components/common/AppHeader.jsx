import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { BarChart3, FileText, GraduationCap, History, Inbox, LoaderCircle, LogOut, PlusCircle, Settings, Shield, ShieldAlert, UserCheck, Users } from 'lucide-react';
import { API_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../notifications/NotificationBell';
import { safeImageUrl } from '../../utils/security';

const PORTAL = {
  STUDENT: { title: 'Cổng sinh viên', subtitle: 'Dịch vụ học vụ trực tuyến', icon: GraduationCap, tabs: [['student_submit', 'Nộp hồ sơ', PlusCircle], ['student_cases', 'Hồ sơ của tôi', FileText], ['student_history', 'Lịch sử', History]] },
  REVIEWER: { title: 'Cổng thẩm định hồ sơ', subtitle: 'Ban giám sát và xét duyệt', icon: UserCheck, tabs: [['reviewer_queue', 'Hàng đợi', Inbox], ['reviewer_audit', 'Nhật ký', History]] },
  ADMIN: { title: 'Cổng quản trị', subtitle: 'Điều hành hệ thống học vụ', icon: Shield, tabs: [['admin_overview', 'Tổng quan', BarChart3], ['admin_users', 'Tài khoản', Users], ['reviewer_queue', 'Thẩm định', Inbox], ['reviewer_audit', 'Nhật ký', History]] }
};

const AppHeader = ({ activeTab, setActiveTab, onOpen2FAModal, onOpenCase }) => {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const [aiStatus, setAiStatus] = useState({ isConfigured: false, displayLabel: 'AI status unavailable' });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const portal = PORTAL[user?.role] || { title: 'Hệ thống quản lý hồ sơ', subtitle: 'Trường đại học', icon: Shield, tabs: [] };
  const PortalIcon = portal.icon;

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE}/system/ai-status`, { withCredentials: true })
      .then(res => {
        if (res.data?.success && res.data.data) {
          setAiStatus({
            isConfigured: res.data.data.isConfigured,
            displayLabel: res.data.data.displayLabel || (res.data.data.isConfigured ? 'Gemini Live' : 'AI unavailable – Safe Human Review')
          });
        }
      })
      .catch(() => undefined);
  }, [token]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const roleLabel = user?.role === 'ADMIN' ? 'Quản trị viên' : user?.role === 'REVIEWER' ? 'Cán bộ thẩm định' : 'Sinh viên';
  const guestLinks = [['/login', 'Đăng nhập'], ['/verify', 'Tra cứu hồ sơ'], ['/judge', 'Ban giám khảo']];
  const homePath = user && portal.tabs[0]?.[0] ? `/?tab=${portal.tabs[0][0]}` : '/';

  return (
    <header className="app-header">
      <div className="app-header__bar">
        <Link className="brand-block" to={homePath} title="Về trang chủ" aria-label="Về trang chủ">
          <div className={`brand-mark brand-mark--${user?.role?.toLowerCase() || 'guest'}`}><PortalIcon size={22} /></div>
          <div><div className="brand-title">{portal.title}<span>EDUASSISTANT</span></div><p>{user?.department || portal.subtitle}</p></div>
        </Link>
        {user ? <nav className="portal-nav" aria-label="Điều hướng chính">
          {portal.tabs.map(([key, label, Icon]) => <button key={key} className={activeTab === key ? 'is-active' : ''} onClick={() => setActiveTab(key)}><Icon size={15} />{label}</button>)}
        </nav> : <nav className="portal-nav portal-nav--guest" aria-label="Điều hướng công khai">
          {guestLinks.map(([to, label]) => <Link key={to} className={location.pathname === to ? 'is-active' : ''} to={to}>{label}</Link>)}
        </nav>}
        {user && <div className="header-actions">
          {user.role !== 'STUDENT' && (
            <div
              className="ai-status"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '20px', background: 'rgba(15, 23, 42, 0.05)', border: '1px solid rgba(148, 163, 184, 0.2)' }}
              title={aiStatus.displayLabel}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: aiStatus.isConfigured ? '#10b981' : '#f59e0b',
                  boxShadow: aiStatus.isConfigured ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none'
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                {aiStatus.displayLabel}
              </span>
            </div>
          )}
          <NotificationBell onOpenCase={onOpenCase} />
          <button className="profile-summary" onClick={() => setActiveTab('account_settings')} title="Mở thông tin tài khoản"><img src={safeImageUrl(user.avatar, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')} alt="" /><span><strong>{user.fullName || user.username}</strong><small>{roleLabel}</small></span></button>
          <button className="header-icon-button" onClick={() => setActiveTab('account_settings')} title="Cài đặt tài khoản"><Settings size={17} /><span>Cài đặt</span></button>
          <button className={`two-factor-button ${user.twoFactorEnabled ? 'is-enabled' : ''}`} onClick={onOpen2FAModal}><ShieldAlert size={16} /><span>{user.twoFactorEnabled ? '2FA đã bật' : 'Bật 2FA'}</span></button>
          <button type="button" className="logout-button" onClick={handleLogout} disabled={isLoggingOut} aria-busy={isLoggingOut}>
            {isLoggingOut ? <LoaderCircle className="animate-spin" size={16} /> : <LogOut size={16} />}
            <span>{isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</span>
          </button>
        </div>}
      </div>
    </header>
  );
};

export default AppHeader;
