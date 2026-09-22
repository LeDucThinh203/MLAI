import React from 'react';
import { CaseStatus, EscalationType, DecisionType } from '../../types';
import { getStatusPresentation } from '../../utils/status';

interface StatusBadgeProps {
  status: CaseStatus | EscalationType | DecisionType | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const presentation = getStatusPresentation(status);

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${presentation.className}`}>
      {presentation.label}
    </span>
  );
};
