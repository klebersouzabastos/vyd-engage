import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
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

  const login = async (email: string, password: string) => {
    const result = await apiClient.login({ email, password });
    setUser(result.user);
  };

  const register = async (data: {
    email: string;
    password: string;
    name: string;
    companyName: string;
  }) => {
    const result = await apiClient.register(data);
    setUser(result.user);
  };

  const logout = async () => {
    await apiClient.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const data = await apiClient.getCurrentUser();
      setUser(data.user);
    } catch (error) {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
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

