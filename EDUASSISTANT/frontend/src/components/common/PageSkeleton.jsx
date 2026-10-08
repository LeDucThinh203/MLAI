import React from 'react';

const Line = ({ className = '' }) => <span className={`skeleton-line ${className}`} />;

/** Layout-preserving loading state shared by the application portals. */
export default function PageSkeleton({ variant = 'portal', label = 'Loading content' }) {
  const isForm = variant === 'form' || variant === 'settings';
  const isVerification = variant === 'verification';

  return (
    <section className={`page-skeleton page-skeleton--${variant}`} aria-busy="true" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="skeleton-heading">
        <Line className="skeleton-line--title" />
        <Line className="skeleton-line--subtitle" />
      </div>

      {isVerification ? (
        <div className="skeleton-verification">
          <Line className="skeleton-line--stamp" />
          <div className="skeleton-detail-grid">
            {Array.from({ length: 6 }, (_, index) => <Line key={index} className="skeleton-line--detail" />)}
          </div>
        </div>
      ) : isForm ? (
        <div className="skeleton-form">
          {Array.from({ length: 5 }, (_, index) => <div className="skeleton-field" key={index}><Line className="skeleton-line--label" /><Line className="skeleton-line--input" /></div>)}
          <Line className="skeleton-line--button" />
        </div>
      ) : (
        <>
          <div className="skeleton-stat-grid">
            {Array.from({ length: 4 }, (_, index) => <div className="skeleton-stat" key={index}><Line className="skeleton-line--label" /><Line className="skeleton-line--value" /></div>)}
          </div>
          <div className="skeleton-content-grid">
            <div className="skeleton-panel"><Line className="skeleton-line--section" />{Array.from({ length: 5 }, (_, index) => <Line key={index} className="skeleton-line--row" />)}</div>
            <div className="skeleton-panel"><Line className="skeleton-line--section" />{Array.from({ length: 4 }, (_, index) => <Line key={index} className="skeleton-line--row" />)}</div>
          </div>
        </>
      )}
    </section>
  );
}
