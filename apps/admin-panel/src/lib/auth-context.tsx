"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiClient } from "./api";

export interface AdminMe {
  id: string;
  name: string;
  email: string;
  image?: string;
  roleName: string | null;
  isSuperAdmin: boolean;
  permissions: string[];
}

interface Ctx {
  me: AdminMe | null;
  loading: boolean;
  can: (permission?: string) => boolean;
  refresh: () => void;
}

const AdminAuthContext = createContext<Ctx>({
  me: null,
  loading: true,
  can: () => false,
  refresh: () => {},
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .get("/admin/me")
      .then((r: unknown) => setMe((r as { data: AdminMe }).data ?? null))
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const can = useCallback(
    (permission?: string) => {
      if (!permission) return true;
      if (!me) return false;
      return me.isSuperAdmin || me.permissions.includes(permission);
    },
    [me],
  );

  return (
    <AdminAuthContext.Provider value={{ me, loading, can, refresh: load }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export const useAdminAuth = () => useContext(AdminAuthContext);
