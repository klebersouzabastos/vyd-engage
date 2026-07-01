import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Plus,
  Loader2,
  Building2,
  Briefcase,
  CheckCircle2,
  Circle,
  CalendarClock,
  Users,
  ScanSearch,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api/client';
import { useRoadmap, useRoadmapActions } from '../hooks/useComercial';
import { Organograma } from '../components/comercial/Organograma';
import {
  ROADMAP_STATUS_LABELS,
  TASK_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
  STAKEHOLDER_ROLE_LABELS,
  STAKEHOLDER_POSTURE_LABELS,
  type CommercialRoadmapStatus,
  type RoadmapTask,
  type TaskType,
  type TaskPriority,
  type StakeholderRole,
  type StakeholderPosture,
} from '../types/comercial';

const STATUS_VARIANT: Record<
  CommercialRoadmapStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PLANEJAMENTO: 'secondary',
  EM_ANDAMENTO: 'default',
  PROPOSTA: 'default',
  GANHO: 'default',
  PERDIDO: 'destructive',
  ARQUIVADO: 'outline',
};
const TASK_TYPES = Object.keys(TASK_TYPE_LABELS) as TaskType[];
const PRIORITIES = Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[];
const NONE = '__none__';

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—';
}

export function RoadmapView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roadmapQuery = useRoadmap(id);
  const { advanceToProposal, upsertStakeholder, removeStakeholder, invalidate } =
    useRoadmapActions();
  const roadmap = roadmapQuery.data;

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => apiClient.getUsers() });
  const users = usersQuery.data ?? [];

  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addActionOpen, setAddActionOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [registerTask, setRegisterTask] = useState<RoadmapTask | null>(null);

  const tasks = [...(roadmap?.tasks ?? [])].sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return da - db;
  });
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
  const progress =
    roadmap?.status === 'GANHO'
      ? 100
      : tasks.length
        ? Math.round((completed / tasks.length) * 100)
        : 0;

  const isClosed = roadmap?.status === 'GANHO' || roadmap?.status === 'PERDIDO';

  const toggleTask = async (t: RoadmapTask) => {
    try {
      await apiClient.updateTask(t.id, {
        status: t.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED',
      });
      invalidate(id);
    } catch {
      toast.error('Não foi possível atualizar a ação.');
    }
  };

  const rescheduleTask = async (t: RoadmapTask, date: string) => {
    try {
      await apiClient.updateTask(t.id, { dueDate: date || null });
      invalidate(id);
    } catch {
      toast.error('Não foi possível reagendar a ação.');
    }
  };

  const reassignTask = async (taskId: string, userId: string) => {
    try {
      await apiClient.updateTask(taskId, { assignedTo: userId });
      invalidate(id);
    } catch {
      toast.error('Não foi possível atribuir a ação.');
    }
  };

  const handleAdvance = async () => {
    if (!id) return;
    setAdvancing(true);
    try {
      await advanceToProposal(id);
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60">
      <Header
        title={roadmap?.title ?? 'Desdobramento'}
        subtitle="Rota de ações comerciais até a proposta"
      />

      <div className="space-y-6 p-4 md:p-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/app/deep-research"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/app/deep-research');
                }}
              >
                Inteligência de Mercado
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{roadmap?.title ?? '…'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {roadmapQuery.isLoading ? (
          <p className="py-12 text-center text-sm text-slate-500">Carregando…</p>
        ) : !roadmap ? (
          <p className="py-12 text-center text-sm text-slate-500">Desdobramento não encontrado.</p>
        ) : (
          <>
            {/* Resumo + progresso + avançar */}
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">{roadmap.title}</h2>
                      <Badge variant={STATUS_VARIANT[roadmap.status]}>
                        {ROADMAP_STATUS_LABELS[roadmap.status]}
                      </Badge>
                    </div>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {roadmap.company.name}
                      </span>
                      {roadmap.empreendimento && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3.5 w-3.5" />
                          {roadmap.empreendimento.name}
                        </span>
                      )}
                      {roadmap.playbookTemplate && (
                        <span>Playbook: {roadmap.playbookTemplate.name}</span>
                      )}
                      {roadmap.deepResearch && (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-primary hover:underline"
                          onClick={() => navigate(`/app/deep-research/${roadmap.deepResearch!.id}`)}
                        >
                          <ScanSearch className="h-3.5 w-3.5" />
                          Pesquisa de origem
                        </button>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {roadmap.deal ? (
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/app/deals/${roadmap.deal!.id}`)}
                      >
                        <Trophy className="mr-1.5 h-4 w-4" />
                        Ver Deal
                      </Button>
                    ) : null}
                    <Button onClick={handleAdvance} disabled={advancing || isClosed}>
                      {advancing ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="mr-1.5 h-4 w-4" />
                      )}
                      Avançar para proposta
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Progresso até a proposta</span>
                    <span>
                      {completed}/{tasks.length} ações · {progress}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Organograma de decisores */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />
                    Decisores
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setAddContactOpen(true)}>
                    <Plus className="mr-1 h-4 w-4" />
                    Contato
                  </Button>
                </CardHeader>
                <CardContent>
                  <Organograma
                    stakeholders={roadmap.stakeholders}
                    onUpdate={(leadId, patch) =>
                      upsertStakeholder(roadmap.id, { leadId, ...patch })
                    }
                    onRemove={(leadId) => removeStakeholder(roadmap.id, leadId)}
                  />
                </CardContent>
              </Card>

              {/* Agenda de ações */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarClock className="h-4 w-4" />
                    Agenda de ações
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setAddActionOpen(true)}>
                    <Plus className="mr-1 h-4 w-4" />
                    Ação
                  </Button>
                </CardHeader>
                <CardContent>
                  {tasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                      Nenhuma ação ainda. Escolha um playbook ou adicione ações manualmente.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {tasks.map((t) => {
                        const overdue =
                          t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < new Date();
                        return (
                          <li
                            key={t.id}
                            className="flex items-start gap-2 rounded-lg border border-slate-200 p-3"
                          >
                            <button
                              type="button"
                              aria-label="Concluir ação"
                              className="mt-0.5 shrink-0"
                              onClick={() => toggleTask(t)}
                            >
                              {t.status === 'COMPLETED' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <Circle className="h-5 w-5 text-slate-300" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => setRegisterTask(t)}
                                title="Registrar ação"
                                className={`w-full truncate text-left text-sm font-medium hover:underline ${
                                  t.status === 'COMPLETED'
                                    ? 'text-slate-400 line-through'
                                    : 'text-slate-900'
                                }`}
                              >
                                {t.title}
                              </button>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                {t.type && (
                                  <Badge variant="outline" className="text-xs">
                                    {TASK_TYPE_LABELS[t.type]}
                                  </Badge>
                                )}
                                <span
                                  className={
                                    overdue ? 'font-medium text-red-600' : 'text-slate-500'
                                  }
                                >
                                  {fmtDate(t.dueDate)}
                                </span>
                                {t.lead && <span className="text-slate-500">· {t.lead.name}</span>}
                                <div className="ml-auto flex items-center gap-1">
                                  <select
                                    className="rounded border border-slate-200 px-1 py-0.5 text-xs text-slate-500"
                                    style={{ maxWidth: 120 }}
                                    value={t.assignedTo ?? ''}
                                    onChange={(e) =>
                                      e.target.value && reassignTask(t.id, e.target.value)
                                    }
                                    aria-label="Responsável"
                                  >
                                    <option value="">Atribuir…</option>
                                    {users.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.name}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="date"
                                    className="rounded border border-slate-200 px-1 py-0.5 text-xs text-slate-500"
                                    value={
                                      t.dueDate
                                        ? new Date(t.dueDate).toISOString().slice(0, 10)
                                        : ''
                                    }
                                    onChange={(e) => rescheduleTask(t, e.target.value)}
                                    aria-label="Reagendar"
                                  />
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {roadmap && (
        <>
          <AddContactDialog
            open={addContactOpen}
            onOpenChange={setAddContactOpen}
            roadmapId={roadmap.id}
            companyId={roadmap.companyId}
            existingLeadIds={roadmap.stakeholders.map((s) => s.leadId)}
            onAdd={async (leadId, role, posture, reportsToId) => {
              if (reportsToId) {
                await apiClient.updateLead(leadId, { reportsToId });
              }
              await upsertStakeholder(roadmap.id, { leadId, roleInDecision: role, posture });
            }}
            stakeholders={roadmap.stakeholders.map((s) => ({
              leadId: s.leadId,
              name: s.lead.name,
            }))}
          />
          <AddActionDialog
            open={addActionOpen}
            onOpenChange={setAddActionOpen}
            roadmapId={roadmap.id}
            companyId={roadmap.companyId}
            empreendimentoId={roadmap.empreendimentoId ?? undefined}
            assignedTo={user?.id}
            users={users}
            contacts={roadmap.stakeholders.map((s) => ({ leadId: s.leadId, name: s.lead.name }))}
            onCreated={() => invalidate(roadmap.id)}
          />
        </>
      )}

      <RegisterActionDialog
        task={registerTask}
        onClose={() => setRegisterTask(null)}
        onDone={() => invalidate(id)}
      />
    </div>
  );
}

// ── Dialog: adicionar contato (decisor) ────────────
function AddContactDialog({
  open,
  onOpenChange,
  companyId,
  existingLeadIds,
  stakeholders,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roadmapId: string;
  companyId: string;
  existingLeadIds: string[];
  stakeholders: { leadId: string; name: string }[];
  onAdd: (
    leadId: string,
    role: StakeholderRole,
    posture: StakeholderPosture,
    reportsToId?: string
  ) => Promise<void>;
}) {
  const [leadId, setLeadId] = useState('');
  const [role, setRole] = useState<StakeholderRole>('DECISOR');
  const [posture, setPosture] = useState<StakeholderPosture>('DESCONHECIDO');
  const [reportsTo, setReportsTo] = useState<string>(NONE);
  const [saving, setSaving] = useState(false);

  const leadsQuery = useQuery({
    queryKey: ['leads', 'roadmap-contacts', companyId],
    queryFn: () => apiClient.getLeads({ companyId, limit: 100 }),
    enabled: open,
  });
  const leads = ((leadsQuery.data?.leads ?? []) as Array<{ id: string; name: string }>).filter(
    (l) => !existingLeadIds.includes(l.id)
  );

  const submit = async () => {
    if (!leadId) return;
    setSaving(true);
    try {
      await onAdd(leadId, role, posture, reportsTo === NONE ? undefined : reportsTo);
      onOpenChange(false);
      setLeadId('');
      setReportsTo(NONE);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Adicionar contato ao desdobramento</DialogTitle>
          <DialogDescription>
            Escolha um contato da empresa e defina papel, postura e a quem ele reporta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Contato</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger>
                <SelectValue placeholder={leadsQuery.isLoading ? 'Carregando…' : 'Selecione'} />
              </SelectTrigger>
              <SelectContent>
                {leads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!leadsQuery.isLoading && leads.length === 0 && (
              <p className="text-xs text-slate-500">
                Nenhum contato disponível desta empresa. Cadastre contatos vinculados à empresa
                primeiro.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as StakeholderRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STAKEHOLDER_ROLE_LABELS) as StakeholderRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {STAKEHOLDER_ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Postura</Label>
              <Select value={posture} onValueChange={(v) => setPosture(v as StakeholderPosture)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STAKEHOLDER_POSTURE_LABELS) as StakeholderPosture[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {STAKEHOLDER_POSTURE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reporta a (opcional)</Label>
            <Select value={reportsTo} onValueChange={setReportsTo}>
              <SelectTrigger>
                <SelectValue placeholder="Ninguém" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Ninguém</SelectItem>
                {stakeholders.map((s) => (
                  <SelectItem key={s.leadId} value={s.leadId}>
                    {s.name}
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
          <Button onClick={submit} disabled={!leadId || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: adicionar ação manual ──────────────────
function AddActionDialog({
  open,
  onOpenChange,
  roadmapId,
  companyId,
  empreendimentoId,
  assignedTo,
  users,
  contacts,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roadmapId: string;
  companyId: string;
  empreendimentoId?: string;
  assignedTo?: string;
  users: { id: string; name: string }[];
  contacts: { leadId: string; name: string }[];
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('LIGACAO');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [leadId, setLeadId] = useState<string>(NONE);
  const [assignee, setAssignee] = useState<string>(assignedTo ?? NONE);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await apiClient.createTask({
        title: title.trim(),
        type,
        priority,
        dueDate: dueDate || undefined,
        roadmapId,
        companyId,
        empreendimentoId,
        assignedTo: assignee === NONE ? undefined : assignee,
        leadId: leadId === NONE ? undefined : leadId,
      });
      onCreated();
      onOpenChange(false);
      setTitle('');
      setDueDate('');
      setLeadId(NONE);
    } catch {
      toast.error('Não foi possível criar a ação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Nova ação</DialogTitle>
          <DialogDescription>
            A ação entra na agenda e nos lembretes, vinculada a este desdobramento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ac-title">Título</Label>
            <Input
              id="ac-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Ligar para o decisor"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TASK_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ac-date">Vencimento</Label>
              <Input
                id="ac-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contato (opcional)</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.leadId} value={c.leadId}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem responsável</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
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
          <Button onClick={submit} disabled={!title.trim() || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar ação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: registrar desfecho de uma ação ─────────
function RegisterActionDialog({
  task,
  onClose,
  onDone,
}: {
  task: RoadmapTask | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [outcome, setOutcome] = useState<'REALIZADA' | 'SEM_CONTATO' | 'REAGENDAR'>('REALIZADA');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setOutcome('REALIZADA');
      setNote('');
      setDate(new Date().toISOString().slice(0, 10));
      setNewDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '');
    }
  }, [task]);

  const submit = async () => {
    if (!task) return;
    if (outcome === 'REAGENDAR' && !newDueDate) {
      toast.error('Informe a nova data.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.registerTaskAction(task.id, {
        outcome,
        note: note.trim() || undefined,
        date: date || undefined,
        newDueDate: outcome === 'REAGENDAR' ? newDueDate : undefined,
      });
      onDone();
      onClose();
    } catch {
      toast.error('Não foi possível registrar a ação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Registrar ação</DialogTitle>
          <DialogDescription>{task?.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Desfecho</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REALIZADA">Realizada</SelectItem>
                <SelectItem value="SEM_CONTATO">Sem contato</SelectItem>
                <SelectItem value="REAGENDAR">Reagendar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rg-date">Data</Label>
              <Input
                id="rg-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            {outcome === 'REAGENDAR' && (
              <div className="space-y-1.5">
                <Label htmlFor="rg-newdate">Nova data</Label>
                <Input
                  id="rg-newdate"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rg-note">Nota</Label>
            <Textarea
              id="rg-note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="O que aconteceu nesta ação?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
