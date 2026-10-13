import React from 'react';
import AgentActionCard from './AgentActionCard';
import AgentSources from './AgentSources';

export default function AgentMessage({ item, onConfirm, onCancel, busy }) {
  const isUser = item.role === 'USER';
  const metadata = item.metadata || {};
  const isSystem = item.role === 'SYSTEM_SUMMARY';
  return (
    <article className={`agent-message ${isUser ? 'is-user' : 'is-agent'} ${isSystem ? 'is-system' : ''}`}>
      <div className="agent-message-label">{isUser ? 'Bạn' : isSystem ? 'Cập nhật' : 'Trợ lý EDUASSISTANT'}</div>
      {!isUser && !isSystem && metadata.fallback && <span className="agent-provider-badge">Trợ lý đang trả lời ở chế độ dự phòng</span>}
      <div className="agent-message-content">{item.content}</div>
      {!isUser && metadata.dataSources?.length > 0 && (
        <div className="agent-live-data">Đã tra cứu thông tin hệ thống{metadata.dataSources.filter(value => value.includes('CASE-')).length > 0 ? ` · ${metadata.dataSources.filter(value => value.includes('CASE-')).slice(0, 3).join(', ')}` : ''}</div>
      )}
      {!isUser && <AgentSources sources={metadata.sources || []} />}
      {metadata.pendingAction?.status === 'PENDING' && (
        <AgentActionCard action={metadata.pendingAction} onConfirm={onConfirm} onCancel={onCancel} busy={busy} />
      )}
    </article>
  );
}
