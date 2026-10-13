import React, { useState } from 'react';

export default function AgentSources({ sources = [] }) {
  const [open, setOpen] = useState(false);
  if (!Array.isArray(sources) || sources.length === 0) return null;
  return (
    <section className="agent-sources" aria-label="Nguồn knowledge base">
      <button type="button" className="agent-sources-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        Nguồn tham khảo ({sources.length})
      </button>
      {open && (
        <ul>
          {sources.map(source => (
            <li key={source.chunkId || `${source.sourceKey}-${source.heading}`}>
              <strong>{source.title || 'Tài liệu nội bộ'}</strong>
              <span>{String(source.path || '').split(/[\\/]/).pop()}</span>
              {source.heading && <span>§ {source.heading}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
