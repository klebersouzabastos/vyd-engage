import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { apiClient } from '../services/api/client';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  role: string;
  tenantId: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
  };
}

interface TwoFactorRequired {
  requiresTwoFactor: true;
  userId: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<TwoFactorRequired | void>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    companyName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const data = await apiClient.getCurrentUser();
      setUser(data.user);
    } catch (error) {
      // User is not authenticated or API error - set user to null
      setUser(null);
    } finally {
      // Always set loading to false, even on error
      // This ensures components can render properly
      setLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string, totpCode?: string): Promise<TwoFactorRequired | void> => {
    const body: Record<string, string> = { email, password };
    if (totpCode) body.totpCode = totpCode;
    const result = await apiClient.login(body as any);
    if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
      return result as unknown as TwoFactorRequired;
    }
    setUser(result.user);
  }, []);

  const register = useCallback(async (data: {
    email: string;
    password: string;
    name: string;
    companyName: string;
  }) => {
    const result = await apiClient.register(data);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    await apiClient.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiClient.getCurrentUser();
      setUser(data.user);
    } catch (error) {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    register,
    logout,
    refreshUser,
  }), [user, loading, login, register, logout, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

