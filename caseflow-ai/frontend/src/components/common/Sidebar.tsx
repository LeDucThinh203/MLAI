import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  PlusCircle,
  FileCheck2,
  AlertTriangle,
  History,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { to: '/', label: 'Tổng quan (Home)', icon: Home },
    { to: '/cases/new', label: 'Tạo hồ sơ mới (New Case)', icon: PlusCircle },
    { to: '/human-review', label: 'Hồ sơ chờ duyệt (Human Review)', icon: AlertTriangle },
    { to: '/verify', label: 'Kiểm thử chuẩn hóa (Verify)', icon: CheckCircle2 },
    { to: '/policies', label: 'Quy chế học vụ (Policies)', icon: BookOpen },
    { to: '/audit-logs', label: 'Nhật ký kiểm toán (Audit Trail)', icon: History },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
        <p className="font-semibold text-slate-700 mb-1">Quy tắc Safeguard:</p>
        <ul className="list-disc list-inside space-y-0.5 text-[11px]">
          <li>Mâu thuẫn dữ liệu → DỪNG</li>
          <li>Ảnh mờ thiếu tin → DỪNG</li>
          <li>Vượt quyền AI → LEO THANG</li>
        </ul>
      </div>
    </aside>
  );
};
