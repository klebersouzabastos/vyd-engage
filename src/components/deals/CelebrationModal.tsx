// Comemoração de venda (Upgrade RD P0, req 11): ao marcar GANHO (com
// celebrationEnabled do tenant), exibe uma celebração breve com contagem e
// valor das vendas do usuário no mês (GET /deals/celebration-stats).
// Animação leve 100% CSS com tokens do DS — sem libs novas.
import { useQuery } from '@tanstack/react-query';
import { Trophy, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import type { CelebrationStats } from '../../types/sales';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { formatCurrency } from '../../utils/format';
import { cn } from '../ui/utils';

interface CelebrationModalProps {
  open: boolean;
  onClose: () => void;
}

// Cores do preset do DS (bg-viz-* = paleta de visualização do vyd-design-system).
const CONFETTI_COLORS = [
  'bg-primary',
  'bg-warning',
  'bg-success',
  'bg-viz-1',
  'bg-viz-2',
  'bg-viz-5',
];

export function CelebrationModal({ open, onClose }: CelebrationModalProps) {
  // staleTime 0 (padrão) → refaz o fetch a cada abertura (a venda recém-marcada conta).
  const { data: stats = null, isLoading: loading } = useQuery<CelebrationStats | null>({
    queryKey: ['celebration-stats'],
    queryFn: async () => {
      try {
        const res = await apiClient.getCelebrationStats();
        return res.data;
      } catch {
        return null; // celebração nunca bloqueia o fluxo
      }
    },
    enabled: open,
    refetchOnWindowFocus: false,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        {/* Confete CSS-only (cores via tokens do DS) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'vyd-confetti absolute -top-2 w-1.5 h-3 rounded-sm opacity-80',
                CONFETTI_COLORS[i % CONFETTI_COLORS.length]
              )}
              style={{
                left: `${(i * 41 + 7) % 100}%`,
                animationDelay: `${(i % 8) * 0.18}s`,
                animationDuration: `${2.2 + (i % 5) * 0.35}s`,
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes vyd-confetti-fall {
            0% { transform: translateY(-12px) rotate(0deg); opacity: 0.9; }
            100% { transform: translateY(340px) rotate(540deg); opacity: 0; }
          }
          .vyd-confetti {
            animation-name: vyd-confetti-fall;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
          }
          @keyframes vyd-trophy-pop {
            0% { transform: scale(0.4); opacity: 0; }
            60% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          .vyd-trophy-pop { animation: vyd-trophy-pop 0.5s ease-out both; }
        `}</style>

        <DialogHeader>
          <DialogTitle className="text-center">Venda registrada!</DialogTitle>
        </DialogHeader>

        <div className="py-4 text-center space-y-4 relative">
          <div className="vyd-trophy-pop mx-auto w-16 h-16 rounded-full bg-warning/15 text-warning flex items-center justify-center">
            <Trophy size={32} aria-hidden="true" />
          </div>
          <p className="text-lg font-semibold text-foreground">Parabéns pela venda!</p>

          {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Carregando suas vendas do mês...
            </div>
          ) : stats ? (
            <div className="flex items-center justify-center gap-6">
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.monthWonCount}</p>
                <p className="text-xs text-muted-foreground">
                  venda{stats.monthWonCount !== 1 ? 's' : ''} no mês
                </p>
              </div>
              <div className="h-10 w-px bg-border" aria-hidden="true" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(stats.monthWonValue)}
                </p>
                <p className="text-xs text-muted-foreground">em vendas no mês</p>
              </div>
            </div>
          ) : null}

          <Button onClick={onClose} className="mt-2">
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
