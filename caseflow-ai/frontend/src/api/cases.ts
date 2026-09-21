import { apiClient } from './client';
import { Case } from '../types';

export interface CreateCaseDto {
  title: string;
  description: string;
  student_identifier: string;
  case_type: string;
  current_department_id?: string;
}

export const getCases = async (status?: string): Promise<Case[]> => {
  const params = status ? { status } : {};
  const response = await apiClient.get<Case[]>('/cases', { params });
  return response.data;
};

export const getCaseById = async (id: string): Promise<Case> => {
  const response = await apiClient.get<Case>(`/cases/${id}`);
  return response.data;
};

export const createCase = async (data: CreateCaseDto): Promise<Case> => {
  const response = await apiClient.post<Case>('/cases', data);
  return response.data;
};

export const analyzeCase = async (id: string): Promise<any> => {
  const response = await apiClient.post(`/cases/${id}/analyze`);
  return response.data;
};

export const stopCaseWorkflow = async (id: string, reason: string): Promise<any> => {
  const response = await apiClient.post(`/cases/${id}/stop`, null, { params: { reason } });
  return response.data;
};

export const resumeCaseWorkflow = async (id: string, reason: string): Promise<any> => {
  const response = await apiClient.post(`/cases/${id}/resume`, null, { params: { reason } });
  return response.data;
};

export const seed5Escalations = async (): Promise<any> => {
  const response = await apiClient.post('/cases/seed-5-escalations');
  return response.data;
};

