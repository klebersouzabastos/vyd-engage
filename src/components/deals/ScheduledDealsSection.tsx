// "Próximas negociações agendadas" no DealDetail (Upgrade RD P0, req 4):
// lista discreta dos agendamentos de multi-venda originados deste deal
// (GET /scheduled-deals?originDealId=...), com status e cancelamento
// (POST /scheduled-deals/:id/cancel) enquanto PENDING.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Loader2, X } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import type { ScheduledDeal, ScheduledDealStatus } from '../../types/sales';
import { formatCurrency } from '../../utils/format';
import { SCHEDULED_DEAL_TYPE_LABELS } from './MultiSaleDialog';

const STATUS_BADGE: Record<ScheduledDealStatus, { label: string; cls: string }> = {
  PENDING: { label: 'Agendada', cls: 'bg-warning/15 text-warning' },
  CREATED: { label: 'Criada', cls: 'bg-success/15 text-success' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-muted text-muted-foreground' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export function ScheduledDealsSection({ dealId }: { dealId: string }) {
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<ScheduledDeal[]>({
    queryKey: ['scheduled-deals', dealId],
    queryFn: () =>
      apiClient.getScheduledDeals({ originDealId: dealId }).then((r) => r.data || []),
  });

  // Seção discreta: só aparece quando há agendamentos.
  if (isLoading || items.length === 0) return null;

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await apiClient.cancelScheduledDeal(id);
      toast.success('Agendamento cancelado');
      queryClient.invalidateQueries({ queryKey: ['scheduled-deals'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar agendamento');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <CalendarClock size={12} aria-hidden="true" />
        Próximas negociações agendadas
      </h3>
      <ul className="space-y-3">
        {items.map((item) => {
          const badge = STATUS_BADGE[item.status];
          return (
            <li key={item.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="text-foreground font-medium truncate">
                  {SCHEDULED_DEAL_TYPE_LABELS[item.type] || item.type}
                  {item.estimatedValue != null && item.estimatedValue !== '' && (
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      — {formatCurrency(Number(item.estimatedValue))}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(item.scheduledFor)}
                  {item.assignedUser?.name ? ` — ${item.assignedUser.name}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${badge.cls}`}>
                  {badge.label}
                </span>
                {item.status === 'PENDING' && (
                  <button
                    type="button"
                    onClick={() => handleCancel(item.id)}
                    disabled={cancellingId === item.id}
                    aria-label="Cancelar agendamento"
                    title="Cancelar agendamento"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    {cancellingId === item.id ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <X size={14} aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
