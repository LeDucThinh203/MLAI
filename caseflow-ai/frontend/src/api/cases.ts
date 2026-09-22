import { apiClient } from './client';
import { AnalysisResult, Case, CaseDetail, SeedCasesResult, WorkflowActionResult } from '../types';

export interface CreateCaseDto {
  title: string;
  description: string;
  student_identifier: string;
  case_type: string;
  sis_amount?: number;
  sis_status?: string;
  current_department_id?: string;
}

export const getCases = async (status?: string): Promise<Case[]> => {
  const params = status ? { status } : {};
  const response = await apiClient.get<Case[]>('/cases', { params });
  return response.data;
};

export const getCaseById = async (id: string): Promise<CaseDetail> => {
  const response = await apiClient.get<CaseDetail>(`/cases/${id}`);
  return response.data;
};

export const createCase = async (data: CreateCaseDto): Promise<Case> => {
  const response = await apiClient.post<Case>('/cases', data);
  return response.data;
};

export const analyzeCase = async (id: string): Promise<AnalysisResult> => {
  const response = await apiClient.post<AnalysisResult>(`/cases/${id}/analyze`);
  return response.data;
};

export const stopCaseWorkflow = async (id: string, reason: string): Promise<WorkflowActionResult> => {
  const response = await apiClient.post<WorkflowActionResult>(`/cases/${id}/stop`, null, { params: { reason } });
  return response.data;
};

export const resumeCaseWorkflow = async (id: string, reason: string): Promise<WorkflowActionResult> => {
  const response = await apiClient.post<WorkflowActionResult>(`/cases/${id}/resume`, null, { params: { reason } });
  return response.data;
};

export const seed5Escalations = async (): Promise<SeedCasesResult> => {
  const response = await apiClient.post<SeedCasesResult>('/cases/seed-5-escalations');
  return response.data;
};
