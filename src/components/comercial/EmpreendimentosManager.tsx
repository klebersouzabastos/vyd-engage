import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Briefcase, Users, Trash2, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { apiClient } from '../../services/api/client';
import { useEmpreendimentos, useEmpreendimentoActions } from '../../hooks/useComercial';
import type { Empreendimento } from '../../types/comercial';

const STATUSES = ['ATIVO', 'STANDBY', 'ENCERRADO'];

function fmtMoney(v?: number | string | null) {
  if (v == null) return null;
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function EmpreendimentosManager({ companyId }: { companyId: string }) {
  const listQuery = useEmpreendimentos({ companyId });
  const items = listQuery.data?.items ?? [];
  const [createOpen, setCreateOpen] = useState(false);
  const [contactsTarget, setContactsTarget] = useState<Empreendimento | null>(null);
  const { deleteEmpreendimento } = useEmpreendimentoActions();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Briefcase size={16} className="text-gray-400" />
          Empreendimentos
        </h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1" />
          Novo
        </Button>
      </div>

      {listQuery.isLoading ? (
        <p className="py-10 text-center text-sm text-gray-500">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            Nenhum empreendimento cadastrado para esta empresa.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{e.name}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                  {e.type && <span>{e.type}</span>}
                  {e.phase && <span>· {e.phase}</span>}
                  {e.location && (
                    <span className="flex items-center gap-0.5">
                      · <MapPin size={11} /> {e.location}
                    </span>
                  )}
                  {fmtMoney(e.estimatedValue) && <span>· {fmtMoney(e.estimatedValue)}</span>}
                  <span>· {e._count?.contacts ?? 0} contatos</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setContactsTarget(e)}>
                  <Users size={14} className="mr-1" />
                  Contatos
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover"
                  onClick={() => deleteEmpreendimento(e.id)}
                >
                  <Trash2 size={16} className="text-red-500" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateEmpreendimentoDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companyId={companyId}
      />
      {contactsTarget && (
        <LinkContactsDialog
          open={!!contactsTarget}
          onOpenChange={(o) => !o && setContactsTarget(null)}
          empreendimento={contactsTarget}
          companyId={companyId}
        />
      )}
    </div>
  );
}

function CreateEmpreendimentoDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
}) {
  const { createEmpreendimento } = useEmpreendimentoActions();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [phase, setPhase] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [expectedDecisionDate, setExpectedDecisionDate] = useState('');
  const [status, setStatus] = useState('ATIVO');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createEmpreendimento({
        companyId,
        name: name.trim(),
        type: type.trim() || undefined,
        location: location.trim() || undefined,
        phase: phase.trim() || undefined,
        estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
        expectedDecisionDate: expectedDecisionDate || undefined,
        status,
      });
      onOpenChange(false);
      setName('');
      setType('');
      setLocation('');
      setPhase('');
      setEstimatedValue('');
      setExpectedDecisionDate('');
      setStatus('ATIVO');
    } catch {
      /* toast no hook */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Novo empreendimento</DialogTitle>
          <DialogDescription>
            Obra/projeto do cliente, sempre vinculado a esta empresa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="emp-name">Nome</Label>
            <Input
              id="emp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Obra Torre Norte"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-type">Tipo</Label>
              <Input
                id="emp-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="obra, planta…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-phase">Fase</Label>
              <Input
                id="emp-phase"
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                placeholder="projeto, execução…"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-loc">Localização</Label>
            <Input id="emp-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-value">Valor estimado (R$)</Label>
              <Input
                id="emp-value"
                type="number"
                min={0}
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-date">Decisão prevista</Label>
              <Input
                id="emp-date"
                type="date"
                value={expectedDecisionDate}
                onChange={(e) => setExpectedDecisionDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!name.trim() || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkContactsDialog({
  open,
  onOpenChange,
  empreendimento,
  companyId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empreendimento: Empreendimento;
  companyId: string;
}) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const leadsQuery = useQuery({
    queryKey: ['leads', 'company-contacts', companyId],
    queryFn: () => apiClient.getLeads({ companyId, limit: 200 }),
    enabled: open,
  });
  const leads = (leadsQuery.data?.leads ?? []) as Array<{
    id: string;
    name: string;
    empreendimentoId?: string | null;
  }>;

  const toggle = async (leadId: string, linked: boolean) => {
    setBusyId(leadId);
    try {
      await apiClient.updateLead(leadId, { empreendimentoId: linked ? empreendimento.id : null });
      await qc.invalidateQueries({ queryKey: ['leads', 'company-contacts', companyId] });
      await qc.invalidateQueries({ queryKey: ['empreendimentos'] });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Contatos · {empreendimento.name}</DialogTitle>
          <DialogDescription>
            Marque os contatos da empresa que pertencem a este empreendimento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 overflow-y-auto py-2" style={{ maxHeight: '50vh' }}>
          {leadsQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-gray-500">Carregando…</p>
          ) : leads.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Nenhum contato vinculado a esta empresa.
            </p>
          ) : (
            leads.map((l) => {
              const linked = l.empreendimentoId === empreendimento.id;
              return (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-50"
                >
                  <Checkbox
                    checked={linked}
                    disabled={busyId === l.id}
                    onCheckedChange={(c) => toggle(l.id, !!c)}
                  />
                  <span className="text-sm text-gray-900">{l.name}</span>
                  {l.empreendimentoId && !linked && (
                    <span className="ml-auto text-xs text-gray-400">em outro empreendimento</span>
                  )}
                </label>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Concluído</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
