import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, ApiError } from "@/lib/api";
import type {
  ActivateAccountRequest,
  ApiMessage,
  MemberRead,
  ResetPasswordRequest,
} from "@/types";

// ============================================================
// Context shape
// ============================================================
interface AuthContextValue {
  user: MemberRead | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  activateAccount: (payload: ActivateAccountRequest) => Promise<ApiMessage>;
  forgotPassword: (email: string) => Promise<ApiMessage>;
  resetPassword: (payload: ResetPasswordRequest) => Promise<ApiMessage>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================
// Provider
// ============================================================
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MemberRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.get<MemberRead>("/auth/me");
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setUser(null);
      } else {
        // Unexpected error (network failure, 5xx) — log but don't clear user
        console.error("[AuthContext] refreshUser failed:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Listen for global logout event (dispatched by 401 interceptor in api.ts)
  useEffect(() => {
    const handler = () => {
      setUser(null);
      setIsLoading(false);
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // POST /auth/login sets httpOnly cookies; token in body is ignored
    await api.post("/auth/login", { email, password });
    const me = await api.get<MemberRead>("/auth/me");
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Best-effort — clear state regardless
    }
    setUser(null);
  }, []);

  const activateAccount = useCallback((payload: ActivateAccountRequest) => {
    return api.post<ApiMessage>("/auth/activate", payload);
  }, []);

  const forgotPassword = useCallback((email: string) => {
    return api.post<ApiMessage>("/auth/forgot-password", { email });
  }, []);

  const resetPassword = useCallback((payload: ResetPasswordRequest) => {
    return api.post<ApiMessage>("/auth/reset-password", payload);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        activateAccount,
        forgotPassword,
        resetPassword,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
