import { Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  GitBranch,
  Zap,
  Settings,
  LogOut,
  CheckSquare,
  BarChart3,
  Inbox,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useCompany } from "../contexts/CompanyContext";
import { useAuth } from "../contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { useTasks } from "../hooks/useTasks";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/app", tourId: "sidebar-dashboard" },
  { icon: Users, label: "Leads", path: "/app/leads", tourId: "sidebar-leads" },
  { icon: UsersRound, label: "Equipe", path: "/app/team", tourId: "sidebar-team", adminOnly: true },
  { icon: GitBranch, label: "Funil", path: "/app/pipeline", tourId: "sidebar-pipeline" },
  { icon: Inbox, label: "Inbox", path: "/app/inbox", tourId: "sidebar-inbox" },
  { icon: Zap, label: "Automações", path: "/app/automations", tourId: "sidebar-automations" },
  { icon: CheckSquare, label: "Tarefas", path: "/app/tasks", tourId: "sidebar-tasks" },
  { icon: BarChart3, label: "Relatórios", path: "/app/reports", tourId: "sidebar-reports" },
  { icon: CreditCard, label: "Billing", path: "/app/billing", tourId: "sidebar-billing" },
  { icon: Settings, label: "Configurações", path: "/app/settings", tourId: "sidebar-settings" },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ open = false, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logo, companyName } = useCompany();
  const { tasks } = useTasks();
  
  const { user } = useAuth();

  const userProfile = {
    name: user?.name || "Usuário",
    email: user?.email || "",
    avatar: user?.avatar || null,
  };

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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    if (onClose) onClose();
  };

  return (
    <aside
      aria-label="Menu principal"
      data-sidebar={collapsed ? "collapsed" : "expanded"}
      className={`
      w-64 bg-white border-r border-gray-300 h-screen fixed left-0 top-0 flex flex-col
      z-50 transition-all duration-300 ease-in-out overflow-hidden
      ${open ? 'translate-x-0' : '-translate-x-full'}
      md:translate-x-0
    `}>
      {/* Logo + Collapse toggle */}
      <div className="h-16 flex items-center border-b border-gray-300 justify-between">
        <Link
          to="/app"
          className={`flex items-center hover:bg-gray-100 transition-colors cursor-pointer h-full flex-1 min-w-0 ${collapsed ? 'px-3 justify-center' : 'px-6'}`}
        >
          <div className={`flex items-center ${collapsed ? '' : 'gap-2.5'}`}>
            {logo ? (
              <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center bg-white border border-gray-300 p-1 flex-shrink-0">
                <img
                  src={logo}
                  alt={`${companyName} logo`}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">F</span>
              </div>
            )}
            {!collapsed && <span className="font-semibold text-gray-900 text-sm truncate">{companyName}</span>}
          </div>
        </Link>
        {/* Collapse toggle — desktop only */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex items-center justify-center p-2 mr-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Menu Items */}
      <nav aria-label="Navegação do aplicativo" className={`flex-1 overflow-y-auto py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
        {menuItems.filter(item => !item.adminOnly || user?.role === 'ADMIN').map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              aria-current={isActive ? 'page' : undefined}
              data-tour={item.tourId}
              title={collapsed ? item.label : undefined}
              className={`
                flex items-center rounded-lg mb-1 transition-colors relative
                ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'}
                ${isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }
              `}
            >
              <Icon size={20} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {item.path === "/app/tasks" && pendingTasksCount > 0 && (
                collapsed ? (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                    {pendingTasksCount}
                  </span>
                ) : (
                  <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {pendingTasksCount}
                  </span>
                )
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-gray-300">
        <Link
          to="/app/profile"
          title={collapsed ? userProfile.name : undefined}
          className={`
            transition-colors block
            ${collapsed ? 'p-2 flex justify-center' : 'p-4'}
            ${location.pathname === "/app/profile"
              ? "bg-primary-50"
              : "hover:bg-gray-100"
            }
          `}
        >
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <Avatar className={`flex-shrink-0 ${collapsed ? 'w-8 h-8' : 'w-10 h-10'}`}>
              {userProfile.avatar ? (
                <AvatarImage
                  src={userProfile.avatar}
                  alt={userProfile.name}
                />
              ) : null}
              <AvatarFallback className="bg-primary text-white text-sm font-medium">
                {getInitials(userProfile.name)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate font-medium">{userProfile.name}</p>
                <p className="text-xs text-gray-600 truncate">{userProfile.email}</p>
              </div>
            )}
          </div>
        </Link>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          aria-label="Sair da conta"
          title={collapsed ? "Sair" : undefined}
          className={`
            w-full border-t border-gray-300 flex items-center text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors
            ${collapsed ? 'justify-center p-3' : 'gap-3 p-4'}
          `}
        >
          <LogOut size={20} />
          {!collapsed && <span className="text-sm font-medium">Sair</span>}
        </button>
      </div>
    </aside>
  );
}
