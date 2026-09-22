import { apiClient } from './client';
import { VerificationRun } from '../types';

export const runVerificationSuite = async (): Promise<VerificationRun> => {
  const response = await apiClient.post<VerificationRun>('/verify/run');
  return response.data;
};

export const runCoreVerification = async (): Promise<VerificationRun> =>
  (await apiClient.post<VerificationRun>('/verify/core')).data;

export const runEscalationChallenge = async (): Promise<VerificationRun> =>
  (await apiClient.post<VerificationRun>('/verify/escalation-challenge')).data;

export const getVerificationRuns = async (): Promise<VerificationRun[]> => {
  const response = await apiClient.get<VerificationRun[]>('/verify/runs');
  return response.data;
};

export const getVerificationRunById = async (id: string): Promise<VerificationRun> => {
  const response = await apiClient.get<VerificationRun>(`/verify/runs/${id}`);
  return response.data;
};
