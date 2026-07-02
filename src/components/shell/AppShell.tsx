import { Outlet } from 'react-router';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { useCallback, useState, useEffect } from 'react';
import { OnboardingTour } from '../OnboardingTour';
import { CommandPalette } from '../CommandPalette';
import { SidePanel, SidePanelBody } from '../SidePanel';
import { SidePanelProvider, useSidePanel } from '@/contexts/SidePanelContext';
import { SuggestionFab } from '../SuggestionFab';
import { RibbonProvider, useRibbon } from '@/contexts/RibbonContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Topbar } from './Topbar';
import { RibbonTabs } from './RibbonTabs';
import { StatusBar } from './StatusBar';

const RIBBON_COLLAPSED_KEY = 'vyd-ribbon-collapsed';

function ShellInner() {
  const { setSlot, activeCount } = useRibbon();
  const { open: panelOpen } = useSidePanel();
  const isDesktop = useMediaQuery('(min-width: 1025px)');

  // Colapsar/expandir a FAIXA DE COMANDOS (mantém as abas — padrão Office/Autodesk).
  const [ribbonCollapsed, setRibbonCollapsed] = useState(() => {
    try {
      return localStorage.getItem(RIBBON_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(RIBBON_COLLAPSED_KEY, String(ribbonCollapsed));
    } catch {
      /* ignore */
    }
  }, [ribbonCollapsed]);

  // O SidePanel vira COLUNA (rightpanel) só no desktop; senão é overlay (Sheet).
  const rpAsColumn = isDesktop && panelOpen;

  // A faixa de comandos só aparece quando a tela declarou comandos E não está
  // colapsada. Sem comandos → a faixa some (sem repetir o título, que já está na topbar).
  const hasCommands = activeCount > 0;
  const showRibbon = hasCommands && !ribbonCollapsed;

  // Ref estável para o slot da ribbon (evita detach/attach por render).
  const setSlotRef = useCallback((el: HTMLDivElement | null) => setSlot(el), [setSlot]);

  const appClass = [
    'vyd-app',
    'vyd-app--no-rail',
    !showRibbon && 'vyd-app--ribbon-collapsed',
    !rpAsColumn && 'app--no-rp',
  ]
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

      {/* Abas de navegação (grid-area ribbontabs) + toggle de colapso da faixa. */}
      <RibbonTabs
        ribbonCollapsed={ribbonCollapsed}
        onToggleRibbon={() => setRibbonCollapsed((v) => !v)}
      />

      {/* Faixa de comandos: as páginas portalam seus comandos aqui (ScreenRibbon).
          Vazia/colapsada → a linha some (vyd-app--ribbon-collapsed). */}
      <div className="vyd-ribbon" ref={setSlotRef} />

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
