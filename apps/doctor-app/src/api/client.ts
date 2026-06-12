import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

// EXPO_PUBLIC_API_URL is the bare API origin (e.g. http://192.168.0.159:3001).
// The REST client appends the /api/v1 global prefix; the chat socket uses the
// origin directly with its own /chat namespace. Keep this in sync with user-app.
const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const API_BASE_URL = `${API_ORIGIN}/api/v1`;

const ACCESS_KEY = "doctorAccessToken";
const REFRESH_KEY = "doctorRefreshToken";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(ACCESS_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single-flight refresh: many requests can 401 at once, but only one /auth/refresh
// runs; the rest await the same promise.
let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    // Bare axios (not apiClient) so this request can't recurse through the interceptor.
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken,
    });
    const data = res.data?.data ?? res.data;
    const newAccess: string | undefined = data?.accessToken;
    const newRefresh: string | undefined = data?.refreshToken;
    if (!newAccess) return null;
    await SecureStore.setItemAsync(ACCESS_KEY, newAccess);
    if (newRefresh) await SecureStore.setItemAsync(REFRESH_KEY, newRefresh);
    return newAccess;
  } catch {
    return null;
  }
}

function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const isAuthRoute = original?.url?.includes("/auth/");

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthRoute
    ) {
      original._retry = true;
      const newAccess = await refreshAccessToken();
      if (newAccess) {
        original.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(original); // retry with the fresh token
      }
      // Refresh failed/absent — clear the session (caller's auth state logs out).
      await SecureStore.deleteItemAsync(ACCESS_KEY);
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    }
    return Promise.reject(error.response?.data ?? error);
  },
);
