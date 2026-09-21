import { apiClient } from './client';
import { Escalation, HumanReview } from '../types';

export interface ActionPayload {
  reviewer_name: string;
  reviewer_role: string;
  reason: string;
}

export const getPendingReviews = async (): Promise<Escalation[]> => {
  const response = await apiClient.get<Escalation[]>('/human-review');
  return response.data;
};

export const getEscalationById = async (id: string): Promise<Escalation> => {
  const response = await apiClient.get<Escalation>(`/human-review/${id}`);
  return response.data;
};

export const approveEscalation = async (id: string, payload: ActionPayload): Promise<HumanReview> => {
  const response = await apiClient.post<HumanReview>(`/human-review/${id}/approve`, payload);
  return response.data;
};

export const rejectEscalation = async (id: string, payload: ActionPayload): Promise<HumanReview> => {
  const response = await apiClient.post<HumanReview>(`/human-review/${id}/reject`, payload);
  return response.data;
};

export const overrideEscalation = async (id: string, payload: ActionPayload): Promise<HumanReview> => {
  const response = await apiClient.post<HumanReview>(`/human-review/${id}/override`, payload);
  return response.data;
};

export const requestInfoEscalation = async (id: string, payload: ActionPayload): Promise<HumanReview> => {
  const response = await apiClient.post<HumanReview>(`/human-review/${id}/request-information`, payload);
  return response.data;
};
