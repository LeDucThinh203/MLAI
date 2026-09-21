import React from 'react';

export const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="text-center p-8 bg-white border border-dashed border-slate-200 rounded-lg">
    <h3 className="text-base font-semibold text-slate-800">{title}</h3>
    <p className="text-sm text-slate-500 mt-1">{description}</p>
  </div>
);
