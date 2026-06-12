import axios from 'axios';
import { toast } from './toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Pull a human-readable message out of the API's { statusCode, message, error } error body. */
function errorMessage(err: { response?: { data?: { message?: string | string[] } }; message?: string }): string {
  const m = err.response?.data?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong';
  return m ?? err.message ?? 'Something went wrong';
}

apiClient.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status;
    const onLogin = typeof window !== 'undefined' && window.location.pathname.includes('/login');
    const hadSession = typeof window !== 'undefined' && !!localStorage.getItem('adminToken');

    if (status === 401 && hadSession) {
      // An authenticated session went stale — surface it and bounce to login.
      localStorage.removeItem('adminToken');
      toast.error('Your session expired. Please sign in again.');
      if (!onLogin) window.location.href = '/login';
    } else if (status !== 401 || !onLogin) {
      // Surface every other failure. (A 401 on the login screen is just bad
      // credentials — the login form shows that inline, so don't double-toast.)
      toast.error(errorMessage(err));
    }

    return Promise.reject(err.response?.data ?? err);
  },
);
