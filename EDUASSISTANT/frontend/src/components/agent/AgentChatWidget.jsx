import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Bot, MessageCircle, Minus, Plus, Send, X } from 'lucide-react';
import { API_BASE } from '../../api/client';
import AgentMessage from './AgentMessage';
import './AgentChatWidget.css';
import { USER_ROLE_LABELS, labelFor } from '../../utils/displayLabels';

const prompts = {
  STUDENT: [
    'Hồ sơ của tôi đang được xử lý đến đâu?',
    'Tôi cần chuẩn bị giấy tờ gì để nộp hồ sơ?',
    'Kiểm tra cách viết địa chỉ giúp tôi.',
    'Xem thông tin sinh viên nhà trường đang lưu.'
  ],
  REVIEWER: [
    'Hồ sơ nào đang chờ tôi xử lý?',
    'Tóm tắt hồ sơ CASE-2026-1234.',
    'Giải thích vì sao hồ sơ CASE-2026-1234 cần cán bộ kiểm tra thêm.',
    'Kiểm tra lại hồ sơ CASE-2026-1234.'
  ],
  ADMIN: [
    'Tình trạng hệ thống hiện nay?',
    'Liệt kê dữ liệu sinh viên mẫu chưa được xác nhận.',
    'Giải thích quy định đang áp dụng.',
    'Xem mức tin cậy hiện tại.'
  ]
};

function responsePayload(response) {
  if (response?.data?.success) return response.data.data;
  throw new Error(response?.data?.message || 'Không thể kết nối với trợ lý EDUASSISTANT.');
}

export default function AgentChatWidget({ user, onOpenCase }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE}/agent/conversations`).then(response => {
      const data = responsePayload(response);
      if (!active) return;
      const rows = data?.conversations || [];
      setConversations(rows);
      if (rows[0]?.id) {
        setConversationId(rows[0].id);
        return axios.get(`${API_BASE}/agent/conversations/${encodeURIComponent(rows[0].id)}`).then(detailResponse => {
          const detail = responsePayload(detailResponse)?.conversation;
          if (active && detail) setMessages(detail.messages || []);
        });
      }
      return null;
    }).catch(() => {
      // Agent history is optional when the service is unavailable.
    });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: loading ? 'smooth' : 'auto', block: 'end' });
  }, [messages, loading]);

  const refreshConversations = async () => {
    try {
      const data = responsePayload(await axios.get(`${API_BASE}/agent/conversations`));
      setConversations(data?.conversations || []);
    } catch {
      // Keep the active chat usable if the history list cannot refresh.
    }
  };

  const startConversation = async () => {
    setError('');
    try {
      const data = responsePayload(await axios.post(`${API_BASE}/agent/conversations`, { title: 'Cuộc trò chuyện mới' }));
      const conversation = data.conversation;
      setConversationId(conversation.id);
      setMessages([]);
      await refreshConversations();
      textareaRef.current?.focus();
    } catch (err) {
      setError(err.message || 'Không thể tạo hội thoại mới.');
    }
  };

  const selectConversation = async (event) => {
    const selected = event.target.value;
    setConversationId(selected || null);
    setMessages([]);
    setError('');
    if (!selected) return;
    try {
      const data = responsePayload(await axios.get(`${API_BASE}/agent/conversations/${encodeURIComponent(selected)}`));
      setMessages(data?.conversation?.messages || []);
    } catch (err) {
      setError(err.message || 'Không thể tải hội thoại.');
    }
  };

  const sendMessage = async (value = draft) => {
    const message = value.trim();
    if (!message || loading) return;
    setError('');
    setDraft('');
    setLoading(true);
    setMessages(current => [...current, { id: `local-user-${Date.now()}`, role: 'USER', content: message }]);
    try {
      const data = responsePayload(await axios.post(`${API_BASE}/agent/chat`, { message, conversationId }));
      setConversationId(data.conversationId);
      setMessages(current => [...current, {
        id: `local-agent-${Date.now()}`, role: 'ASSISTANT', content: data.message,
        metadata: { ...data.provenance, sources: data.sources || [], dataSources: data.dataSources || [],
          pendingAction: data.pendingAction, uiActions: data.uiActions || [] }
      }]);
      await refreshConversations();
    } catch (err) {
      const messageText = err.response?.data?.message || err.message || 'Đã xảy ra lỗi khi gửi tin nhắn.';
      setError(messageText);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const confirmAction = async (action, secureFields) => {
    setActionBusy(true);
    setError('');
    try {
      const data = responsePayload(await axios.post(`${API_BASE}/agent/actions/${encodeURIComponent(action.actionId)}/confirm`,
        secureFields ? { secureFields } : {}));
      setMessages(current => [
        ...current.map(item => item.metadata?.pendingAction?.actionId === action.actionId
          ? { ...item, metadata: { ...item.metadata, pendingAction: { ...item.metadata.pendingAction, status: 'EXECUTED' } } }
          : item),
        { id: `local-result-${Date.now()}`, role: 'SYSTEM_SUMMARY', content: data.status === 'EXECUTED' ? 'Đã xác nhận và thực hiện thao tác.' : 'Thao tác đã được xử lý.' }
      ]);
      await refreshConversations();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không thể xác nhận thao tác.');
    } finally {
      setActionBusy(false);
    }
  };

  const cancelAction = async (action) => {
    setActionBusy(true);
    setError('');
    try {
      await axios.post(`${API_BASE}/agent/actions/${encodeURIComponent(action.actionId)}/cancel`, {});
      setMessages(current => [
        ...current.map(item => item.metadata?.pendingAction?.actionId === action.actionId
          ? { ...item, metadata: { ...item.metadata, pendingAction: { ...item.metadata.pendingAction, status: 'CANCELLED' } } }
          : item),
        { id: `local-cancel-${Date.now()}`, role: 'SYSTEM_SUMMARY', content: 'Đã hủy thao tác. Không có dữ liệu nghiệp vụ nào được thay đổi.' }
      ]);
      await refreshConversations();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không thể hủy thao tác.');
    } finally {
      setActionBusy(false);
    }
  };

  const openUiAction = (action) => {
    if (action?.type === 'OPEN_CASE' && /^[A-Z0-9_-]{1,100}$/i.test(action.caseId || '')) onOpenCase?.(action.caseId);
  };

  return (
    <>
      {!open && (
        <button type="button" className="agent-launcher" onClick={() => { setOpen(true); setMinimized(false); }} aria-label="Mở trợ lý EDUASSISTANT">
          <MessageCircle size={21} aria-hidden="true" /><span>Trợ lý</span>
        </button>
      )}
      {open && (
        <section className={`agent-widget ${minimized ? 'is-minimized' : ''}`} role="dialog" aria-modal="false" aria-label="Trợ lý EDUASSISTANT">
          <header className="agent-widget-header">
            <div className="agent-avatar"><Bot size={20} aria-hidden="true" /></div>
            <div className="agent-header-copy">
              <strong>Trợ lý EDUASSISTANT</strong>
              <span>{labelFor(user?.role, USER_ROLE_LABELS, 'Tài khoản')} · Hỗ trợ hồ sơ và quy trình của trường</span>
            </div>
            <div className="agent-header-actions">
              <button type="button" onClick={startConversation} aria-label="Tạo hội thoại mới" title="Hội thoại mới"><Plus size={17} /></button>
              <button type="button" onClick={() => setMinimized(value => !value)} aria-label={minimized ? 'Mở rộng chat' : 'Thu nhỏ chat'} title={minimized ? 'Mở rộng' : 'Thu nhỏ'}><Minus size={17} /></button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng chat" title="Đóng"><X size={17} /></button>
            </div>
          </header>
          {!minimized && (
            <>
              {conversations.length > 0 && (
                <div className="agent-history-row">
                  <label htmlFor="agent-conversation-select">Hội thoại</label>
                  <select id="agent-conversation-select" value={conversationId || ''} onChange={selectConversation}>
                    {conversations.map(item => <option key={item.id} value={item.id}>{item.title || 'Cuộc trò chuyện'}</option>)}
                  </select>
                </div>
              )}
              <div className="agent-chat-messages" aria-live="polite" aria-relevant="additions text">
                {messages.length === 0 && (
                  <div className="agent-welcome">
                    <div className="agent-welcome-icon"><Bot size={26} /></div>
                    <h2>Xin chào{user?.fullName ? ` ${user.fullName}` : ''}</h2>
                    <p>Mình có thể tra cứu thông tin bạn được phép xem, giải thích các bước xử lý và hỗ trợ chuẩn bị hồ sơ.</p>
                    <div className="agent-quick-prompts">
                      {(prompts[user?.role] || prompts.STUDENT).map(prompt => (
                        <button type="button" key={prompt} onClick={() => sendMessage(prompt)} disabled={loading}>{prompt}</button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map(item => <AgentMessage key={item.id} item={item} onConfirm={confirmAction} onCancel={cancelAction} busy={actionBusy} />)}
                {loading && <div className="agent-loading" role="status"><span className="agent-loading-dot" />Đang kiểm tra thông tin…</div>}
                {error && <div className="agent-error" role="alert">{error}</div>}
                {messages.some(item => item.metadata?.uiActions?.length) && messages.flatMap(item => item.metadata?.uiActions || []).map(action => (
                    <button type="button" className="agent-open-case" key={`${action.type}-${action.caseId}`} onClick={() => openUiAction(action)}>
                    Mở hồ sơ {action.caseId}
                  </button>
                ))}
                <div ref={endRef} />
              </div>
              <div className="agent-compose-wrap">
                <form className="agent-compose" onSubmit={event => { event.preventDefault(); sendMessage(); }}>
                  <label className="sr-only" htmlFor="agent-message-input">Tin nhắn cho trợ lý EDUASSISTANT</label>
                  <textarea id="agent-message-input" ref={textareaRef} value={draft} rows={1} maxLength={6000}
                    placeholder="Hỏi về hồ sơ hoặc quy trình của trường…" disabled={loading}
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} />
                  <button type="submit" aria-label="Gửi tin nhắn" disabled={loading || !draft.trim()}><Send size={18} /></button>
                </form>
                <small>Enter để gửi · Shift+Enter xuống dòng · Không gửi thông tin đăng nhập</small>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
