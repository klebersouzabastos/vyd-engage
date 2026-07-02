import { Outlet } from 'react-router';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { useState, useEffect } from 'react';
import { OnboardingTour } from '../OnboardingTour';
import { CommandPalette } from '../CommandPalette';
import { SidePanel } from '../SidePanel';
import { SidePanelProvider } from '@/contexts/SidePanelContext';
import { SuggestionFab } from '../SuggestionFab';
import { Topbar } from './Topbar';
import { RibbonTabs } from './RibbonTabs';
import { StatusBar } from './StatusBar';

const RIBBON_COLLAPSED_KEY = 'vyd-ribbon-collapsed';

function ShellInner() {
  // Colapsar/expandir a FAIXA DE NAVEGAÇÃO (mantém as categorias — padrão Office/Autodesk).
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

  // Shell v2 (vyd-design-system@2, AGENTS.md) = COLUNA ÚNICA: sem leftrail nem
  // rightpanel. O canvas ocupa a largura toda; detalhes de Lead/Deal são overlay
  // (Sheet), nunca painel lateral do shell.
  const appClass = ['vyd-app', ribbonCollapsed && 'vyd-app--ribbon-collapsed']
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

      {/* Navegação de dois níveis: categorias (grid-area ribbontabs) + itens da
          categoria ativa (grid-area ribbon). Ambos renderizados pelo RibbonTabs. */}
      <RibbonTabs
        ribbonCollapsed={ribbonCollapsed}
        onToggleRibbon={() => setRibbonCollapsed((v) => !v)}
      />

      <main id="vyd-canvas" className="vyd-canvas" role="main">
        <div className="vyd-canvas__content">
          <Outlet />
        </div>
      </main>

      <StatusBar />

      {/* Overlays globais. O SidePanel é sempre overlay (Sheet) — nunca coluna. */}
      <CommandPalette />
      <SidePanel />
      <OnboardingTour />
      <SuggestionFab />
    </div>
  );
}

/** Chrome global de /app: o app-shell (ribbon Autodesk) do vyd-design-system@2. */
export function AppShell() {
  return (
    <NuqsAdapter>
      <SidePanelProvider>
        <ShellInner />
      </SidePanelProvider>
    </NuqsAdapter>
  );
}
