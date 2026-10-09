import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bell, CheckCheck } from 'lucide-react';
import { API_BASE, SERVER_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const NotificationBell = ({ onOpenCase }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const bellContainerRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ right: '0px', width: '360px' });

  const fetchNotifs = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_BASE}/notifications`);
      if (res.data?.success) {
        const items = res.data.data?.notifications || res.data.data || [];
        setNotifications(items);
        setUnreadCount(items.filter(item => !item.isRead).length);
      }
    } catch {}
  };

  useEffect(() => {
    fetchNotifs();
    if (!user) return undefined;
    const socket = new WebSocket(`${SERVER_BASE.replace(/^http/, 'ws')}/ws/cases`);
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data);
        if (event.type !== 'notification_created' || !event.notification) return;
        setNotifications(current => [event.notification, ...current]);
        setUnreadCount(current => current + 1);
      } catch { /* Ignore malformed realtime payloads. */ }
    };
    return () => socket.close();
  }, [user]);

  // Tự động tính toán vị trí để popup không bao giờ bị khuất/tràn khỏi mép màn hình
  useEffect(() => {
    if (open && bellContainerRef.current) {
      const rect = bellContainerRef.current.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const targetWidth = Math.min(420, screenWidth - 24);

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
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/notifications/read-all`, {}, {
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) await handleMarkAsRead(notification.id);
    setOpen(false);
    if (notification.caseId) onOpenCase?.(notification.caseId);
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
            maxHeight: '540px',
            background: '#111c31',
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
            padding: '14px 18px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={17} color="#a5b4fc" /> Thông báo {unreadCount > 0 && <span style={{ color: '#fda4af' }}>({unreadCount})</span>}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', color: '#7dd3fc', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700, padding: '5px 8px' }}
              >
                Đọc tất cả
              </button>
            )}
          </div>

          {/* List items */}
          <div style={{ overflowY: 'auto', maxHeight: '450px', display: 'flex', flexDirection: 'column' }}>
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <button
                  type="button"
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  title={n.caseId ? `Mở hồ sơ ${n.caseId}` : 'Đánh dấu thông báo đã xem'}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 18px',
                    borderBottom: '1px solid #1e293b',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    background: n.isRead ? 'rgba(15, 23, 42, 0.35)' : 'rgba(99, 102, 241, 0.16)',
                    color: '#e2e8f0',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '7px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      fontSize: '0.93rem',
                      fontWeight: n.isRead ? 600 : 800, 
                      color: n.isRead ? '#e2e8f0' : '#dbeafe',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1
                    }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0, fontWeight: 600 }}>
                      {new Date(n.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.86rem', color: '#cbd5e1', margin: 0, lineHeight: 1.55, wordBreak: 'break-word' }}>
                    {n.message}
                  </p>
                  {n.caseId && <span style={{ fontSize: '0.78rem', color: '#7dd3fc', fontWeight: 800, marginTop: '2px' }}>Mở hồ sơ {n.caseId} →</span>}
                </button>
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

export default NotificationBell;
