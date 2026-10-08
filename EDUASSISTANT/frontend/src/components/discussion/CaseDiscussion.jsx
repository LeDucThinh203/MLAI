import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageCircle, RefreshCw, Send } from 'lucide-react';
import { API_BASE } from '../../api/client';

export const CaseDiscussion = ({ caseId, token }) => {
  const [comments, setComments] = useState([]);
  const [inputContent, setInputContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchComments = async () => {
    if (!caseId || !token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/cases/${caseId}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setComments(res.data.data.comments || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [caseId, token]);

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!inputContent.trim() || sending) return;

    setSending(true);
    try {
      const res = await axios.post(`${API_BASE}/cases/${caseId}/comments`, {
        content: inputContent.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const newComment = res.data?.data?.comment || res.data?.data;
      if (res.data?.success && newComment?.id) {
        setComments(prev => [...prev, newComment]);
        setInputContent('');
        // Reconcile with the server in case another participant commented too.
        fetchComments();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi gửi bình luận!');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      background: '#070b19',
      border: '1px solid #1e293b',
      borderRadius: '10px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
          <MessageCircle size={15} color="#38bdf8" /> Kênh Trao Đổi & Bình Luận ({comments.length})
        </h4>
        <button
          type="button"
          onClick={fetchComments}
          className="btn-secondary"
          style={{ padding: '2px 8px', fontSize: '0.7rem' }}
          title="Tải lại bình luận"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Comment List */}
      <div style={{
        maxHeight: '220px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingRight: '4px'
      }}>
        {comments.length > 0 ? (
          comments.map((cmt) => {
            const isStaff = cmt.authorRole === 'REVIEWER' || cmt.authorRole === 'ADMIN';

            return (
              <div
                key={cmt.id}
                style={{
                  background: isStaff ? 'rgba(59, 130, 246, 0.08)' : 'rgba(15, 23, 42, 0.7)',
                  border: `1px solid ${isStaff ? 'rgba(59, 130, 246, 0.25)' : '#1e293b'}`,
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isStaff ? '#60a5fa' : '#34d399' }}>
                      {cmt.authorName}
                    </span>
                    <span style={{
                      fontSize: '0.64rem',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: isStaff ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: isStaff ? '#93c5fd' : '#6ee7b7',
                      fontWeight: 600
                    }}>
                      {cmt.authorRole === 'ADMIN' ? '🛡️ Admin' : (cmt.authorRole === 'REVIEWER' ? '🔍 Cán Bộ' : '🎓 Sinh Viên')}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-sub)' }}>
                    {new Date(cmt.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                  {cmt.content}
                </p>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-sub)', fontSize: '0.76rem' }}>
            Chưa có trao đổi nào. Bạn có thể để lại câu hỏi hoặc ghi chú tại đây.
          </div>
        )}
      </div>

      {/* Input box */}
      <form onSubmit={handleSendComment} style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          value={inputContent}
          onChange={e => setInputContent(e.target.value)}
          placeholder="Nhập câu hỏi hoặc giải trình thêm..."
          className="form-input"
          style={{ flex: 1, padding: '7px 10px', fontSize: '0.78rem' }}
        />
        <button
          type="submit"
          disabled={sending || !inputContent.trim()}
          className="btn-primary"
          style={{ padding: '7px 12px', fontSize: '0.78rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
          <span>Gửi</span>
        </button>
      </form>
    </div>
  );
};

export default CaseDiscussion;
