import React from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import AgentActionCard from './AgentActionCard';

export default function AgentMessage({ item, onConfirm, onCancel, busy }) {
  const isUser = item.role === 'USER';
  const metadata = item.metadata || {};
  const attachment = metadata.attachment;
  const isSystem = item.role === 'SYSTEM_SUMMARY';
  const ocrProviderLabel = attachment?.ocrProvider?.startsWith('Google Gemini')
    ? 'Google Gemini'
    : attachment?.ocrProvider?.startsWith('OpenRouter') ? 'OpenRouter' : '';
  return (
    <article className={`agent-message ${isUser ? 'is-user' : 'is-agent'} ${isSystem ? 'is-system' : ''}`}>
      <div className="agent-message-label">{isUser ? 'Bạn' : isSystem ? 'Cập nhật' : 'Trợ lý EDUASSISTANT'}</div>
      {!isUser && !isSystem && metadata.fallback && <span className="agent-provider-badge">Trợ lý đang trả lời ở chế độ dự phòng</span>}
      {attachment && (
        <div className="agent-message-attachment">
          {attachment.mimeType?.startsWith('image/')
            ? <ImageIcon size={19} aria-hidden="true" />
            : <FileText size={19} aria-hidden="true" />}
          <div>
            <strong title={attachment.originalName}>{attachment.originalName || 'Tệp đính kèm'}</strong>
            {attachment.ocrStatus === 'READ' && <span>Đã đọc nội dung{ocrProviderLabel ? ` · ${ocrProviderLabel}` : ''}</span>}
            {attachment.ocrStatus === 'UNAVAILABLE' && <span>OCR chưa đọc được</span>}
            {attachment.ocrStatus === 'UPLOADING' && <span>Đang tải lên…</span>}
          </div>
        </div>
      )}
      <div className="agent-message-content">{item.content}</div>
      {!isUser && metadata.dataSources?.length > 0 && (
        <div className="agent-live-data">Đã tra cứu thông tin hệ thống{metadata.dataSources.filter(value => value.includes('CASE-')).length > 0 ? ` · ${metadata.dataSources.filter(value => value.includes('CASE-')).slice(0, 3).join(', ')}` : ''}</div>
      )}
      {metadata.pendingAction?.status === 'PENDING' && (
        <AgentActionCard action={metadata.pendingAction} onConfirm={onConfirm} onCancel={onCancel} busy={busy} />
      )}
    </article>
  );
}
