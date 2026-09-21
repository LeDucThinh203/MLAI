import React from 'react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Đang tải dữ liệu...' }) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-3">
    <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
    <span className="text-sm text-slate-500 font-medium">{message}</span>
  </div>
);

export const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
    <span>⚠️</span>
    <span>{message}</span>
  </div>
);

export const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="text-center p-8 bg-white border border-dashed border-slate-200 rounded-lg">
    <h3 className="text-base font-semibold text-slate-800">{title}</h3>
    <p className="text-sm text-slate-500 mt-1">{description}</p>
  </div>
);
