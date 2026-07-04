// Multi-vendas (Upgrade RD P0, req 4): após GANHAR ou PERDER uma negociação
// (com o toggle multiSalesEnabled do tenant ligado), oferece agendar a próxima
// negociação — tipo, data de início, funil/etapa destino, valor estimado,
// responsável (padrão: o mesmo) e notas. O job sempre-ativo cria o deal na data.
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import type { Deal } from '../../types';
import type { ScheduledDealType } from '../../types/sales';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

export const SCHEDULED_DEAL_TYPE_LABELS: Record<ScheduledDealType, string> = {
  POS_VENDA: 'Pós-venda',
  CROSS_SELL: 'Cross-sell',
  UPSELL: 'Upsell',
  RECOMPRA: 'Recompra',
  RELACIONAMENTO: 'Relacionamento',
  OUTRO: 'Outro',
};

interface FunnelOption {
  id: string;
  name: string;
  isDefault?: boolean;
  columns?: Array<{ id: string; title: string; order: number }>;
}

interface MultiSaleDialogProps {
  open: boolean;
  onClose: () => void;
  deal: Deal;
}

function defaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export function MultiSaleDialog({ open, onClose, deal }: MultiSaleDialogProps) {
  const queryClient = useQueryClient();

  const [type, setType] = useState<ScheduledDealType>('POS_VENDA');
  const [date, setDate] = useState(defaultDate());
  const [funnelId, setFunnelId] = useState('');
  const [funnelColumnId, setFunnelColumnId] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setType('POS_VENDA');
      setDate(defaultDate());
      setFunnelId(deal.funnelId || '');
      setFunnelColumnId('');
      setEstimatedValue(deal.value ? String(deal.value) : '');
      setAssignedTo(deal.assignedTo || '');
      setNotes('');
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset intencional apenas na abertura
  }, [open]);

  const { data: funnels = [] } = useQuery<FunnelOption[]>({
    queryKey: ['deal-funnels-options'],
    queryFn: async () => {
      const res = await apiClient.getFunnels('DEAL');
      const list = ((res as Record<string, unknown>).data ?? res) as FunnelOption[];
      return Array.isArray(list) ? list : [];
    },
    enabled: open,
    staleTime: 60 * 1000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['tenant-users'],
    queryFn: () => apiClient.getUsers(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const columns = useMemo(() => {
    const funnel = funnels.find((f) => f.id === funnelId);
    return [...(funnel?.columns || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [funnels, funnelId]);

  const canSave = !saving && !!type && !!date;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // Meio-dia local evita voltar um dia ao converter para UTC.
      const scheduledFor = new Date(`${date}T12:00:00`).toISOString();
      const value = estimatedValue.trim() ? Number(estimatedValue) : undefined;
      await apiClient.createScheduledDeal({
        originDealId: deal.id,
        type,
        scheduledFor,
        ...(funnelId ? { funnelId } : {}),
        ...(funnelColumnId ? { funnelColumnId } : {}),
        ...(value !== undefined && !Number.isNaN(value) ? { estimatedValue: value } : {}),
        ...(assignedTo ? { assignedTo } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success('Próxima negociação agendada');
      queryClient.invalidateQueries({ queryKey: ['scheduled-deals'] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao agendar negociação');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock size={16} aria-hidden="true" />
            Agendar próxima negociação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Na data escolhida, uma nova negociação será criada automaticamente, vinculada à
            mesma empresa/contato de &quot;{deal.name}&quot;.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as ScheduledDealType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCHEDULED_DEAL_TYPE_LABELS) as ScheduledDealType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {SCHEDULED_DEAL_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="multi-sale-date">Data de início</Label>
              <Input
                id="multi-sale-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Funil destino</Label>
              <Select
                value={funnelId || 'none'}
                onValueChange={(v) => {
                  setFunnelId(v === 'none' ? '' : v);
                  setFunnelColumnId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Funil padrão</SelectItem>
                  {funnels.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {f.isDefault ? ' (Padrão)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Etapa destino</Label>
              <Select
                value={funnelColumnId || 'none'}
                onValueChange={(v) => setFunnelColumnId(v === 'none' ? '' : v)}
                disabled={!funnelId || columns.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Primeira etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Primeira etapa</SelectItem>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="multi-sale-value">Valor estimado (R$)</Label>
              <Input
                id="multi-sale-value"
                type="number"
                min="0"
                step="0.01"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select
                value={assignedTo || 'none'}
                onValueChange={(v) => setAssignedTo(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="O mesmo da negociação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">O mesmo da negociação</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="multi-sale-notes">Notas</Label>
            <Textarea
              id="multi-sale-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto para a próxima negociação (opcional)"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Agora não
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {saving && <Loader2 size={14} className="mr-2 animate-spin" aria-hidden="true" />}
              Agendar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
