import { isAxiosError } from 'axios';

/** Convert API and browser errors to one safe message for the interface. */
export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    return typeof detail === 'string' && detail.trim() ? detail : error.message || fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
};
