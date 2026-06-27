import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type PanelType = 'lead' | 'deal';

interface SidePanelContextValue {
  open: boolean;
  type: PanelType | null;
  id: string | null;
  openPanel: (type: PanelType, id: string) => void;
  closePanel: () => void;
}

const SidePanelContext = createContext<SidePanelContextValue | null>(null);

export function SidePanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PanelType | null>(null);
  const [id, setId] = useState<string | null>(null);

  const openPanel = (t: PanelType, entityId: string) => {
    setType(t);
    setId(entityId);
    setOpen(true);
  };

  const closePanel = () => setOpen(false);

  return (
    <SidePanelContext.Provider value={{ open, type, id, openPanel, closePanel }}>
      {children}
    </SidePanelContext.Provider>
  );
}

export function useSidePanel() {
  const ctx = useContext(SidePanelContext);
  if (!ctx) throw new Error('useSidePanel must be used inside SidePanelProvider');
  return ctx;
}
