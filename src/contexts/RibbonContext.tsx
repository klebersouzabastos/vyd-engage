import { createContext, useContext, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Sistema de ribbon do shell (spec ribbon-shell-global).
 *
 * O `.vyd-ribbon` é uma área do grid do shell, ACIMA do `.vyd-canvas` onde a
 * página vive — logo a página não pode renderizar dentro dele diretamente.
 * Uma página declara seus comandos com `<ScreenRibbon groups={...} />`, que os
 * PORTALA para o slot da ribbon (registrado pelo AppShell). Quando nenhuma
 * página declara ribbon, o AppShell mostra só o título da tela (regra do req 10).
 *
 * REGRA (req 10): os comandos devem ser derivados de AÇÕES QUE JÁ EXISTEM na
 * tela — nada de comando novo inventado.
 */

export interface RibbonItem {
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** ativo/selecionado (barra de acento do DS) */
  active?: boolean;
  title?: string;
}

export interface RibbonGroupDef {
  label: string;
  /** grupo de comandos (tiles) */
  items?: RibbonItem[];
  /** conteúdo custom (ex.: input de nome, switch) no lugar dos tiles */
  content?: ReactNode;
}

interface RibbonCtx {
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
  activeCount: number;
  inc: () => void;
  dec: () => void;
}

const Ctx = createContext<RibbonCtx | null>(null);

export function RibbonProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const inc = useCallback(() => setActiveCount((c) => c + 1), []);
  const dec = useCallback(() => setActiveCount((c) => Math.max(0, c - 1)), []);
  const value = useMemo(
    () => ({ slot, setSlot, activeCount, inc, dec }),
    [slot, activeCount, inc, dec]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRibbon() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRibbon deve ser usado dentro de RibbonProvider');
  return ctx;
}

/**
 * Renderizado por uma página para preencher a ribbon do shell com SUAS ações
 * (já existentes). Sem grupos (`groups=[]`) → o shell mostra só o título.
 */
export function ScreenRibbon({ groups }: { groups: RibbonGroupDef[] }) {
  const ctx = useContext(Ctx);

  // Conta ribbons ativas para o shell saber quando mostrar o título default.
  // useLayoutEffect roda antes do paint → sem flicker do título.
  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.inc();
    return () => ctx.dec();
  }, [ctx]);

  if (!ctx?.slot || groups.length === 0) return null;

  return createPortal(
    <>
      {groups.map((group, gi) => (
        <div className="vyd-ribbon-group" key={gi}>
          <div className="vyd-ribbon-group__items">
            {group.content}
            {(group.items ?? []).map((item, ii) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={ii}
                  className="vyd-ribbon-item"
                  onClick={item.onClick}
                  disabled={item.disabled}
                  aria-disabled={item.disabled || undefined}
                  aria-selected={item.active || undefined}
                  title={item.title || item.label}
                >
                  {Icon && (
                    <span className="glyph">
                      <Icon size={18} />
                    </span>
                  )}
                  <span className="label">{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="vyd-ribbon-group__label">{group.label}</div>
        </div>
      ))}
    </>,
    ctx.slot
  );
}
