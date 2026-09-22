export interface StatusPresentation {
  label: string;
  className: string;
}

const STATUS_PRESENTATIONS: Record<string, StatusPresentation> = {
  NEW: { label: 'Mới nộp', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  ANALYZING: { label: 'Đang phân tích...', className: 'bg-purple-50 text-purple-700 border-purple-200 animate-pulse' },
  AUTO_RESOLVED: { label: 'Tự động giải quyết', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  AUTO_RESOLVE: { label: 'Tự động giải quyết', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  APPROVED: { label: 'Đã phê duyệt', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MATCH: { label: 'Khớp hoàn toàn', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MISMATCH: { label: 'Mâu thuẫn dữ liệu', className: 'bg-amber-50 text-amber-800 border-amber-300' },
  ESCALATED: { label: 'Leo thang', className: 'bg-amber-50 text-amber-800 border-amber-300' },
  ESCALATE: { label: 'Leo thang', className: 'bg-amber-50 text-amber-800 border-amber-300' },
  WAITING_FOR_HUMAN: { label: 'Chờ cán bộ duyệt', className: 'bg-amber-50 text-amber-800 border-amber-300' },
  WAITING_FOR_INFORMATION: { label: 'Chờ bổ sung thông tin', className: 'bg-amber-50 text-amber-800 border-amber-300' },
  DATA_CONFLICT: { label: 'Mâu thuẫn dữ liệu', className: 'bg-amber-50 text-amber-800 border-amber-300' },
  AUTHORITY_REQUIRED: { label: 'Vượt hạn mức thẩm quyền', className: 'bg-amber-50 text-amber-800 border-amber-300' },
  FACT_UNKNOWN: { label: 'Minh chứng mờ / thiếu tin', className: 'bg-amber-50 text-amber-800 border-amber-300' },
  POLICY_OUT_OF_SCOPE: { label: 'Ngoài danh mục quy chế', className: 'bg-amber-50 text-amber-800 border-amber-300' },
  OWNERSHIP_UNCLEAR: { label: 'Chưa rõ bên nhận', className: 'bg-amber-50 text-amber-800 border-amber-300' },
  REJECTED: { label: 'Từ chối', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  REJECT: { label: 'Từ chối', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  FAILED: { label: 'Thất bại', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  STOPPED: { label: 'Đã tạm dừng', className: 'bg-slate-100 text-slate-700 border-slate-300' },
};

const DEFAULT_PRESENTATION: StatusPresentation = {
  label: 'Không xác định',
  className: 'bg-slate-50 text-slate-700 border-slate-200',
};

export const getStatusPresentation = (status: string): StatusPresentation =>
  STATUS_PRESENTATIONS[status] ?? { ...DEFAULT_PRESENTATION, label: status || DEFAULT_PRESENTATION.label };
