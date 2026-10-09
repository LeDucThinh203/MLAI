import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : 'http://localhost:3001/api');
export const SERVER_BASE = API_BASE.replace(/\/api\/?$/, '');

// Cookie authentication does not expose a bearer token to JavaScript.
export const getAuthHeaders = () => ({ withCredentials: true });

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  config.withCredentials = true;
  delete config.headers.Authorization;
  delete config.headers.authorization;
  return config;
});

export default apiClient;
