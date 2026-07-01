import { Outlet, useLocation } from 'react-router';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { useState, useEffect, useCallback } from 'react';
import { OnboardingTour } from '../OnboardingTour';
import { CommandPalette } from '../CommandPalette';
import { SidePanel, SidePanelBody } from '../SidePanel';
import { SidePanelProvider, useSidePanel } from '@/contexts/SidePanelContext';
import { SuggestionFab } from '../SuggestionFab';
import { RibbonProvider, useRibbon } from '@/contexts/RibbonContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { screenTitleFor } from '@/lib/screenTitles';
import { Topbar } from './Topbar';
import { LeftRail } from './LeftRail';
import { StatusBar } from './StatusBar';

const RAIL_COLLAPSED_KEY = 'vyd-sidebar-collapsed';

function ShellInner() {
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try {
      return localStorage.getItem(RAIL_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(RAIL_COLLAPSED_KEY, String(railCollapsed));
    } catch {
      /* ignore */
    }
  }, [railCollapsed]);

  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  const { setSlot, activeCount } = useRibbon();
  const { open: panelOpen } = useSidePanel();
  const isDesktop = useMediaQuery('(min-width: 1025px)');
  const screen = screenTitleFor(location.pathname);

  // O SidePanel vira COLUNA (rightpanel) só no desktop; senão é overlay (Sheet).
  const rpAsColumn = isDesktop && panelOpen;

  // Ref estável para o slot da ribbon (evita detach/attach por render).
  const setSlotRef = useCallback((el: HTMLDivElement | null) => setSlot(el), [setSlot]);

  // Fecha o drawer mobile ao navegar.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const appClass = ['vyd-app', railCollapsed && 'vyd-app--rail-collapsed', !rpAsColumn && 'app--no-rp']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={appClass}>
      <a
        href="#vyd-canvas"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[1300] focus:top-2 focus:left-2 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:text-sm"
      >
        Pular para o conteúdo principal
      </a>

      <Topbar onOpenNav={() => setNavOpen(true)} />

      {/* Ribbon: as páginas portalam seus comandos aqui (ScreenRibbon).
          Sem comandos → mostra só o título da tela (req 10). */}
      <div className="vyd-ribbon" ref={setSlotRef}>
        {activeCount === 0 && (
          <div className="vyd-ribbon-group">
            <div className="vyd-ribbon-group__items">
              <span className="text-sm font-semibold" style={{ color: 'var(--vyd-text-primary)' }}>
                {screen}
              </span>
            </div>
          </div>
        )}
      </div>

      <LeftRail collapsed={railCollapsed} onToggleCollapse={() => setRailCollapsed((v) => !v)} />

      <main id="vyd-canvas" className="vyd-canvas" role="main">
        <div className="vyd-canvas__content">
          <Outlet />
        </div>
      </main>

      <aside className="vyd-rightpanel" aria-label="Painel de detalhes">
        {rpAsColumn && <SidePanelBody />}
      </aside>

      <StatusBar />

      {/* Overlays globais (sem regressão — só mudam de host) */}
      <CommandPalette />
      {!isDesktop && <SidePanel />}
      <OnboardingTour />
      <SuggestionFab />

      {/* Drawer de navegação (≤sm, quando o leftrail some) */}
      {navOpen && (
        <>
          <div
            className="vyd-nav-scrim"
            role="button"
            tabIndex={0}
            aria-label="Fechar menu"
            onClick={() => setNavOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setNavOpen(false);
              }
            }}
          />
          <LeftRail asDrawer onNavigate={() => setNavOpen(false)} />
        </>
      )}
    </div>
  );
}

/** Chrome global de /app: o app-shell (ribbon Autodesk) do vyd-design-system. */
export function AppShell() {
  return (
    <NuqsAdapter>
      <SidePanelProvider>
        <RibbonProvider>
          <ShellInner />
        </RibbonProvider>
      </SidePanelProvider>
    </NuqsAdapter>
  );
}
