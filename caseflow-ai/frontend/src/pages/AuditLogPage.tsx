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
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const allLogs: AuditLog[] = [];
        let page: AuditLog[];
        do {
          page = await getAuditLogs(allLogs.length, 200);
          allLogs.push(...page);
        } while (page.length === 200);
        setLogs(Array.from(new Map(allLogs.map((log) => [log.id, log])).values()));
      } catch (err) {
        console.error(err);
        setError(true);
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
      return <span className="font-mono text-[11px] text-slate-600 break-words block">{raw}</span>;
    } catch {
      return <span className="text-xs text-slate-600">{raw}</span>;
    }
  };

  // Filter logs by search input and category tab
  const matchesFilter = (l: AuditLog) => {
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
  };

  const actionOrder = (action: string) => {
    if (action === 'SUBMITTED_CASE') return 0;
    if (action === 'UPLOADED_EVIDENCE') return 1;
    if (action === 'EXTRACTED_FACTS') return 2;
    if (action.startsWith('HUMAN_REVIEW_')) return 4;
    return 3;
  };
  const groups = new Map<string, AuditLog[]>();
  logs.forEach((log) => {
    const key = log.case_id || log.id;
    const events = groups.get(key) || [];
    events.push(log);
    groups.set(key, events);
  });
  const timelines = Array.from(groups.entries()).map(([caseId, events]) => ({
    caseId,
    events: events.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
      || actionOrder(a.action) - actionOrder(b.action)),
  })).sort((a, b) => Date.parse(b.events[b.events.length - 1].created_at)
    - Date.parse(a.events[a.events.length - 1].created_at));
  // Keep the entire history visible when any event matches the filters.
  const filteredTimelines = timelines.filter(({ events }) => events.some(matchesFilter));

  const getStatus = (events: AuditLog[]) => {
    let status = 'PROCESSING';
    for (const event of events) {
      try {
        const result = JSON.parse(event.result_snapshot || '{}');
        if (result?.new_status || result?.status) {
          status = result.new_status || result.status;
          continue;
        }
      } catch { /* Older entries can contain plain text snapshots. */ }
      if (event.action === 'AUTO_RESOLVED_CASE') status = 'AUTO_RESOLVED';
      else if (event.action.startsWith('ESCALATED_')) status = 'ESCALATED';
      else if (['HUMAN_REVIEW_APPROVE', 'HUMAN_REVIEW_OVERRIDE'].includes(event.action)) status = 'APPROVED';
      else if (event.action === 'HUMAN_REVIEW_REJECT') status = 'REJECTED';
      else if (event.action === 'HUMAN_REVIEW_REQUEST_INFORMATION') status = 'WAITING_FOR_INFORMATION';
      else if (event.action === 'HUMAN_REVIEW_STOP') status = 'STOPPED';
      else if (event.action === 'HUMAN_REVIEW_RESUME') status = 'ANALYZING';
    }
    if (['AUTO_RESOLVED', 'APPROVED'].includes(status)) return { label: 'Hoàn tất · Đã giải quyết', style: 'bg-emerald-50 text-emerald-700 border-emerald-200', done: true };
    if (status === 'REJECTED') return { label: 'Hoàn tất · Đã từ chối', style: 'bg-rose-50 text-rose-700 border-rose-200', done: true };
    if (status === 'ESCALATED') return { label: 'Chờ cán bộ xử lý', style: 'bg-amber-50 text-amber-800 border-amber-200', done: false };
    if (status === 'WAITING_FOR_INFORMATION') return { label: 'Chờ bổ sung thông tin', style: 'bg-amber-50 text-amber-800 border-amber-200', done: false };
    if (status === 'STOPPED') return { label: 'Đã tạm dừng', style: 'bg-slate-100 text-slate-700 border-slate-200', done: false };
    return { label: 'Đang xử lý', style: 'bg-blue-50 text-blue-700 border-blue-200', done: false };
  };

  // Calculate high-level stats
  const totalLogs = logs.length;
  const totalAuto = logs.filter((l) => l.action === 'AUTO_RESOLVED_CASE').length;
  const totalEscalated = logs.filter((l) => l.action?.startsWith('ESCALATED_')).length;
  const totalHumanReviews = logs.filter((l) => l.actor_type === 'STAFF').length;

  if (loading) return <LoadingSpinner message="Đang tải nhật ký kiểm toán bất biến..." />;
  if (error) return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">Không tải được nhật ký kiểm toán. Vui lòng tải lại trang để thử lại.</div>;

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
            Mỗi hồ sơ trong một box riêng, theo dõi từ khởi tạo đến kết quả cuối cùng.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            aria-label="Tìm nhật ký theo mã hồ sơ, tác nhân, hành động hoặc lý do"
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
          Tất cả ({timelines.length} hồ sơ)
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

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Hiển thị <strong className="text-slate-800">{filteredTimelines.length}/{timelines.length} hồ sơ</strong> · Giữ đầy đủ các bước khi lọc</span>
        <span>Hồ sơ cập nhật gần nhất ở trên · Các bước từ cũ đến mới</span>
      </div>

      <div className="space-y-6">
        {filteredTimelines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Không tìm thấy hồ sơ phù hợp với tiêu chí lọc.
          </div>
        ) : filteredTimelines.map(({ caseId, events }) => {
          const first = events[0];
          const last = events[events.length - 1];
          const status = getStatus(events);
          return (
            <section key={caseId} aria-label={`Tiến trình hồ sơ ${caseId}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="flex items-start gap-2 text-sm font-bold text-slate-900">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <span>Hồ sơ <span className="font-mono break-all">{caseId}</span></span>
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {events.some((event) => event.action === 'SUBMITTED_CASE') ? 'Khởi tạo' : 'Ghi nhận đầu tiên'}: {new Date(first.created_at).toLocaleString('vi-VN')}
                    <span className="mx-2">→</span>
                    {status.done ? 'Hoàn tất' : 'Cập nhật'}: {new Date(last.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">{events.length} bước</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${status.style}`}>
                    {status.done ? <CheckCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    {status.label}
                  </span>
                </div>
              </header>
              <ol className="px-4 py-5 sm:px-6">
                {events.map((log, index) => (
                  <li key={log.id} className="relative pb-6 pl-10 last:pb-0">
                    {index < events.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-3.5 top-7 w-px bg-slate-200" />}
                    <span aria-hidden="true" className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${index === events.length - 1 ? status.style : 'border-brand-200 bg-brand-50 text-brand-700'}`}>
                      {index + 1}
                    </span>
                    <div className="min-w-0 rounded-xl border border-slate-100 p-3 sm:p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">{renderActionBadge(log.action)}</div>
                        <time dateTime={log.created_at} className="shrink-0 text-xs text-slate-500">{new Date(log.created_at).toLocaleString('vi-VN')}</time>
                      </div>
                      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[210px_minmax(0,1fr)]">
                        <div>{renderActor(log.actor_type, log.actor_name)}</div>
                        <div className="min-w-0 space-y-2 break-words text-xs text-slate-600">
                          <p className="leading-relaxed">{log.reason || 'Không có ghi chú bổ sung.'}</p>
                          {log.policy_reference && (
                            <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-brand-700">
                              <span className="font-semibold">Căn cứ quy chế: </span>{log.policy_reference}
                            </div>
                          )}
                          {log.evidence_ids && (
                            <div className="flex items-start gap-1.5 text-slate-500">
                              <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span className="break-all">Minh chứng: {log.evidence_ids}</span>
                            </div>
                          )}
                          {log.result_snapshot && log.result_snapshot !== 'null' && log.result_snapshot !== '-' && (
                            <div className="space-y-1">
                              <span className="text-[11px] font-semibold text-slate-500">Kết quả</span>
                              <div>{renderResult(log.result_snapshot)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
};