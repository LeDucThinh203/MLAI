import React from 'react';
import AgentActionCard from './AgentActionCard';
import AgentSources from './AgentSources';

export default function AgentMessage({ item, onConfirm, onCancel, busy }) {
  const isUser = item.role === 'USER';
  const metadata = item.metadata || {};
  const isSystem = item.role === 'SYSTEM_SUMMARY';
  return (
    <article className={`agent-message ${isUser ? 'is-user' : 'is-agent'} ${isSystem ? 'is-system' : ''}`}>
      <div className="agent-message-label">{isUser ? 'Bạn' : isSystem ? 'Cập nhật' : 'EDUASSISTANT AI Agent'}</div>
      {!isUser && !isSystem && metadata.provider && <span className={`agent-provider-badge provider-${String(metadata.provider).toLowerCase().replace(/[^a-z]+/g, '-')}`}>{metadata.provider}{metadata.fallback ? ' · dự phòng' : ''}</span>}
      <div className="agent-message-content">{item.content}</div>
      {!isUser && metadata.dataSources?.length > 0 && (
        <div className="agent-live-data">Dữ liệu hệ thống trực tiếp · {metadata.dataSources.filter(value => value.includes('CASE-')).slice(0, 3).join(', ') || 'đã truy vấn dữ liệu được phân quyền'}</div>
      )}
      {!isUser && <AgentSources sources={metadata.sources || []} />}
      {metadata.pendingAction?.status === 'PENDING' && (
        <AgentActionCard action={metadata.pendingAction} onConfirm={onConfirm} onCancel={onCancel} busy={busy} />
      )}
    </article>
  );
}
