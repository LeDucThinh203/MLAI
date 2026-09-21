import React, { useEffect, useState } from 'react';
import { getPendingReviews, approveEscalation, rejectEscalation, overrideEscalation, requestInfoEscalation } from '../api/humanReview';
import { Escalation } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { CheckCircle2, XCircle, HelpCircle, ShieldAlert, AlertTriangle } from 'lucide-react';

export const HumanReviewPage: React.FC = () => {
  const [reviews, setReviews] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReview, setActiveReview] = useState<Escalation | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReviews = async () => {
    try {
      const data = await getPendingReviews();
      setReviews(data);
      if (data.length > 0 && !activeReview) {
        setActiveReview(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleAction = async (action: 'APPROVE' | 'REJECT' | 'OVERRIDE' | 'REQUEST_INFO') => {
    if (!activeReview) return;
    if (!reasonInput && (action === 'OVERRIDE' || action === 'REJECT')) {
      alert('Vui lòng nhập lý do quyết định!');
      return;
    }

    setActionLoading(true);
    const payload = {
      reviewer_name: 'Cán bộ Nguyễn Văn A',
      reviewer_role: activeReview.target_role || 'Chuyên viên phụ trách',
      reason: reasonInput || 'Phê duyệt theo thẩm quyền sau khi xác minh.',
    };

    try {
      if (action === 'APPROVE') await approveEscalation(activeReview.id, payload);
      else if (action === 'REJECT') await rejectEscalation(activeReview.id, payload);
      else if (action === 'OVERRIDE') await overrideEscalation(activeReview.id, payload);
      else if (action === 'REQUEST_INFO') await requestInfoEscalation(activeReview.id, payload);

      setReasonInput('');
      await fetchReviews();
      setActiveReview(null);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Đang tải danh sách hồ sơ cần thẩm định..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cổng Thẩm Định Hồ Sơ (Human-in-the-loop Review)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Khu vực giải quyết các hồ sơ mà AI dừng lại do mâu thuẫn, thiếu minh chứng hoặc vượt thẩm quyền.
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Không có hồ sơ chờ duyệt</h2>
          <p className="text-sm text-slate-500 mt-1">Toàn bộ hồ sơ thường quy đã được AI xử lý hoặc giải quyết xong.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of Escalated Items */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Danh sách chờ ({reviews.length})
            </h2>
            {reviews.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveReview(item)}
                className={`p-4 rounded-xl border cursor-pointer transition ${
                  activeReview?.id === item.id
                    ? 'border-brand-500 bg-brand-50/50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-slate-500">Case ID: {item.case_id.slice(0, 8)}...</span>
                  <StatusBadge status={item.escalation_type} />
                </div>
                <p className="text-xs font-semibold text-slate-800 line-clamp-2">{item.question}</p>
              </div>
            ))}
          </div>

          {/* Active Detail & Decision Panel */}
          {activeReview && (
            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-600 uppercase flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> YÊU CẦU QUYẾT ĐỊNH TỪ CÁN BỘ
                  </span>
                  <StatusBadge status={activeReview.escalation_type} />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-2">
                  {activeReview.question}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Đơn vị chịu trách nhiệm: <span className="font-semibold text-slate-700">{activeReview.target_role}</span>
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-2">
                <div>
                  <span className="font-bold text-slate-700">Lý do hệ thống dừng tự động:</span>
                  <p className="text-slate-600 mt-0.5">{activeReview.reason}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-700">Tóm tắt minh chứng liên quan:</span>
                  <p className="text-slate-600 mt-0.5">{activeReview.evidence_summary || 'Xem trong chi tiết hồ sơ'}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Ý kiến / Lý do cán bộ phê chuẩn (Bắt buộc nếu Override hoặc Từ chối):
                </label>
                <textarea
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Nhập lý do hoặc nội dung hướng dẫn cho sinh viên..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <button
                  onClick={() => handleAction('APPROVE')}
                  disabled={actionLoading}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Phê duyệt
                </button>

                <button
                  onClick={() => handleAction('REJECT')}
                  disabled={actionLoading}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> Từ chối
                </button>

                <button
                  onClick={() => handleAction('REQUEST_INFO')}
                  disabled={actionLoading}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow flex items-center justify-center gap-1.5"
                >
                  <HelpCircle className="w-4 h-4" /> Yêu cầu bổ sung
                </button>

                <button
                  onClick={() => handleAction('OVERRIDE')}
                  disabled={actionLoading}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow flex items-center justify-center gap-1.5"
                >
                  <ShieldAlert className="w-4 h-4" /> Override AI
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
