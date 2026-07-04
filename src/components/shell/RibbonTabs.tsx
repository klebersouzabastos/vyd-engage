import { Link, useLocation } from 'react-router';
import { useEffect, useState } from 'react';
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
  CheckCircle,
  Trash2,
  ChevronUp,
  ChevronDown,
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

interface NavCategory {
  key: string;
  label: string;
  items: NavItem[];
}

// Navegação em DOIS NÍVEIS (padrão Office/Autodesk, igual ao projeto Strategy):
// nível 1 = CATEGORIAS (abas .vyd-ribbon-tab); nível 2 = itens da categoria ativa
// na faixa .vyd-ribbon (.vyd-ribbon-item glyph+label). Mesma lista/ícones/flags da
// antiga navegação de linha única — só reagrupada, para acabar com o scroll.
const categories: NavCategory[] = [
  {
    key: 'comercial',
    label: 'Comercial',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/app', tourId: 'sidebar-dashboard' },
      { icon: Users, label: 'Leads', path: '/app/leads', tourId: 'sidebar-leads' },
      { icon: Building2, label: 'Empresas', path: '/app/companies', tourId: 'sidebar-companies' },
      { icon: Handshake, label: 'Deals', path: '/app/deals', tourId: 'sidebar-deals' },
      { icon: GitBranch, label: 'Pipeline', path: '/app/pipeline', tourId: 'sidebar-pipeline' },
      { icon: CheckSquare, label: 'Tarefas', path: '/app/tasks', tourId: 'sidebar-tasks' },
    ],
  },
  {
    key: 'engajamento',
    label: 'Engajamento',
    items: [
      { icon: Inbox, label: 'Inbox', path: '/app/inbox', tourId: 'sidebar-inbox' },
      { icon: Zap, label: 'Automações', path: '/app/automations', tourId: 'sidebar-automations' },
      { icon: Mail, label: 'Campanhas', path: '/app/campaigns', tourId: 'sidebar-campaigns' },
    ],
  },
  {
    key: 'analise',
    label: 'Análise',
    items: [
      { icon: TrendingUp, label: 'Previsão', path: '/app/forecast', tourId: 'sidebar-forecast' },
      { icon: Filter, label: 'Funil Conv.', path: '/app/funnel', tourId: 'sidebar-funnel' },
      { icon: BarChart3, label: 'Relatórios', path: '/app/reports', tourId: 'sidebar-reports' },
      {
        icon: TrendingUp,
        label: 'Performance',
        path: '/app/performance',
        tourId: 'sidebar-performance',
        managerOnly: true,
      },
      {
        icon: ScanSearch,
        label: 'Inteligência de Mercado',
        path: '/app/deep-research',
        tourId: 'sidebar-deep-research',
      },
      {
        icon: MessageSquarePlus,
        label: 'Sugestões',
        path: '/app/suggestions',
        tourId: 'sidebar-suggestions',
      },
    ],
  },
  {
    key: 'config',
    label: 'Configuração',
    items: [
      {
        icon: UsersRound,
        label: 'Equipe',
        path: '/app/team',
        tourId: 'sidebar-team',
        adminOnly: true,
      },
      {
        icon: Handshake,
        label: 'Config. Negócios',
        path: '/app/settings/deal-config',
        tourId: 'sidebar-deal-config',
        managerOnly: true,
      },
      {
        icon: Package,
        label: 'Produtos',
        path: '/app/settings/products',
        tourId: 'sidebar-products',
        managerOnly: true,
      },
      // Governança (Upgrade RD P1, reqs 15/16): fila de aprovações e lixeira,
      // gated MANAGER_ROLES (mesma proteção das rotas em routes.tsx).
      {
        icon: CheckCircle,
        label: 'Aprovações',
        path: '/app/approvals',
        tourId: 'sidebar-approvals',
        managerOnly: true,
      },
      {
        icon: Trash2,
        label: 'Lixeira',
        path: '/app/trash',
        tourId: 'sidebar-trash',
        managerOnly: true,
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
        icon: Upload,
        label: 'Importar',
        path: '/app/settings/import',
        tourId: 'sidebar-import',
        adminOnly: true,
      },
      { icon: Settings, label: 'Configurações', path: '/app/settings', tourId: 'sidebar-settings' },
      {
        icon: CreditCard,
        label: 'Billing',
        path: '/app/billing',
        tourId: 'sidebar-billing',
        adminOnly: true,
      },
      {
        icon: Shield,
        label: 'Plataforma',
        path: '/app/admin',
        tourId: 'sidebar-platform-admin',
        platformAdminOnly: true,
      },
    ],
  },
];

/** Um path do menu é candidato a ativo se casa exatamente ou é prefixo de segmento. */
function matches(path: string, pathname: string): boolean {
  if (path === '/app') return pathname === '/app' || pathname === '/app/';
  return pathname === path || pathname.startsWith(path + '/');
}

interface RibbonTabsProps {
  ribbonCollapsed?: boolean;
  onToggleRibbon?: () => void;
}

export function RibbonTabs({ ribbonCollapsed, onToggleRibbon }: RibbonTabsProps) {
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

  const canSee = (item: NavItem) =>
    (!item.adminOnly || user?.role === 'ADMIN' || user?.isPlatformAdmin) &&
    (!item.managerOnly ||
      user?.role === 'ADMIN' ||
      user?.role === 'GESTOR' ||
      user?.isPlatformAdmin) &&
    (!item.platformAdminOnly || user?.isPlatformAdmin);

  // Categorias visíveis para o papel do usuário (categoria sem itens visíveis some).
  const visibleCategories = categories
    .map((c) => ({ ...c, items: c.items.filter(canSee) }))
    .filter((c) => c.items.length > 0);

  // Item ativo = path que casa com prefixo mais LONGO (evita ambiguidade em rotas
  // aninhadas, ex.: /app/settings vs /app/settings/deal-config).
  const activePath = visibleCategories
    .flatMap((c) => c.items)
    .filter((i) => matches(i.path, location.pathname))
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;

  // Categoria da rota atual (contém o item ativo); fallback = primeira visível.
  const routeCategoryKey =
    visibleCategories.find((c) => c.items.some((i) => i.path === activePath))?.key ??
    visibleCategories[0]?.key;

  // Categoria exibida na faixa. Clicar numa aba troca isto SEM navegar; ao mudar de
  // rota, sincroniza com a categoria do item ativo.
  const [selectedKey, setSelectedKey] = useState(routeCategoryKey);
  useEffect(() => {
    if (routeCategoryKey) setSelectedKey(routeCategoryKey);
  }, [routeCategoryKey]);

  const shownItems =
    visibleCategories.find((c) => c.key === selectedKey)?.items ??
    visibleCategories[0]?.items ??
    [];

  return (
    <>
      {/* Nível 1 — categorias (grid-area ribbontabs). */}
      <nav className="vyd-ribbon-tabs" aria-label="Categorias" style={{ gap: 0 }}>
        <div className="vyd-tabs-scroll">
          {visibleCategories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className="vyd-ribbon-tab"
              aria-selected={cat.key === selectedKey}
              onClick={() => setSelectedKey(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Toggle de colapso da faixa de navegação (padrão Office "minimizar ribbon"). */}
        {onToggleRibbon && (
          <button
            type="button"
            className="vyd-ribbon-toggle"
            onClick={onToggleRibbon}
            aria-expanded={!ribbonCollapsed}
            aria-label={ribbonCollapsed ? 'Expandir navegação' : 'Recolher navegação'}
            title={ribbonCollapsed ? 'Expandir navegação' : 'Recolher navegação'}
          >
            {ribbonCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        )}
      </nav>

      {/* Nível 2 — itens da categoria ativa (grid-area ribbon). */}
      <nav className="vyd-ribbon" aria-label="Navegação">
        {shownItems.map((item) => {
          const Icon = item.icon;
          const active = item.path === activePath;
          const showBadge = item.path === '/app/tasks' && pendingTasksCount > 0;
          return (
            <Link
              key={item.path}
              to={item.path}
              data-tour={item.tourId}
              aria-selected={active || undefined}
              aria-current={active ? 'page' : undefined}
              className="vyd-ribbon-item"
            >
              <span className="glyph" style={{ position: 'relative' }}>
                <Icon size={18} />
                {showBadge && (
                  <span
                    className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold"
                    style={{ background: 'var(--vyd-danger)', color: 'var(--vyd-text-on-accent)' }}
                  >
                    {pendingTasksCount}
                  </span>
                )}
              </span>
              <span className="label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
