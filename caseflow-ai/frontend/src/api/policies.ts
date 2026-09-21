import { apiClient } from './client';
import { Policy } from '../types';

export const getPolicies = async (): Promise<Policy[]> => {
  const response = await apiClient.get<Policy[]>('/policies');
  return response.data;
};

export const getPolicyById = async (id: string): Promise<Policy> => {
  const response = await apiClient.get<Policy>(`/policies/${id}`);
  return response.data;
};
