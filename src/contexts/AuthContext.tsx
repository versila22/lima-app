import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, ApiError, getToken, removeToken, setToken } from "@/lib/api";
import type { MemberRead, TokenResponse } from "@/types";

// ============================================================
// Context shape
// ============================================================
interface AuthContextValue {
  user: MemberRead | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================
// Provider
// ============================================================
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MemberRead | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch /auth/me and update user state
  const refreshUser = useCallback(async () => {
    const stored = getToken();
    if (!stored) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const me = await api.get<MemberRead>("/auth/me");
      setUser(me);
    } catch (err) {
      // Invalid / expired token
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        removeToken();
        setTokenState(null);
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<TokenResponse>("/auth/login", { email, password });
    setToken(data.access_token);
    setTokenState(data.access_token);
    // Fetch user profile after successful login
    const me = await api.get<MemberRead>("/auth/me");
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setTokenState(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
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
