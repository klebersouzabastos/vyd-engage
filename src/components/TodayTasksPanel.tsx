import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { AlertTriangle, CalendarCheck, Check, Handshake, Loader2, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { apiClient } from '../services/api/client';
import { useAuth } from '../contexts/AuthContext';
import type { DealWithoutTasks } from '../types/sales';
import type { Task } from '../types';

/**
 * Painel "Tarefas de hoje + negociações sem tarefa" (upgrade-rd-parity, req 9).
 * Reutilizado em dois lugares: Sheet aberto pela Topbar (variante completa) e
 * widget do Dashboard (variante compacta, com moldura de card própria).
 * 100% tokens semânticos — arquivo em STRICT_SCOPE do check:colors.
 */

interface TodayTask extends Task {
  lead?: { id: string; name: string; email?: string | null } | null;
  dealId?: string | null;
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

function formatCurrencyBRL(value: number | string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Dialog de criação rápida de tarefa pré-preenchida com o deal (req 9). */
function QuickTaskDialog({
  deal,
  onClose,
  onCreated,
}: {
  deal: DealWithoutTasks | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('09:00');
  const [priority, setPriority] = useState<Task['priority']>('MEDIUM');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!deal) return;
    if (!title.trim()) {
      toast.error('O título da tarefa é obrigatório');
      return;
    }
    try {
      setSaving(true);
      await apiClient.createTask({
        title: title.trim(),
        dueDate: new Date(`${dueDate}T${dueTime}`).toISOString(),
        priority,
        dealId: deal.id,
        ...(deal.lead?.id ? { leadId: deal.lead.id } : {}),
      });
      toast.success('Tarefa criada para a negociação!');
      setTitle('');
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar tarefa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!deal} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Criar tarefa — {deal?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="quick-task-title">Título *</Label>
            <Input
              id="quick-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Ligar para retomar a negociação"
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quick-task-date">Data *</Label>
              <Input
                id="quick-task-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="quick-task-time">Hora</Label>
              <Input
                id="quick-task-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="quick-task-priority">Prioridade</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Task['priority'])}>
              <SelectTrigger id="quick-task-priority" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
            Criar tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TodayTasksPanelProps {
  /** Variante compacta (widget do Dashboard): moldura de card + listas limitadas. */
  compact?: boolean;
  /** Chamado antes de navegar (ex.: fechar o Sheet da Topbar). */
  onNavigate?: () => void;
}

export function TodayTasksPanel({ compact = false, onNavigate }: TodayTasksPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [taskDeal, setTaskDeal] = useState<DealWithoutTasks | null>(null);

  const { data: todayData, isLoading: loadingTasks } = useQuery({
    queryKey: ['today-tasks', user?.id],
    queryFn: () => apiClient.getTasks({ dueToday: 'true', assignedTo: user?.id, limit: 100 }),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const { data: overdueData } = useQuery({
    queryKey: ['overdue-tasks-count', user?.id],
    queryFn: () => apiClient.getTasks({ overdue: 'true', assignedTo: user?.id, limit: 1 }),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const { data: withoutTasksData, isLoading: loadingDeals } = useQuery({
    queryKey: ['deals-without-tasks'],
    queryFn: () => apiClient.getDealsWithoutTasks(),
    staleTime: 60_000,
  });

  const tasks = ((todayData?.tasks as unknown as TodayTask[]) ?? []).slice();
  const overdueCount = overdueData?.pagination?.total ?? 0;
  const allDeals = withoutTasksData?.data ?? [];

  const visibleTasks = compact ? tasks.slice(0, 5) : tasks;
  const visibleDeals = compact ? allDeals.slice(0, 5) : allDeals;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['today-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['overdue-tasks-count'] });
    queryClient.invalidateQueries({ queryKey: ['deals-without-tasks'] });
  };

  const handleComplete = async (task: TodayTask) => {
    try {
      setCompletingId(task.id);
      await apiClient.updateTask(task.id, { status: 'COMPLETED' });
      toast.success('Tarefa concluída!');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao concluir tarefa');
    } finally {
      setCompletingId(null);
    }
  };

  const goTo = (path: string) => {
    onNavigate?.();
    navigate(path);
  };

  const content = (
    <div className={compact ? '' : 'p-6'}>
      {/* Atrasadas + atalho para a agenda completa */}
      <div className="flex items-center justify-between gap-2 mb-4">
        {overdueCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <AlertTriangle size={14} />
            {overdueCount} tarefa{overdueCount !== 1 ? 's' : ''} atrasada
            {overdueCount !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Nenhuma tarefa atrasada</span>
        )}
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => goTo('/app/tasks')}>
          Ver todas
        </Button>
      </div>

      {/* Tarefas de hoje */}
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Tarefas de hoje
      </p>
      {loadingTasks ? (
        <div className="space-y-2 mb-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : visibleTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-5">Nenhuma tarefa vence hoje.</p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-md mb-2">
          {visibleTasks.map((task) => {
            const done = task.status === 'COMPLETED';
            return (
              <li key={task.id} className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  aria-label={done ? 'Tarefa concluída' : `Concluir tarefa ${task.title}`}
                  disabled={done || completingId === task.id}
                  onClick={() => handleComplete(task)}
                  className={`shrink-0 h-5 w-5 rounded-full border flex items-center justify-center transition-colors ${
                    done
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                  }`}
                >
                  {completingId === task.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm truncate ${
                      done ? 'line-through text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.lead?.name && (
                    <p className="text-xs text-muted-foreground truncate">{task.lead.name}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-foreground">{formatTime(task.dueDate)}</p>
                  <p className="text-xs text-muted-foreground">
                    {PRIORITY_LABELS[task.priority] ?? task.priority}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {compact && tasks.length > visibleTasks.length && (
        <p className="text-xs text-muted-foreground mb-3">
          +{tasks.length - visibleTasks.length} tarefa{tasks.length - visibleTasks.length !== 1 ? 's' : ''}{' '}
          hoje
        </p>
      )}

      {/* Negociações sem tarefa */}
      <div className="flex items-center gap-2 mt-5 mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Negociações sem tarefa
        </p>
        {allDeals.length > 0 && (
          <Badge className="bg-warning/15 text-warning border-transparent">{allDeals.length}</Badge>
        )}
      </div>
      {loadingDeals ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : visibleDeals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todas as suas negociações abertas têm tarefa pendente.
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-md">
          {visibleDeals.map((deal) => (
            <li key={deal.id} className="flex items-center gap-3 px-3 py-2.5">
              <Handshake size={16} className="shrink-0 text-muted-foreground" />
              <button
                type="button"
                onClick={() => goTo(`/app/deals/${deal.id}`)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-sm text-foreground truncate hover:underline">{deal.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {deal.company?.name || deal.lead?.name || 'Sem contato'}
                  {deal.funnelColumn?.title ? ` · ${deal.funnelColumn.title}` : ''}
                  {` · ${formatCurrencyBRL(deal.value)}`}
                </p>
              </button>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 h-7 px-2 text-xs"
                onClick={() => setTaskDeal(deal)}
              >
                <Plus size={12} />
                Criar tarefa
              </Button>
            </li>
          ))}
        </ul>
      )}
      {compact && allDeals.length > visibleDeals.length && (
        <p className="text-xs text-muted-foreground mt-2">
          +{allDeals.length - visibleDeals.length} negociaç
          {allDeals.length - visibleDeals.length !== 1 ? 'ões' : 'ão'} sem tarefa
        </p>
      )}

      <QuickTaskDialog
        deal={taskDeal}
        onClose={() => setTaskDeal(null)}
        onCreated={() => {
          setTaskDeal(null);
          refresh();
        }}
      />
    </div>
  );

  if (!compact) return content;

  // Variante widget (Dashboard): moldura de card no padrão dos demais widgets.
  return (
    <div className="bg-card rounded-lg shadow-sm border border-border">
      <div className="p-6 border-b border-border flex items-center gap-2">
        <CalendarCheck size={18} className="text-primary" />
        <h3 className="text-foreground font-semibold">
          Tarefas de hoje &amp; negociações sem tarefa
        </h3>
      </div>
      <div className="p-6">{content}</div>
    </div>
  );
}
