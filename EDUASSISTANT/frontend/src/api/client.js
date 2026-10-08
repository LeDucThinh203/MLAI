import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : 'http://localhost:3001/api');
export const SERVER_BASE = API_BASE.replace(/\/api\/?$/, '');

export const getAuthHeaders = (token) => ({
  headers: { Authorization: `Bearer ${token || localStorage.getItem('cf_token')}` }
});

export const apiClient = axios.create({
  baseURL: API_BASE,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cf_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
