import { Outlet, useLocation } from 'react-router';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { useCallback } from 'react';
import { OnboardingTour } from '../OnboardingTour';
import { CommandPalette } from '../CommandPalette';
import { SidePanel, SidePanelBody } from '../SidePanel';
import { SidePanelProvider, useSidePanel } from '@/contexts/SidePanelContext';
import { SuggestionFab } from '../SuggestionFab';
import { RibbonProvider, useRibbon } from '@/contexts/RibbonContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { screenTitleFor } from '@/lib/screenTitles';
import { Topbar } from './Topbar';
import { RibbonTabs } from './RibbonTabs';
import { StatusBar } from './StatusBar';

function ShellInner() {
  const location = useLocation();

  const { setSlot, activeCount } = useRibbon();
  const { open: panelOpen } = useSidePanel();
  const isDesktop = useMediaQuery('(min-width: 1025px)');
  const screen = screenTitleFor(location.pathname);

  // O SidePanel vira COLUNA (rightpanel) só no desktop; senão é overlay (Sheet).
  const rpAsColumn = isDesktop && panelOpen;

  // Ref estável para o slot da ribbon (evita detach/attach por render).
  const setSlotRef = useCallback((el: HTMLDivElement | null) => setSlot(el), [setSlot]);

  // Navegação vive nas ABAS da ribbon → não há leftrail (vyd-app--no-rail colapsa
  // a coluna do leftrail a 0 em todos os breakpoints).
  const appClass = ['vyd-app', 'vyd-app--no-rail', !rpAsColumn && 'app--no-rp']
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

      <Topbar />

      {/* Abas de navegação (grid-area ribbontabs) */}
      <RibbonTabs />

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
