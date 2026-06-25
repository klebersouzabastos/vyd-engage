import type { TocItem } from './extractToc';

interface ReportTOCProps {
  items: TocItem[];
  activeId?: string | null;
  /** Chamado apos navegar (ex.: fechar o drawer no mobile). */
  onNavigate?: (id: string) => void;
}

/**
 * Sumario navegavel do relatorio. Ancoras com rolagem suave e destaque da
 * secao ativa. Usado tanto fixo no desktop quanto dentro do drawer no mobile.
 */
export function ReportTOC({ items, activeId, onNavigate }: ReportTOCProps) {
  if (!items.length) return null;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Atualiza o hash sem provocar um salto adicional.
      window.history.replaceState(null, '', `#${id}`);
    }
    onNavigate?.(id);
  };

  return (
    <nav aria-label="Sumário do relatório" className="text-sm">
      <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Sumário
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
              <a
                href={`#${item.id}`}
                onClick={(e) => handleClick(e, item.id)}
                aria-current={isActive ? 'location' : undefined}
                className={`block rounded border-l-2 px-2 py-1 transition-colors ${
                  isActive
                    ? 'border-primary bg-blue-50 font-medium text-primary'
                    : 'border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
