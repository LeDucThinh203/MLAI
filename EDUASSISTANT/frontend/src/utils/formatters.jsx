import React from 'react';
import { CheckCircle2, X, Timer } from 'lucide-react';

const SLA_HOURS = 48;

export const getSlaDeadlineMs = (c) => {
  const storedDeadline = new Date(c.deadline).getTime();
  if (c.deadline && Number.isFinite(storedDeadline)) return storedDeadline;

  const createdAt = new Date(c.createdAt).getTime();
  return Number.isFinite(createdAt) ? createdAt + SLA_HOURS * 3600 * 1000 : Date.now() + SLA_HOURS * 3600 * 1000;
};

const formatSlaDuration = (hours) => {
  const totalHours = Math.max(1, Math.round(Math.abs(hours)));
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  return days ? `${days} ngày${remainingHours ? ` ${remainingHours} giờ` : ''}` : `${totalHours} giờ`;
};

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

  const deadlineMs = getSlaDeadlineMs(c);
  const nowMs = Date.now();
  const diffHours = (deadlineMs - nowMs) / (1000 * 3600);
  const deadlineText = new Date(deadlineMs).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const tooltip = `Hạn xử lý: ${deadlineText}. Thời hạn chuẩn: ${SLA_HOURS} giờ kể từ lúc nộp hồ sơ.`;

  if (diffHours < 0) {
    return (
      <span title={tooltip} style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', background: 'rgba(225, 29, 72, 0.25)', color: '#f43f5e', border: '1px solid #ef4444', display: 'inline-flex', alignItems: 'center', gap: '4px', animation: 'pulse 2s infinite', cursor: 'help' }}>
        <Timer size={11} /> Quá hạn {formatSlaDuration(diffHours)}
      </span>
    );
  }

  if (diffHours <= 12) {
    return (
      <span title={tooltip} style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'help' }}>
        <Timer size={11} /> Sắp đến hạn · còn {formatSlaDuration(diffHours)}
      </span>
    );
  }

  return (
    <span title={tooltip} style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'help' }}>
      <Timer size={11} /> Còn {formatSlaDuration(diffHours)} để xử lý
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
