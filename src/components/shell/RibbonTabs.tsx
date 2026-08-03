import { Link, useLocation } from 'react-router';
import { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { categories, type NavItem } from './nav';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useTasks } from '@/hooks/useTasks';



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
  const { can } = usePermissions();
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
    (!item.platformAdminOnly || user?.isPlatformAdmin) &&
    (!item.capability || can(item.capability));

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
