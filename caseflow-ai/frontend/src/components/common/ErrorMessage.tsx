import React from 'react';

export const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
    <span>⚠️</span>
    <span>{message}</span>
  </div>
);
