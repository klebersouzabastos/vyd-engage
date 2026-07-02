import { Link, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Building2,
  GitBranch,
  Zap,
  Settings,
  CheckSquare,
  BarChart3,
  Filter,
  Inbox,
  CreditCard,
  Handshake,
  TrendingUp,
  Webhook,
  KeyRound,
  Shield,
  Package,
  Upload,
  Mail,
  ScanSearch,
  MessageSquarePlus,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/hooks/useTasks';

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  tourId: string;
  adminOnly?: boolean;
  managerOnly?: boolean;
  platformAdminOnly?: boolean;
}

// Navegação principal — mesma lista/ordem/ícones/flags da antiga Sidebar/LeftRail
// (spec ribbon-shell-global req 6). Agora vive nas ABAS da ribbon (amendment: nav
// nas abas, sem leftrail).
const menuItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/app', tourId: 'sidebar-dashboard' },
  { icon: Users, label: 'Leads', path: '/app/leads', tourId: 'sidebar-leads' },
  { icon: Building2, label: 'Empresas', path: '/app/companies', tourId: 'sidebar-companies' },
  { icon: UsersRound, label: 'Equipe', path: '/app/team', tourId: 'sidebar-team', adminOnly: true },
  { icon: Handshake, label: 'Deals', path: '/app/deals', tourId: 'sidebar-deals' },
  { icon: TrendingUp, label: 'Previsão', path: '/app/forecast', tourId: 'sidebar-forecast' },
  { icon: Filter, label: 'Funil Conv.', path: '/app/funnel', tourId: 'sidebar-funnel' },
  { icon: GitBranch, label: 'Pipeline', path: '/app/pipeline', tourId: 'sidebar-pipeline' },
  { icon: Inbox, label: 'Inbox', path: '/app/inbox', tourId: 'sidebar-inbox' },
  { icon: Zap, label: 'Automações', path: '/app/automations', tourId: 'sidebar-automations' },
  { icon: Mail, label: 'Campanhas', path: '/app/campaigns', tourId: 'sidebar-campaigns' },
  { icon: CheckSquare, label: 'Tarefas', path: '/app/tasks', tourId: 'sidebar-tasks' },
  { icon: BarChart3, label: 'Relatórios', path: '/app/reports', tourId: 'sidebar-reports' },
  {
    icon: MessageSquarePlus,
    label: 'Sugestões',
    path: '/app/suggestions',
    tourId: 'sidebar-suggestions',
  },
  {
    icon: Handshake,
    label: 'Config. Negócios',
    path: '/app/settings/deal-config',
    tourId: 'sidebar-deal-config',
    managerOnly: true,
  },
  {
    icon: ScanSearch,
    label: 'Inteligência de Mercado',
    path: '/app/deep-research',
    tourId: 'sidebar-deep-research',
  },
  {
    icon: TrendingUp,
    label: 'Performance',
    path: '/app/performance',
    tourId: 'sidebar-performance',
    managerOnly: true,
  },
  {
    icon: CreditCard,
    label: 'Billing',
    path: '/app/billing',
    tourId: 'sidebar-billing',
    adminOnly: true,
  },
  {
    icon: Webhook,
    label: 'Webhooks',
    path: '/app/settings/webhooks',
    tourId: 'sidebar-webhooks',
    adminOnly: true,
  },
  {
    icon: KeyRound,
    label: 'API Keys',
    path: '/app/settings/api-keys',
    tourId: 'sidebar-api-keys',
    adminOnly: true,
  },
  {
    icon: Package,
    label: 'Produtos',
    path: '/app/settings/products',
    tourId: 'sidebar-products',
    managerOnly: true,
  },
  {
    icon: Upload,
    label: 'Importar',
    path: '/app/settings/import',
    tourId: 'sidebar-import',
    adminOnly: true,
  },
  { icon: Settings, label: 'Configurações', path: '/app/settings', tourId: 'sidebar-settings' },
  {
    icon: Shield,
    label: 'Plataforma',
    path: '/app/admin',
    tourId: 'sidebar-platform-admin',
    platformAdminOnly: true,
  },
];

/** Um path do menu é candidato a ativo se casa exatamente ou é prefixo de segmento. */
function matches(path: string, pathname: string): boolean {
  if (path === '/app') return pathname === '/app' || pathname === '/app/';
  return pathname === path || pathname.startsWith(path + '/');
}

export function RibbonTabs() {
  const location = useLocation();
  const { user } = useAuth();
  const { tasks } = useTasks();

  const pendingTasksCount = (() => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const overdue = tasks.filter(
      (t) => t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < now
    ).length;
    const todayTasks = tasks.filter((t) => {
      if (t.status === 'COMPLETED' || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= today && d < tomorrow;
    }).length;
    return overdue + todayTasks;
  })();

  const items = menuItems.filter(
    (item) =>
      (!item.adminOnly || user?.role === 'ADMIN' || user?.isPlatformAdmin) &&
      (!item.managerOnly ||
        user?.role === 'ADMIN' ||
        user?.role === 'GESTOR' ||
        user?.isPlatformAdmin) &&
      (!item.platformAdminOnly || user?.isPlatformAdmin)
  );

  // Aba ativa = item cujo path é o prefixo mais LONGO que casa (evita duas ativas
  // em rotas aninhadas, ex.: /app/settings vs /app/settings/deal-config).
  const activePath = items
    .filter((i) => matches(i.path, location.pathname))
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;

  return (
    <nav className="vyd-ribbon-tabs" aria-label="Navegação principal">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.path === activePath;
        return (
          <Link
            key={item.path}
            to={item.path}
            data-tour={item.tourId}
            aria-selected={active}
            aria-current={active ? 'page' : undefined}
            className="vyd-ribbon-tab"
            style={{ gap: 'var(--vyd-space-2)' }}
          >
            <Icon size={14} className="flex-shrink-0" />
            <span>{item.label}</span>
            {item.path === '/app/tasks' && pendingTasksCount > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold"
                style={{ background: 'var(--vyd-danger)', color: 'var(--vyd-text-on-accent)' }}
              >
                {pendingTasksCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
