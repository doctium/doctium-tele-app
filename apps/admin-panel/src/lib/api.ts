import axios from "axios";
import { toast } from "./toast";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  // Send the httpOnly session cookie with every request. The JWT is no longer
  // kept in localStorage (so an XSS payload can't read it).
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

/** Read a non-httpOnly cookie value in the browser. */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m && m[1] !== undefined ? decodeURIComponent(m[1]) : null;
}

// CSRF double-submit: echo the readable CSRF cookie in a header on mutating requests.
apiClient.interceptors.request.use((config) => {
  const method = (config.method ?? "get").toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method)) {
    const csrf = readCookie("doctium_csrf");
    if (csrf) config.headers["X-CSRF-Token"] = csrf;
  }
  return config;
});

/** Pull a human-readable message out of the API's { statusCode, message, error } error body. */
function errorMessage(err: {
  response?: { data?: { message?: string | string[] } };
  message?: string;
}): string {
  const m = err.response?.data?.message;
  if (Array.isArray(m)) return m[0] ?? "Something went wrong";
  return m ?? err.message ?? "Something went wrong";
}

apiClient.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status;
    const onLogin =
      typeof window !== "undefined" &&
      window.location.pathname.includes("/login");

    if (status === 401) {
      // No/expired session. On the login screen a 401 is just bad credentials
      // (the form shows that inline); elsewhere, surface it and bounce to login.
      if (!onLogin && typeof window !== "undefined") {
        toast.error("Your session expired. Please sign in again.");
        window.location.href = "/login";
      }
    } else {
      toast.error(errorMessage(err));
    }

    return Promise.reject(err.response?.data ?? err);
  },
);
