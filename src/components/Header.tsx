import { LogOut } from "lucide-react";
import { useNavigate } from "react-router";
import { NotificationCenter } from "./NotificationCenter";
import { GlobalSearch } from "./GlobalSearch";
import { useAuth } from "../contexts/AuthContext";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="h-16 bg-white border-b border-[#E5E7EB] px-8 flex items-center justify-between">
      <div>
        <h1 className="text-[#1F2937]">{title}</h1>
        {subtitle && <p className="text-sm text-[#6B7280] mt-0.5">{subtitle}</p>}
      </div>
      
      <div className="flex items-center gap-4">
        <GlobalSearch />
        
        <NotificationCenter />

        <button 
          onClick={handleLogout}
          className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
          title="Sair"
        >
          <LogOut size={20} className="text-[#6B7280] group-hover:text-red-600 transition-colors" />
        </button>
      </div>
    </header>
  );
}
