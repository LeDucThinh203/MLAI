import React, { useEffect, useState } from 'react';
import { getAuditLogs } from '../api/audit';
import { AuditLog } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
  ShieldCheck, 
  Search, 
  Bot, 
  Sparkles, 
  User, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  FileCheck, 
  Paperclip,
  Clock,
  Filter
} from 'lucide-react';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await getAuditLogs(0, 150);
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  // Format WHO (Actor) into friendly Vietnamese badge + name
  const renderActor = (type: string, name: string) => {
    switch (type) {
      case 'SYSTEM':
        return (
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Bot className="w-4 h-4" />
            </span>
            <div>
              <span className="font-semibold text-slate-900 block text-xs">Hệ thống Rule Engine</span>
              <span className="text-[11px] text-slate-500">{name || 'Quyết định tất định'}</span>
            </div>
          </div>
        );
      case 'AI_VLM':
        return (
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <span className="font-semibold text-slate-900 block text-xs">Trí tuệ Nhân tạo VLM</span>
              <span className="text-[11px] text-purple-700 font-medium">Gemini 2.5 Flash</span>
            </div>
          </div>
        );
      case 'STAFF':
        return (
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              <UserCheck className="w-4 h-4" />
            </span>
            <div>
              <span className="font-semibold text-slate-900 block text-xs">Cán bộ Thẩm định</span>
              <span className="text-[11px] text-slate-600">{name}</span>
            </div>
          </div>
        );
      case 'STUDENT':
      default:
        return (
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <User className="w-4 h-4" />
            </span>
            <div>
              <span className="font-semibold text-slate-900 block text-xs">Sinh viên</span>
              <span className="text-[11px] text-slate-500">Cổng tiếp nhận trực tuyến</span>
            </div>
          </div>
        );
    }
  };

  // Format WHAT (Action) into natural Vietnamese badge
  const renderActionBadge = (action: string) => {
    switch (action) {
      case 'SUBMITTED_CASE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <FileText className="w-3.5 h-3.5" /> Khởi tạo hồ sơ mới
          </span>
        );
      case 'UPLOADED_EVIDENCE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Paperclip className="w-3.5 h-3.5" /> Đính kèm minh chứng
          </span>
        );
      case 'EXTRACTED_FACTS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Sparkles className="w-3.5 h-3.5" /> Trích xuất dữ kiện VLM
          </span>
        );
      case 'AUTO_RESOLVED_CASE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
            <CheckCircle className="w-3.5 h-3.5" /> Tự động giải quyết (Auto-Resolve)
          </span>
        );
      case 'ESCALATED_AUTHORITY_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Leo thang: Vượt thẩm quyền AI (&gt;50tr)
          </span>
        );
      case 'ESCALATED_DATA_CONFLICT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Leo thang: Mâu thuẫn dữ liệu SIS
          </span>
        );
      case 'ESCALATED_FACT_UNKNOWN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Leo thang: Minh chứng mờ / thiếu tin
          </span>
        );
      case 'ESCALATED_POLICY_OUT_OF_SCOPE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <FileCheck className="w-3.5 h-3.5 text-indigo-600" /> Leo thang: Ngoài danh mục quy chế
          </span>
        );
      case 'ESCALATED_OWNERSHIP_UNCLEAR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-50 text-cyan-800 border border-cyan-300">
            <AlertTriangle className="w-3.5 h-3.5 text-cyan-600" /> Leo thang: Tranh chấp liên phòng ban
          </span>
        );
      case 'HUMAN_REVIEW_APPROVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Cán bộ: Phê duyệt hồ sơ
          </span>
        );
      case 'HUMAN_REVIEW_REJECT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Cán bộ: Từ chối hồ sơ
          </span>
        );
      case 'HUMAN_REVIEW_OVERRIDE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-300">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Cán bộ: Ghi đè quyết định AI (Override)
          </span>
        );
      case 'HUMAN_REVIEW_REQUEST_INFORMATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-yellow-50 text-yellow-800 border border-yellow-300">
            <Clock className="w-3.5 h-3.5 text-yellow-600" /> Cán bộ: Yêu cầu bổ sung tài liệu
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            {action}
          </span>
        );
    }
  };

  // Format RESULT from raw JSON into human-readable pills
  const renderResult = (raw?: string) => {
    if (!raw || raw === '-' || raw === 'null') {
      return <span className="text-slate-400 text-xs italic">-</span>;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed.status === 'AUTO_RESOLVED') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
            ✓ Tự động giải quyết thành công
          </span>
        );
      }
      if (parsed.status === 'ESCALATED') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
            ⚠️ Chuyển cán bộ thẩm định
          </span>
        );
      }
      if (parsed.new_status === 'APPROVED') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
            ✓ Đã phê duyệt chính thức
          </span>
        );
      }
      if (parsed.new_status === 'REJECTED') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
            ✕ Đã từ chối hồ sơ
          </span>
        );
      }
      if (parsed.new_status === 'WAITING_FOR_INFORMATION') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-800">
            ⏳ Đang chờ sinh viên bổ sung
          </span>
        );
      }
      return <span className="font-mono text-[11px] text-slate-600 truncate max-w-xs block">{raw}</span>;
    } catch {
      return <span className="text-xs text-slate-600">{raw}</span>;
    }
  };

  // Filter logs by search input and category tab
  const filtered = logs.filter((l) => {
    const matchesSearch =
      l.actor_name?.toLowerCase().includes(filter.toLowerCase()) ||
      l.action?.toLowerCase().includes(filter.toLowerCase()) ||
      l.case_id?.toLowerCase().includes(filter.toLowerCase()) ||
      l.reason?.toLowerCase().includes(filter.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedCategory === 'SYSTEM') return l.actor_type === 'SYSTEM';
    if (selectedCategory === 'VLM') return l.actor_type === 'AI_VLM';
    if (selectedCategory === 'STAFF') return l.actor_type === 'STAFF';
    if (selectedCategory === 'STUDENT') return l.actor_type === 'STUDENT';
    if (selectedCategory === 'ESCALATION') return l.action?.startsWith('ESCALATED_');

    return true;
  });

  // Calculate high-level stats
  const totalLogs = logs.length;
  const totalAuto = logs.filter((l) => l.action === 'AUTO_RESOLVED_CASE').length;
  const totalEscalated = logs.filter((l) => l.action?.startsWith('ESCALATED_')).length;
  const totalHumanReviews = logs.filter((l) => l.actor_type === 'STAFF').length;

  if (loading) return <LoadingSpinner message="Đang tải nhật ký kiểm toán bất biến..." />;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-brand-600" />
            Nhật Ký Kiểm Toán Bất Biến (Audit Trail)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ghi nhận toàn bộ tiến trình: <span className="font-semibold text-slate-700">AI giải quyết tự động, AI dừng leo thang, và Quyết định cán bộ</span> với tính minh bạch tuyệt đối.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Tìm theo tác nhân, hành động, lý do..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none shadow-sm"
          />
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Tổng số sự kiện</div>
            <div className="text-xl font-bold text-slate-900">{totalLogs}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">AI Tự Động Xử Lý</div>
            <div className="text-xl font-bold text-emerald-600">{totalAuto}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">AI Dừng &amp; Leo Thang</div>
            <div className="text-xl font-bold text-amber-600">{totalEscalated}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Cán Bộ Thẩm Định</div>
            <div className="text-xl font-bold text-purple-600">{totalHumanReviews}</div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-semibold">
        <span className="text-slate-400 flex items-center gap-1 mr-2 text-[11px] uppercase">
          <Filter className="w-3.5 h-3.5" /> Lọc nhanh:
        </span>
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-lg transition ${
            selectedCategory === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Tất cả ({totalLogs})
        </button>
        <button
          onClick={() => setSelectedCategory('ESCALATION')}
          className={`px-3 py-1.5 rounded-lg transition ${
            selectedCategory === 'ESCALATION'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          Ca AI leo thang ({totalEscalated})
        </button>
        <button
          onClick={() => setSelectedCategory('STAFF')}
          className={`px-3 py-1.5 rounded-lg transition ${
            selectedCategory === 'STAFF'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
          }`}
        >
          Cán bộ duyệt ({totalHumanReviews})
        </button>
        <button
          onClick={() => setSelectedCategory('SYSTEM')}
          className={`px-3 py-1.5 rounded-lg transition ${
            selectedCategory === 'SYSTEM'
              ? 'bg-indigo-700 text-white shadow-sm'
              : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
          }`}
        >
          Quyết định Hệ thống
        </button>
        <button
          onClick={() => setSelectedCategory('VLM')}
          className={`px-3 py-1.5 rounded-lg transition ${
            selectedCategory === 'VLM'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100'
          }`}
        >
          Trích xuất Gemini VLM
        </button>
        <button
          onClick={() => setSelectedCategory('STUDENT')}
          className={`px-3 py-1.5 rounded-lg transition ${
            selectedCategory === 'STUDENT'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          Sinh viên nộp
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 text-slate-700 border-b border-slate-200 uppercase text-[11px] tracking-wider font-bold">
              <tr>
                <th className="p-3.5">Thời Gian</th>
                <th className="p-3.5">Tác Nhân (WHO)</th>
                <th className="p-3.5">Hành Động (WHAT)</th>
                <th className="p-3.5 min-w-[280px]">Lý Do &amp; Căn Cứ (WHY &amp; POLICY)</th>
                <th className="p-3.5">Minh Chứng</th>
                <th className="p-3.5">Kết Quả (RESULT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Không tìm thấy sự kiện kiểm toán phù hợp với tiêu chí lọc.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    {/* Timestamp */}
                    <td className="p-3.5 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(log.created_at).toLocaleString('vi-VN')}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Mã HS: <span className="font-semibold text-slate-600">{log.case_id.slice(0, 8)}...</span>
                      </div>
                    </td>

                    {/* Actor */}
                    <td className="p-3.5 whitespace-nowrap">
                      {renderActor(log.actor_type, log.actor_name)}
                    </td>

                    {/* Action */}
                    <td className="p-3.5 whitespace-nowrap">
                      {renderActionBadge(log.action)}
                    </td>

                    {/* Reason & Policy */}
                    <td className="p-3.5 text-slate-700">
                      <div className="font-medium leading-relaxed">{log.reason || '-'}</div>
                      {log.policy_reference && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded">
                          <FileCheck className="w-3 h-3 text-brand-600" /> Quy chế: {log.policy_reference}
                        </span>
                      )}
                    </td>

                    {/* Evidence */}
                    <td className="p-3.5 whitespace-nowrap">
                      {log.evidence_ids ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          <Paperclip className="w-3 h-3 text-slate-500" />
                          <span>Tài liệu: {log.evidence_ids.slice(0, 8)}...</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">-</span>
                      )}
                    </td>

                    {/* Result */}
                    <td className="p-3.5 whitespace-nowrap">
                      {renderResult(log.result_snapshot)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

