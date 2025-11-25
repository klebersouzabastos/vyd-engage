import { Link, useLocation, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Users, 
  GitBranch, 
  Zap, 
  Settings,
  LogOut,
  CheckSquare,
  BarChart3
} from "lucide-react";
import { useCompany } from "../contexts/CompanyContext";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { useTasks } from "../hooks/useTasks";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/app" },
  { icon: Users, label: "Leads", path: "/app/leads" },
  { icon: GitBranch, label: "Funil", path: "/app/pipeline" },
  { icon: Zap, label: "Automações", path: "/app/automations" },
  { icon: CheckSquare, label: "Tarefas", path: "/app/tasks" },
  { icon: BarChart3, label: "Relatórios", path: "/app/reports" },
  { icon: Settings, label: "Configurações", path: "/app/settings" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logo, companyName } = useCompany();
  const { tasks } = useTasks();
  
  const [userProfile, setUserProfile] = useState({
    name: "João Silva",
    email: "joao@empresa.com",
    avatar: null as string | null,
  });

  // Calcular contador de tarefas pendentes
  const pendingTasksCount = (() => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const overdue = tasks.filter((task) => {
      if (task.status === 'COMPLETED' || !task.dueDate) return false;
      return new Date(task.dueDate) < now;
    }).length;

    const todayTasks = tasks.filter((task) => {
      if (task.status === 'COMPLETED' || !task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      return dueDate >= today && dueDate < tomorrow;
    }).length;

    return overdue + todayTasks;
  })();

  // Carregar dados do perfil do localStorage
  useEffect(() => {
    const savedProfile = localStorage.getItem("userProfile");
    const savedAvatar = localStorage.getItem("userAvatar");
    
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setUserProfile({
          name: parsed.name || "João Silva",
          email: parsed.email || "joao@empresa.com",
          avatar: savedAvatar,
        });
      } catch (error) {
        console.error("Erro ao carregar perfil:", error);
      }
    }
  }, [location.pathname]); // Recarregar quando mudar de página (pode ter atualizado o perfil)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = () => {
    // Limpar dados de autenticação (se houver)
    localStorage.removeItem("authToken");
    localStorage.removeItem("userData");
    
    // Redirecionar para login
    navigate("/login");
  };

  return (
    <aside className="w-64 bg-white border-r border-[#E5E7EB] h-screen fixed left-0 top-0 flex flex-col">
      {/* Logo */}
      <Link 
        to="/app" 
        className="h-16 flex items-center px-6 border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          {logo ? (
            <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center bg-white border border-[#E5E7EB] p-1 flex-shrink-0">
              <img 
                src={logo} 
                alt={`${companyName} logo`}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-[#2563EB] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">F</span>
            </div>
          )}
          <span className="font-semibold text-[#1F2937] text-sm truncate">{companyName}</span>
        </div>
      </Link>

      {/* Menu Items */}
      <nav className="flex-1 px-3 py-4">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors relative
                ${isActive 
                  ? 'bg-[#2563EB] text-white' 
                  : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#1F2937]'
                }
              `}
            >
              <Icon size={20} />
              <span>{item.label}</span>
              {item.path === "/app/tasks" && pendingTasksCount > 0 && (
                <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {pendingTasksCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-[#E5E7EB]">
        <Link
          to="/app/profile"
          className={`
            p-4 transition-colors block
            ${location.pathname === "/app/profile"
              ? "bg-[#F0F4FF]"
              : "hover:bg-[#F9FAFB]"
            }
          `}
        >
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 flex-shrink-0">
              {userProfile.avatar ? (
                <AvatarImage 
                  src={userProfile.avatar} 
                  alt={userProfile.name}
                />
              ) : null}
              <AvatarFallback className="bg-[#2563EB] text-white text-sm font-medium">
                {getInitials(userProfile.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#1F2937] truncate font-medium">{userProfile.name}</p>
              <p className="text-xs text-[#6B7280] truncate">{userProfile.email}</p>
            </div>
          </div>
        </Link>
        
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full p-4 border-t border-[#E5E7EB] flex items-center gap-3 text-[#6B7280] hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={20} />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}
