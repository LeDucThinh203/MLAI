import { apiClient } from './client';
import { Department } from '../types';

export const getDepartments = async (): Promise<Department[]> => {
  const response = await apiClient.get<Department[]>('/departments');
  return response.data;
};
