import { createContext, useContext, useState, ReactNode } from "react";

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

  const setLogo = (newLogo: string | null) => {
    try {
      setLogoState(newLogo);
      if (newLogo) {
        localStorage.setItem("companyLogo", newLogo);
        console.log('Logo salvo no localStorage');
      } else {
        localStorage.removeItem("companyLogo");
        console.log('Logo removido do localStorage');
      }
    } catch (error) {
      console.error('Erro ao salvar logo:', error);
      // Se o localStorage estiver cheio, tentar limpar e salvar novamente
      if (error instanceof DOMException && error.code === 22) {
        alert('O arquivo é muito grande. Tente uma imagem menor.');
      }
    }
  };

  const setCompanyName = (name: string) => {
    setCompanyNameState(name);
    localStorage.setItem("companyName", name);
  };

  return (
    <CompanyContext.Provider value={{ logo, companyName, setLogo, setCompanyName }}>
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

