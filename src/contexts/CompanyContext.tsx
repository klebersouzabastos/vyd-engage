import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

interface CompanyContextType {
  logo: string | null;
  companyName: string;
  setLogo: (logo: string | null) => void;
  setCompanyName: (name: string) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [logo, setLogoState] = useState<string | null>(() => {
    const saved = localStorage.getItem("companyLogo");
    return saved || null;
  });
  
  const [companyName, setCompanyNameState] = useState<string>(() => {
    const saved = localStorage.getItem("companyName");
    return saved || "FlowCRM";
  });

  const setLogo = useCallback((newLogo: string | null) => {
    try {
      setLogoState(newLogo);
      if (newLogo) {
        localStorage.setItem("companyLogo", newLogo);
      } else {
        localStorage.removeItem("companyLogo");
      }
    } catch (error) {
      if (error instanceof DOMException && error.code === 22) {
        alert('O arquivo é muito grande. Tente uma imagem menor.');
      }
    }
  }, []);

  const setCompanyName = useCallback((name: string) => {
    setCompanyNameState(name);
    localStorage.setItem("companyName", name);
  }, []);

  const value = useMemo(() => ({
    logo, companyName, setLogo, setCompanyName,
  }), [logo, companyName, setLogo, setCompanyName]);

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}

