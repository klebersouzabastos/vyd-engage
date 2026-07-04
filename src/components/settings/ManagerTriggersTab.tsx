import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BellPlus, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { apiClient } from '../../services/api/client';
import type {
  ManagerTrigger,
  ManagerTriggerInput,
  TriggerConditionType,
} from '../../types/sales';

/**
 * Configurações de Negócios → Gatilhos gerenciais (upgrade-rd-parity req 8):
 * CRUD de gatilhos com form dinâmico por tipo de condição, destinatários e
 * e-mail opcional. O gatilho padrão "Negociações esfriando" só permite
 * ativar/desativar e ajustar os dias. 100% tokens semânticos.
 */

const CONDITION_LABELS: Record<TriggerConditionType, string> = {
  NO_INTERACTION: 'Sem interação há N dias',
  STUCK_IN_STAGE: 'Parado na mesma etapa há N dias',
  DEAL_LOST: 'Negociação perdida',
  BIG_SALE: 'Venda acima de R$ X',
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface UserOption {
  id: string;
  name: string;
}

interface ColumnOption {
  id: string;
  label: string;
}

interface Draft {
  id: string | null;
  isDefault: boolean;
  name: string;
  conditionType: TriggerConditionType;
  daysText: string;
  useCoolingDays: boolean;
  funnelColumnId: string;
  minValueText: string;
  notifyOwner: boolean;
  notifyManagers: boolean;
  notifyUserIds: string[];
  emailEnabled: boolean;
  active: boolean;
}

const emptyDraft = (): Draft => ({
  id: null,
  isDefault: false,
  name: '',
  conditionType: 'NO_INTERACTION',
  daysText: '',
  useCoolingDays: false,
  funnelColumnId: '',
  minValueText: '',
  notifyOwner: true,
  notifyManagers: false,
  notifyUserIds: [],
  emailEnabled: false,
  active: true,
});

const draftFrom = (t: ManagerTrigger): Draft => ({
  id: t.id,
  isDefault: t.isDefault,
  name: t.name,
  conditionType: t.conditionType,
  daysText: t.conditionConfig.days != null ? String(t.conditionConfig.days) : '',
  useCoolingDays: t.conditionConfig.useCoolingDays ?? false,
  funnelColumnId: t.conditionConfig.funnelColumnId ?? '',
  minValueText: t.conditionConfig.minValue != null ? String(t.conditionConfig.minValue) : '',
  notifyOwner: t.notifyOwner,
  notifyManagers: t.notifyManagers,
  notifyUserIds: [...t.notifyUserIds],
  emailEnabled: t.emailEnabled,
  active: t.active,
});

export function ManagerTriggersTab() {
  const [items, setItems] = useState<ManagerTrigger[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [columns, setColumns] = useState<ColumnOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [triggersRes, usersRes, funnelsRes] = await Promise.all([
        apiClient.getManagerTriggers(),
        apiClient.getUsers().catch(() => [] as UserOption[]),
        apiClient.getFunnels('DEAL').catch(() => null),
      ]);
      setItems(triggersRes.data || []);

      const rawUsers = Array.isArray(usersRes)
        ? usersRes
        : ((usersRes as { data?: UserOption[] })?.data ?? []);
      setUsers(rawUsers.map((u) => ({ id: u.id, name: u.name })));

      type DealFunnelLite = {
        id: string;
        name: string;
        columns?: Array<{ id: string; title: string }>;
      };
      const rawResponse = funnelsRes as unknown as
        | DealFunnelLite[]
        | { data?: DealFunnelLite[] }
        | null;
      const rawFunnels: DealFunnelLite[] = Array.isArray(rawResponse)
        ? rawResponse
        : (rawResponse?.data ?? []);
      const cols: ColumnOption[] = [];
      for (const funnel of rawFunnels) {
        for (const col of funnel.columns || []) {
          cols.push({
            id: col.id,
            label: rawFunnels.length > 1 ? `${funnel.name} › ${col.title}` : col.title,
          });
        }
      }
      setColumns(cols);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar gatilhos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columnLabel = useMemo(() => {
    const map = new Map(columns.map((c) => [c.id, c.label]));
    return (id?: string) => (id ? (map.get(id) ?? 'etapa') : null);
  }, [columns]);

  const conditionSummary = (t: ManagerTrigger): string => {
    const cfg = t.conditionConfig;
    const stage = columnLabel(cfg.funnelColumnId);
    switch (t.conditionType) {
      case 'NO_INTERACTION': {
        const base = cfg.useCoolingDays
          ? 'Sem interação além do esfriamento da etapa'
          : `Sem interação há ${cfg.days ?? '?'} dias`;
        return stage ? `${base} (etapa: ${stage})` : base;
      }
      case 'STUCK_IN_STAGE': {
        const base = `Parado na mesma etapa há ${cfg.days ?? '?'} dias`;
        return stage ? `${base} (etapa: ${stage})` : base;
      }
      case 'DEAL_LOST':
        return 'Negociação perdida';
      case 'BIG_SALE':
        return `Venda acima de ${brl.format(cfg.minValue ?? 0)}`;
    }
  };

  const recipientsSummary = (t: ManagerTrigger): string => {
    const parts: string[] = [];
    if (t.notifyOwner) parts.push('responsável');
    if (t.notifyManagers) parts.push('gestores');
    if (t.notifyUserIds.length > 0) {
      parts.push(
        t.notifyUserIds.length === 1 ? '1 usuário específico' : `${t.notifyUserIds.length} usuários específicos`
      );
    }
    const base = parts.length > 0 ? `Notifica: ${parts.join(', ')}` : 'Sem destinatários';
    return t.emailEnabled ? `${base} (+ e-mail)` : base;
  };

  const toggleActive = async (t: ManagerTrigger, active: boolean) => {
    setItems((prev) => prev.map((p) => (p.id === t.id ? { ...p, active } : p)));
    try {
      await apiClient.updateManagerTrigger(t.id, { active });
      toast.success(active ? 'Gatilho ativado' : 'Gatilho desativado');
    } catch (err) {
      setItems((prev) => prev.map((p) => (p.id === t.id ? { ...p, active: t.active } : p)));
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar gatilho');
    }
  };

  const remove = async (t: ManagerTrigger) => {
    if (!confirm(`Excluir o gatilho "${t.name}"?`)) return;
    try {
      await apiClient.deleteManagerTrigger(t.id);
      setItems((prev) => prev.filter((p) => p.id !== t.id));
      toast.success('Gatilho excluído');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir gatilho');
    }
  };

  const buildPayload = (d: Draft): { payload: Partial<ManagerTriggerInput>; error?: string } => {
    // Gatilho padrão: só ativo + dias (backend ignora o resto por segurança).
    if (d.isDefault) {
      const conditionConfig: { days?: number } = {};
      const text = d.daysText.trim();
      if (text !== '') {
        const days = Number(text);
        if (!Number.isInteger(days) || days < 1) {
          return { payload: {}, error: 'Dias deve ser um número inteiro maior que zero' };
        }
        conditionConfig.days = days;
      }
      return {
        payload:
          text !== '' ? { active: d.active, conditionConfig } : { active: d.active },
      };
    }

    if (!d.name.trim()) return { payload: {}, error: 'Informe o nome do gatilho' };
    if (!d.notifyOwner && !d.notifyManagers && d.notifyUserIds.length === 0) {
      return { payload: {}, error: 'Selecione ao menos um destinatário' };
    }

    const conditionConfig: ManagerTriggerInput['conditionConfig'] = {};
    if (d.conditionType === 'NO_INTERACTION') {
      if (d.useCoolingDays) {
        conditionConfig.useCoolingDays = true;
      } else {
        const days = Number(d.daysText.trim());
        if (!Number.isInteger(days) || days < 1) {
          return { payload: {}, error: 'Informe os dias sem interação (inteiro maior que zero)' };
        }
        conditionConfig.days = days;
      }
      if (d.funnelColumnId) conditionConfig.funnelColumnId = d.funnelColumnId;
    } else if (d.conditionType === 'STUCK_IN_STAGE') {
      const days = Number(d.daysText.trim());
      if (!Number.isInteger(days) || days < 1) {
        return { payload: {}, error: 'Informe os dias parado na etapa (inteiro maior que zero)' };
      }
      conditionConfig.days = days;
      if (d.funnelColumnId) conditionConfig.funnelColumnId = d.funnelColumnId;
    } else if (d.conditionType === 'BIG_SALE') {
      const minValue = Number(d.minValueText.replace(',', '.').trim());
      if (!Number.isFinite(minValue) || minValue <= 0) {
        return { payload: {}, error: 'Informe o valor mínimo da venda (maior que zero)' };
      }
      conditionConfig.minValue = minValue;
    }

    return {
      payload: {
        name: d.name.trim(),
        conditionType: d.conditionType,
        conditionConfig,
        notifyOwner: d.notifyOwner,
        notifyManagers: d.notifyManagers,
        notifyUserIds: d.notifyUserIds,
        emailEnabled: d.emailEnabled,
        active: d.active,
      },
    };
  };

  const save = async () => {
    if (!draft) return;
    const { payload, error } = buildPayload(draft);
    if (error) {
      toast.error(error);
      return;
    }
    try {
      setSaving(true);
      if (draft.id) {
        await apiClient.updateManagerTrigger(draft.id, payload);
      } else {
        await apiClient.createManagerTrigger(payload as ManagerTriggerInput);
      }
      toast.success('Gatilho salvo!');
      setDraft(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar gatilho');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        Carregando gatilhos...
      </div>
    );
  }

  const needsDays =
    draft &&
    ((draft.conditionType === 'NO_INTERACTION' && !draft.useCoolingDays) ||
      draft.conditionType === 'STUCK_IN_STAGE');
  const showStage =
    draft &&
    (draft.conditionType === 'NO_INTERACTION' || draft.conditionType === 'STUCK_IN_STAGE');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground">Gatilhos gerenciais</h3>
          <p className="text-sm text-muted-foreground">
            Alertas automáticos para a gestão: negociações esfriando, paradas na etapa,
            perdidas ou vendas acima de um valor. Avaliados periodicamente com deduplicação.
          </p>
        </div>
        <Button onClick={() => setDraft(emptyDraft())}>
          <Plus size={16} className="mr-2" />
          Novo gatilho
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
          <BellPlus size={24} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum gatilho configurado.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{t.name}</span>
                  {t.isDefault && <Badge variant="secondary">Padrão</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {conditionSummary(t)} · {recipientsSummary(t)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={t.active}
                  onCheckedChange={(v) => toggleActive(t, v)}
                  aria-label={`Ativar/desativar ${t.name}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraft(draftFrom(t))}
                  aria-label={`Editar ${t.name}`}
                >
                  <Pencil size={16} />
                </Button>
                {!t.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => remove(t)}
                    aria-label={`Excluir ${t.name}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? (draft.isDefault ? 'Gatilho padrão' : 'Editar gatilho') : 'Novo gatilho'}
            </DialogTitle>
            <DialogDescription>
              {draft?.isDefault
                ? 'O gatilho padrão de negociações esfriando permite apenas ativar/desativar e ajustar os dias.'
                : 'Defina a condição, os destinatários e o canal do alerta.'}
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="trigger-name">Nome</Label>
                <Input
                  id="trigger-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Ex.: Vendas grandes"
                  maxLength={120}
                  className="mt-1"
                  disabled={draft.isDefault}
                />
              </div>

              <div>
                <Label>Condição</Label>
                <Select
                  value={draft.conditionType}
                  onValueChange={(v) =>
                    setDraft({
                      ...draft,
                      conditionType: v as TriggerConditionType,
                      daysText: '',
                      useCoolingDays: false,
                      funnelColumnId: '',
                      minValueText: '',
                    })
                  }
                  disabled={draft.isDefault}
                >
                  <SelectTrigger className="mt-1" aria-label="Tipo de condição">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CONDITION_LABELS) as TriggerConditionType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {CONDITION_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {draft.isDefault ? (
                <div>
                  <Label htmlFor="trigger-days">Dias sem interação</Label>
                  <Input
                    id="trigger-days"
                    type="number"
                    min={1}
                    value={draft.daysText}
                    onChange={(e) => setDraft({ ...draft, daysText: e.target.value })}
                    placeholder="Vazio = esfriamento por etapa"
                    className="mt-1 w-56"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Deixe vazio para usar o esfriamento configurado em cada etapa do funil.
                  </p>
                </div>
              ) : (
                <>
                  {draft.conditionType === 'NO_INTERACTION' && (
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <Label htmlFor="trigger-cooling">Usar esfriamento por etapa</Label>
                        <p className="text-xs text-muted-foreground">
                          Usa os dias de esfriamento configurados em cada etapa do funil.
                        </p>
                      </div>
                      <Switch
                        id="trigger-cooling"
                        checked={draft.useCoolingDays}
                        onCheckedChange={(v) => setDraft({ ...draft, useCoolingDays: v })}
                      />
                    </div>
                  )}

                  {needsDays && (
                    <div>
                      <Label htmlFor="trigger-days">Dias</Label>
                      <Input
                        id="trigger-days"
                        type="number"
                        min={1}
                        value={draft.daysText}
                        onChange={(e) => setDraft({ ...draft, daysText: e.target.value })}
                        placeholder="Ex.: 7"
                        className="mt-1 w-36"
                      />
                    </div>
                  )}

                  {showStage && (
                    <div>
                      <Label>Etapa (opcional)</Label>
                      <Select
                        value={draft.funnelColumnId || 'ALL'}
                        onValueChange={(v) =>
                          setDraft({ ...draft, funnelColumnId: v === 'ALL' ? '' : v })
                        }
                      >
                        <SelectTrigger className="mt-1" aria-label="Etapa do funil">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Todas as etapas</SelectItem>
                          {columns.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {draft.conditionType === 'BIG_SALE' && (
                    <div>
                      <Label htmlFor="trigger-min-value">Valor mínimo da venda (R$)</Label>
                      <Input
                        id="trigger-min-value"
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.minValueText}
                        onChange={(e) => setDraft({ ...draft, minValueText: e.target.value })}
                        placeholder="Ex.: 50000"
                        className="mt-1 w-48"
                      />
                    </div>
                  )}

                  <div className="space-y-3 border-t border-border pt-4">
                    <p className="text-sm font-medium text-foreground">Destinatários</p>
                    <div className="flex items-center justify-between gap-4">
                      <Label htmlFor="trigger-owner" className="font-normal">
                        Responsável pelo negócio
                      </Label>
                      <Switch
                        id="trigger-owner"
                        checked={draft.notifyOwner}
                        onCheckedChange={(v) => setDraft({ ...draft, notifyOwner: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <Label htmlFor="trigger-managers" className="font-normal">
                        Gestores (ADMIN/GESTOR)
                      </Label>
                      <Switch
                        id="trigger-managers"
                        checked={draft.notifyManagers}
                        onCheckedChange={(v) => setDraft({ ...draft, notifyManagers: v })}
                      />
                    </div>
                    <div>
                      <Label className="font-normal">Usuários específicos</Label>
                      {users.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Nenhum usuário disponível.
                        </p>
                      ) : (
                        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                          {users.map((u) => {
                            const checked = draft.notifyUserIds.includes(u.id);
                            return (
                              <label
                                key={u.id}
                                className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm text-foreground hover:bg-accent"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) =>
                                    setDraft({
                                      ...draft,
                                      notifyUserIds: v
                                        ? [...draft.notifyUserIds, u.id]
                                        : draft.notifyUserIds.filter((id) => id !== u.id),
                                    })
                                  }
                                />
                                {u.name}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                    <div>
                      <Label htmlFor="trigger-email">Também enviar por e-mail</Label>
                      <p className="text-xs text-muted-foreground">
                        Requer configuração de e-mail do tenant.
                      </p>
                    </div>
                    <Switch
                      id="trigger-email"
                      checked={draft.emailEnabled}
                      onCheckedChange={(v) => setDraft({ ...draft, emailEnabled: v })}
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                <Label htmlFor="trigger-active">Ativo</Label>
                <Switch
                  id="trigger-active"
                  checked={draft.active}
                  onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
