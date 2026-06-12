import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// EXPO_PUBLIC_API_URL is the bare API origin (e.g. http://192.168.0.159:3001).
// The REST client appends the /api/v1 global prefix; the chat socket uses the
// origin directly with its own /chat namespace.
const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const API_BASE_URL = `${API_ORIGIN}/api/v1`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
    }
    return Promise.reject(error.response?.data ?? error);
  },
);
