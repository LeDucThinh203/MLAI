import React from 'react';

export default function PaginationControls({ page, totalItems, pageSize = 10, onPageChange, label = 'dữ liệu' }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;
  return (
    <nav className="list-pagination" aria-label={`Phân trang ${label}`}>
      <span>Trang <strong>{page}</strong> / <strong>{totalPages}</strong> · {totalItems} {label}</span>
      <div>
        <button className="btn-secondary" onClick={() => onPageChange(1)} disabled={page === 1}>Đầu</button>
        <button className="btn-secondary" onClick={() => onPageChange(page - 1)} disabled={page === 1}>Trước</button>
        <button className="btn-secondary" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>Sau</button>
        <button className="btn-secondary" onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>Cuối</button>
      </div>
    </nav>
  );
}
