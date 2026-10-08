import React from 'react';
import { CheckCircle2, X, Timer } from 'lucide-react';

export const renderSlaBadge = (c) => {
  if (c.status === 'APPROVED') {
    return (
      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <CheckCircle2 size={11} /> Đã hoàn thành
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
        <Timer size={11} /> 🚨 Đã quá thời hạn xử lý ({overdueH} giờ)
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
      <Timer size={11} /> ⏳ Còn khoảng {remainH} giờ để xử lý
    </span>
  );
};

export const formatDate = (dateString) => {
  if (!dateString) return '---';
  try {
    const d = new Date(dateString);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
};
