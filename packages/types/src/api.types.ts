export interface ApiResponse<T = unknown> {
  status: boolean;
  message: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  status: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: "user" | "doctor" | "admin";
  iat?: number;
  exp?: number;
  // Attached at request time for admin (Employee) principals by the JWT strategy — live RBAC.
  permissions?: string[];
  isSuperAdmin?: boolean;
}
