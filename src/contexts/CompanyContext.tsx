import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { apiClient } from '../services/api/client';

interface CompanyContextType {
  logo: string | null;
  companyName: string;
  setLogo: (logo: string | null) => void;
  setCompanyName: (name: string) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();

  const [logo, setLogoState] = useState<string | null>(user?.tenant?.logo || null);
  const [companyName, setCompanyNameState] = useState<string>(user?.tenant?.name || 'VYD Engage');

  // Sync from auth user when it changes
  useEffect(() => {
    if (user?.tenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado local a partir de user.tenant (props/dados de auth)
      setLogoState(user.tenant.logo || null);
      setCompanyNameState(user.tenant.name || 'VYD Engage');
    }
  }, [user?.tenant?.name, user?.tenant?.logo]);

  const setLogo = useCallback(
    async (newLogo: string | null) => {
      setLogoState(newLogo);
      try {
        await apiClient.updateTenant({ logo: newLogo });
        if (refreshUser) await refreshUser();
      } catch (error) {
        console.error('Erro ao atualizar logo:', error);
      }
    },
    [refreshUser]
  );

  const setCompanyName = useCallback(
    async (name: string) => {
      setCompanyNameState(name);
      try {
        await apiClient.updateTenant({ name });
        if (refreshUser) await refreshUser();
      } catch (error) {
        console.error('Erro ao atualizar nome da empresa:', error);
      }
    },
    [refreshUser]
  );

  const value = useMemo(
    () => ({
      logo,
      companyName,
      setLogo,
      setCompanyName,
    }),
    [logo, companyName, setLogo, setCompanyName]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
