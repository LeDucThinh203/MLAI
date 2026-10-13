import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Bot, FileText, MessageCircle, Minus, Paperclip, Plus, Send, Trash2, X, XCircle } from 'lucide-react';
import { API_BASE } from '../../api/client';
import AgentMessage from './AgentMessage';
import './AgentChatWidget.css';

const STUDENT_PROMPTS = [
  'Hồ sơ của tôi đang được xử lý đến đâu?',
  'Tôi cần chuẩn bị giấy tờ gì để nộp hồ sơ?',
  'Kiểm tra cách viết địa chỉ giúp tôi.'
];
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_ATTACHMENT_MESSAGE = 'Hãy đọc và phân tích nội dung tài liệu này.';
const ACCEPTED_ATTACHMENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);
const EXTENSION_MIME_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf'
};

function attachmentMimeType(file) {
  if (ACCEPTED_ATTACHMENT_TYPES.has(file.type)) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return EXTENSION_MIME_TYPES[extension] || '';
}

function formatFileSize(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function attachmentMetadataFromUpload(data, selected) {
  const uploadedFile = data?.file || data || {};
  const ocrData = uploadedFile.ocrData || data?.ocr?.data || {};
  if (!uploadedFile.fileName) throw new Error('Máy chủ không trả về mã tệp đính kèm.');
  return {
    fileName: uploadedFile.fileName,
    fileUrl: uploadedFile.fileUrl,
    originalName: uploadedFile.metadata?.originalName || selected.file.name,
    mimeType: uploadedFile.metadata?.mimeType || selected.mimeType,
    ocrStatus: ocrData.extractionStatus || 'UNAVAILABLE',
    ocrProvider: uploadedFile.ocrProvider || ocrData.provider || 'NO_OCR_FALLBACK',
    ocrIsLive: uploadedFile.ocrIsLive === true || uploadedFile.ocrIsLive === 1
  };
}

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
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [uploadedAttachment, setUploadedAttachment] = useState(null);
  const [loadingStage, setLoadingStage] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectedAttachmentRef = useRef(null);
  const pendingLocalMessageRef = useRef(null);

  const revokePreview = (attachment) => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
  };

  const clearAttachment = () => {
    revokePreview(selectedAttachmentRef.current);
    selectedAttachmentRef.current = null;
    setSelectedAttachment(null);
    setUploadedAttachment(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      clearAttachment();
      setError('Tệp tối đa 10 MB.');
      return;
    }
    const mimeType = attachmentMimeType(file);
    if (!mimeType) {
      clearAttachment();
      setError('Chỉ hỗ trợ ảnh PNG, JPEG, WebP hoặc tài liệu PDF.');
      return;
    }
    setError('');
    revokePreview(selectedAttachmentRef.current);
    const nextAttachment = {
      file,
      mimeType,
      previewUrl: mimeType.startsWith('image/') ? URL.createObjectURL(file) : null
    };
    selectedAttachmentRef.current = nextAttachment;
    setSelectedAttachment(nextAttachment);
    setUploadedAttachment(null);
  };

  useEffect(() => () => {
    const previewUrl = selectedAttachmentRef.current?.previewUrl;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, []);

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
      setDraft('');
      pendingLocalMessageRef.current = null;
      clearAttachment();
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
    pendingLocalMessageRef.current = null;
    clearAttachment();
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
    const attachmentAtSend = selectedAttachment;
    const message = value.trim() || (attachmentAtSend ? DEFAULT_ATTACHMENT_MESSAGE : '');
    if ((!message && !attachmentAtSend) || loading) return;
    setError('');
    if (!attachmentAtSend) setDraft('');
    setLoading(true);
    setLoadingStage(attachmentAtSend
      ? (uploadedAttachment ? 'Trợ lý đang phân tích nội dung…' : 'Đang tải tài liệu và đọc OCR…')
      : '');
    const localMessageId = pendingLocalMessageRef.current || `local-user-${Date.now()}`;
    if (!pendingLocalMessageRef.current) pendingLocalMessageRef.current = localMessageId;
    const pendingAttachment = uploadedAttachment || (attachmentAtSend ? {
      originalName: attachmentAtSend.file.name,
      mimeType: attachmentAtSend.mimeType,
      ocrStatus: 'UPLOADING'
    } : null);
    setMessages(current => {
      const localMessage = {
        id: localMessageId,
        role: 'USER',
        content: message,
        ...(pendingAttachment ? { metadata: { attachment: pendingAttachment } } : {})
      };
      return current.some(item => item.id === localMessageId)
        ? current.map(item => item.id === localMessageId ? localMessage : item)
        : [...current, localMessage];
    });
    let fileReference = uploadedAttachment;
    try {
      if (attachmentAtSend && !fileReference) {
        setLoadingStage('Đang tải tài liệu và đọc OCR…');
        const formData = new FormData();
        formData.append('evidence', attachmentAtSend.file);
        const uploadData = responsePayload(await axios.post(`${API_BASE}/upload/evidence`, formData));
        fileReference = attachmentMetadataFromUpload(uploadData, attachmentAtSend);
        setUploadedAttachment(fileReference);
        setMessages(current => current.map(item => item.id === localMessageId
          ? { ...item, metadata: { ...item.metadata, attachment: fileReference } }
          : item));
      }
      if (attachmentAtSend) setLoadingStage('Trợ lý đang phân tích nội dung…');
      const data = responsePayload(await axios.post(`${API_BASE}/agent/chat`, {
        message,
        conversationId,
        ...(fileReference ? { evidenceFileName: fileReference.fileName } : {})
      }));
      setConversationId(data.conversationId);
      const savedAttachment = data.attachment || fileReference;
      setMessages(current => [
        ...current.map(item => item.id === localMessageId
          ? { ...item, metadata: savedAttachment ? { ...item.metadata, attachment: savedAttachment } : undefined }
          : item),
        {
          id: `local-agent-${Date.now()}`, role: 'ASSISTANT', content: data.message,
          metadata: { ...data.provenance, sources: data.sources || [], dataSources: data.dataSources || [],
            pendingAction: data.pendingAction, uiActions: data.uiActions || [] }
        }
      ]);
      pendingLocalMessageRef.current = null;
      setDraft('');
      setError('');
      if (attachmentAtSend) clearAttachment();
      await refreshConversations();
    } catch (err) {
      const messageText = err.response?.data?.message || err.message || 'Đã xảy ra lỗi khi gửi tin nhắn.';
      setError(messageText);
      if (attachmentAtSend && !fileReference) {
        setMessages(current => current.filter(item => item.id !== localMessageId));
        pendingLocalMessageRef.current = null;
      }
    } finally {
      setLoading(false);
      setLoadingStage('');
      textareaRef.current?.focus();
    }
  };

  const confirmAction = async (action) => {
    setActionBusy(true);
    setError('');
    try {
      const data = responsePayload(await axios.post(`${API_BASE}/agent/actions/${encodeURIComponent(action.actionId)}/confirm`, {}));
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

  const deleteConversation = async () => {
    if (!conversationId || loading || actionBusy || deleteBusy) return;
    const deletedId = conversationId;
    setDeleteBusy(true);
    setError('');
    try {
      const result = responsePayload(await axios.delete(
        `${API_BASE}/agent/conversations/${encodeURIComponent(deletedId)}`));
      if (result?.deleted !== true) throw new Error('Không thể xác nhận trạng thái xóa cuộc trò chuyện.');

      let remaining = conversations.filter(item => item.id !== deletedId);
      try {
        const latest = responsePayload(await axios.get(`${API_BASE}/agent/conversations`));
        remaining = latest?.conversations || remaining;
      } catch {
        // The successful deletion is final; use the current list if refresh is unavailable.
      }
      setConversations(remaining);
      setMessages([]);
      setDraft('');
      pendingLocalMessageRef.current = null;
      clearAttachment();
      setError('');
      setConversationId(remaining[0]?.id || null);
      setConfirmDelete(false);

      if (remaining[0]?.id) {
        try {
          const data = responsePayload(await axios.get(
            `${API_BASE}/agent/conversations/${encodeURIComponent(remaining[0].id)}`));
          setMessages(data?.conversation?.messages || []);
        } catch (err) {
          setError(err.response?.data?.message || err.message || 'Không thể tải cuộc trò chuyện tiếp theo.');
        }
      }
    } catch (err) {
      const code = err.response?.data?.error;
      setError(code === 'CONVERSATION_BUSY'
        ? 'Cuộc trò chuyện đang có thao tác được thực hiện. Hãy đợi thao tác hoàn tất rồi xóa lại.'
        : err.response?.data?.message || err.message || 'Không thể xóa cuộc trò chuyện. Vui lòng thử lại.');
    } finally {
      setDeleteBusy(false);
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
              <span>Sinh viên · Hỗ trợ hồ sơ và quy trình của trường</span>
            </div>
            <div className="agent-header-actions">
              <button type="button" onClick={startConversation} aria-label="Tạo hội thoại mới" title="Hội thoại mới"
                disabled={loading || actionBusy || deleteBusy || confirmDelete}><Plus size={17} /></button>
              <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Xóa cuộc trò chuyện hiện tại"
                title="Xóa cuộc trò chuyện" disabled={!conversationId || loading || actionBusy || deleteBusy}>
                <Trash2 size={17} />
              </button>
              <button type="button" onClick={() => setMinimized(value => !value)} aria-label={minimized ? 'Mở rộng chat' : 'Thu nhỏ chat'} title={minimized ? 'Mở rộng' : 'Thu nhỏ'}><Minus size={17} /></button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng chat" title="Đóng"><X size={17} /></button>
            </div>
          </header>
          {!minimized && (
            <>
              {confirmDelete && (
                <div className="agent-delete-confirm" role="alertdialog" aria-modal="false"
                  aria-labelledby="agent-delete-title" aria-describedby="agent-delete-description">
                  <strong id="agent-delete-title">Xóa cuộc trò chuyện?</strong>
                  <p id="agent-delete-description">Toàn bộ tin nhắn và thao tác AI đang chờ trong cuộc trò chuyện này sẽ bị xóa khỏi cơ sở dữ liệu. Hành động này không thể hoàn tác.</p>
                  <div>
                    <button type="button" className="agent-delete-cancel" onClick={() => setConfirmDelete(false)} disabled={deleteBusy}>Hủy</button>
                    <button type="button" className="agent-delete-submit" onClick={deleteConversation} disabled={deleteBusy}>
                      {deleteBusy ? 'Đang xóa…' : 'Xóa cuộc trò chuyện'}
                    </button>
                  </div>
                </div>
              )}
              {conversations.length > 0 && (
                <div className="agent-history-row">
                  <label htmlFor="agent-conversation-select">Hội thoại</label>
                  <select id="agent-conversation-select" value={conversationId || ''} onChange={selectConversation} disabled={loading || deleteBusy || confirmDelete}>
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
                      {STUDENT_PROMPTS.map(prompt => (
                        <button type="button" key={prompt} onClick={() => sendMessage(prompt)} disabled={loading}>{prompt}</button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map(item => <AgentMessage key={item.id} item={item} onConfirm={confirmAction} onCancel={cancelAction} busy={actionBusy} />)}
                {loading && <div className="agent-loading" role="status"><span className="agent-loading-dot" />{loadingStage || 'Đang kiểm tra thông tin…'}</div>}
                {error && <div className="agent-error" role="alert">{error}</div>}
                {messages.some(item => item.metadata?.uiActions?.length) && messages.flatMap(item => item.metadata?.uiActions || []).map(action => (
                    <button type="button" className="agent-open-case" key={`${action.type}-${action.caseId}`} onClick={() => openUiAction(action)}>
                    Mở hồ sơ {action.caseId}
                  </button>
                ))}
                <div ref={endRef} />
              </div>
              <div className="agent-compose-wrap">
                {selectedAttachment && (
                  <div className="agent-attachment-preview" aria-live="polite">
                    {selectedAttachment.previewUrl
                      ? <img src={selectedAttachment.previewUrl} alt="Xem trước tệp ảnh đính kèm" />
                      : <FileText size={25} aria-hidden="true" />}
                    <div className="agent-attachment-preview-copy">
                      <strong title={selectedAttachment.file.name}>{selectedAttachment.file.name}</strong>
                      <span>{formatFileSize(selectedAttachment.file.size)}</span>
                    </div>
                    <button type="button" aria-label="Bỏ tệp đính kèm" title="Bỏ tệp đính kèm"
                      onClick={clearAttachment} disabled={loading || deleteBusy || confirmDelete}>
                      <XCircle size={18} aria-hidden="true" />
                    </button>
                  </div>
                )}
                <form className="agent-compose" onSubmit={event => { event.preventDefault(); sendMessage(); }}>
                  <input ref={fileInputRef} className="sr-only" type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    aria-label="Đính kèm ảnh hoặc tài liệu" onChange={handleAttachmentChange} />
                  <button type="button" className="agent-attach-button"
                    aria-label="Đính kèm ảnh hoặc tài liệu" title="Đính kèm ảnh hoặc tài liệu"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading || deleteBusy || confirmDelete}>
                    <Paperclip size={18} aria-hidden="true" />
                  </button>
                  <label className="sr-only" htmlFor="agent-message-input">Tin nhắn cho trợ lý EDUASSISTANT</label>
                  <textarea id="agent-message-input" ref={textareaRef} value={draft} rows={1} maxLength={6000}
                    placeholder="Hỏi về hồ sơ hoặc quy trình của trường…" disabled={loading}
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} />
                  <button type="submit" aria-label="Gửi tin nhắn" disabled={loading || (!draft.trim() && !selectedAttachment)}><Send size={18} /></button>
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
