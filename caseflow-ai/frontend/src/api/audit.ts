import { apiClient } from './client';
import { AuditLog } from '../types';

export const getAuditLogs = async (skip: number = 0, limit: number = 100): Promise<AuditLog[]> => {
  const response = await apiClient.get<AuditLog[]>('/audit-logs', {
    params: { skip, limit },
  });
  return response.data;
};

export const getCaseTimeline = async (caseId: string): Promise<AuditLog[]> => {
  const response = await apiClient.get<AuditLog[]>(`/cases/${caseId}/timeline`);
  return response.data;
};
