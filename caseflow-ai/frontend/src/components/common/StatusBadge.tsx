import React from 'react';
import { CaseStatus, EscalationType, DecisionType } from '../../types';

interface StatusBadgeProps {
  status: CaseStatus | EscalationType | DecisionType | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getBadgeStyle = (s: string) => {
    switch (s) {
      case 'NEW':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ANALYZING':
        return 'bg-purple-50 text-purple-700 border-purple-200 animate-pulse';
      case 'AUTO_RESOLVED':
      case 'AUTO_RESOLVE':
      case 'APPROVED':
      case 'MATCH':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
      case 'ESCALATED':
      case 'ESCALATE':
      case 'WAITING_FOR_HUMAN':
      case 'DATA_CONFLICT':
      case 'AUTHORITY_REQUIRED':
      case 'FACT_UNKNOWN':
      case 'POLICY_OUT_OF_SCOPE':
      case 'MISMATCH':
        return 'bg-amber-50 text-amber-800 border-amber-300 font-semibold';
      case 'REJECTED':
      case 'REJECT':
      case 'FAILED':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-semibold';
      case 'STOPPED':
        return 'bg-slate-100 text-slate-700 border-slate-300 font-semibold';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'NEW':
        return 'Mới nộp';
      case 'ANALYZING':
        return 'Đang phân tích...';
      case 'AUTO_RESOLVED':
      case 'AUTO_RESOLVE':
        return 'Tự động giải quyết (Auto-Resolve)';
      case 'APPROVED':
        return 'Đã phê duyệt';
      case 'MATCH':
        return 'Khớp hoàn toàn';
      case 'MISMATCH':
        return 'Mâu thuẫn (Mismatch)';
      case 'ESCALATED':
      case 'ESCALATE':
        return 'Leo thang (Escalate)';
      case 'WAITING_FOR_HUMAN':
        return 'Chờ cán bộ duyệt';
      case 'DATA_CONFLICT':
        return 'Mâu thuẫn dữ liệu';
      case 'AUTHORITY_REQUIRED':
        return 'Vượt hạn mức thẩm quyền';
      case 'FACT_UNKNOWN':
        return 'Minh chứng mờ / thiếu tin';
      case 'POLICY_OUT_OF_SCOPE':
        return 'Ngoài danh mục quy chế';
      case 'OWNERSHIP_UNCLEAR':
        return 'Chưa rõ bên nhận (Tranh chấp)';
      case 'REJECTED':
      case 'REJECT':
        return 'Từ chối';
      case 'FAILED':
        return 'Thất bại';
      case 'STOPPED':
        return 'Đã tạm dừng khẩn cấp';
      default:
        return s;
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${getBadgeStyle(status)}`}>
      {getStatusLabel(status)}
    </span>
  );
};
