import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => (
  <div className="text-center py-16 space-y-4">
    <h1 className="text-4xl font-extrabold text-slate-800">404</h1>
    <p className="text-sm text-slate-500">Trang bạn tìm kiếm không tồn tại.</p>
    <Link
      to="/"
      className="inline-block px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700"
    >
      Về trang chủ
    </Link>
  </div>
);
