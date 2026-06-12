import { apiClient } from "./client";
import { AuthTokens } from "@doctium/types";

// The REST client returns the full { status, message, data } envelope; these
// auth helpers are typed to resolve the flat token object, so unwrap `.data`.
const unwrap = (res: unknown): AuthTokens => (res as { data: AuthTokens }).data;

export const authApi = {
  register: async (data: {
    name: string;
    mobile: string;
    email?: string;
    password?: string;
    referralCode?: string;
  }): Promise<AuthTokens> =>
    unwrap(await apiClient.post("/auth/user/register", data)),

  login: async (data: {
    mobile?: string;
    email?: string;
    password: string;
  }): Promise<AuthTokens> =>
    unwrap(await apiClient.post("/auth/user/login", data)),

  sendOtp: (mobile: string) =>
    apiClient.post("/auth/user/otp/send", { mobile }),

  verifyOtp: async (mobile: string, otp: string): Promise<AuthTokens> =>
    unwrap(await apiClient.post("/auth/user/otp/verify", { mobile, otp })),

  // Email verification (post-signup): 6-digit code or emailed link.
  sendEmailVerification: (email: string) =>
    apiClient.post("/auth/email-verification/send", { email }),

  verifyEmail: (email: string, code: string) =>
    apiClient.post("/auth/email-verification/verify", { email, code }),
};
