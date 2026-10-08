import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bell, CheckCheck } from 'lucide-react';
import { API_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const NotificationBell = () => {
  const { token } = useAuth();
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

export default NotificationBell;
