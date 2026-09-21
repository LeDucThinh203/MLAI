import { apiClient } from './client';
import { Evidence, EvidenceExtraction } from '../types';

export const uploadEvidence = async (
  caseId: string,
  file: File,
  evidenceType: string = 'RECEIPT',
  sourceDescription?: string
): Promise<Evidence> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('evidence_type', evidenceType);
  if (sourceDescription) {
    formData.append('source_description', sourceDescription);
  }

  const response = await apiClient.post<Evidence>(`/cases/${caseId}/evidence`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getEvidenceList = async (caseId: string): Promise<Evidence[]> => {
  const response = await apiClient.get<Evidence[]>(`/cases/${caseId}/evidence`);
  return response.data;
};

export const analyzeEvidence = async (evidenceId: string): Promise<EvidenceExtraction> => {
  const response = await apiClient.post<EvidenceExtraction>(`/evidence/${evidenceId}/analyze`);
  return response.data;
};
