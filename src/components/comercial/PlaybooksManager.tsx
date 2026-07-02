import { useState } from 'react';
import { Plus, Trash2, Pencil, Loader2, ArrowLeft, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { RichTextEditor } from '../ui/RichTextEditor';
import { usePlaybooks, usePlaybookActions } from '../../hooks/useComercial';
import {
  TASK_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
  STAKEHOLDER_ROLE_LABELS,
  COMMERCIAL_FUNCTIONS,
  COMMERCIAL_FUNCTION_LABELS,
  type PlaybookStep,
  type PlaybookTemplate,
  type TaskType,
  type TaskPriority,
  type StakeholderRole,
  type CommercialFunction,
} from '../../types/comercial';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NONE = '__none__';
const TASK_TYPES = Object.keys(TASK_TYPE_LABELS) as TaskType[];
const PRIORITIES = Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[];
const ROLES = Object.keys(STAKEHOLDER_ROLE_LABELS) as StakeholderRole[];

function emptyStep(order: number): PlaybookStep {
  return {
    order,
    title: '',
    actionType: 'LIGACAO',
    targetRole: null,
    responsibleFunction: null,
    offsetDays: 0,
    priority: 'MEDIUM',
  };
}

export function PlaybooksManager({ open, onOpenChange }: Props) {
  const playbooksQuery = usePlaybooks();
  const { createPlaybook, updatePlaybook, deletePlaybook } = usePlaybookActions();
  const playbooks = playbooksQuery.data?.items ?? [];

  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<PlaybookStep[]>([emptyStep(1)]);
  const [saving, setSaving] = useState(false);

  const startNew = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setSteps([emptyStep(1)]);
    setMode('form');
  };

  const startEdit = (pb: PlaybookTemplate) => {
    setEditingId(pb.id);
    setName(pb.name);
    setDescription(pb.description ?? '');
    setSteps(pb.steps.length ? pb.steps.map((s, i) => ({ ...s, order: i + 1 })) : [emptyStep(1)]);
    setMode('form');
  };

  const setStep = (i: number, patch: Partial<PlaybookStep>) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addStep = () => setSteps((prev) => [...prev, emptyStep(prev.length + 1)]);
  const removeStep = (i: number) =>
    setSteps((prev) =>
      prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 }))
    );

  const canSave = name.trim() && steps.length > 0 && steps.every((s) => s.title.trim());

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        steps: steps.map((s, i) => ({
          order: i + 1,
          title: s.title.trim(),
          actionType: s.actionType,
          targetRole: s.targetRole ?? null,
          responsibleFunction: s.responsibleFunction ?? null,
          offsetDays: Number(s.offsetDays) || 0,
          priority: s.priority,
          description: s.description ?? null,
        })),
      };
      if (editingId) await updatePlaybook(editingId, payload);
      else await createPlaybook(payload);
      setMode('list');
    } catch {
      /* toast no hook */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-y-auto sm:max-w-[640px]" style={{ maxHeight: '85vh' }}>
        <DialogHeader>
          <DialogTitle>
            {mode === 'list' ? 'Playbooks' : editingId ? 'Editar playbook' : 'Novo playbook'}
          </DialogTitle>
          <DialogDescription>
            Modelos de jornada que geram a sequência de ações de um desdobramento.
          </DialogDescription>
        </DialogHeader>

        {mode === 'list' ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={startNew}>
                <Plus className="mr-1 h-4 w-4" />
                Novo playbook
              </Button>
            </div>
            {playbooksQuery.isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <TooltipProvider delayDuration={200}>
                <ul className="space-y-2">
                  {playbooks.map((pb) => (
                    <li key={pb.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium text-foreground">
                            {pb.name}
                            {pb.isBuiltin && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Lock className="h-3 w-3" /> padrão
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{pb.steps.length} passos</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {pb.isBuiltin ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Editar"
                                    disabled
                                    className="pointer-events-none"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Playbook padrão não é editável</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Editar"
                              onClick={() => startEdit(pb)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Excluir"
                            disabled={pb.isBuiltin}
                            onClick={() => deletePlaybook(pb.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </TooltipProvider>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit px-2"
              onClick={() => setMode('list')}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>

            <div className="space-y-1.5">
              <Label htmlFor="pb-name">Nome</Label>
              <Input
                id="pb-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Acesso a nova conta"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pb-desc">Descrição</Label>
              <Input
                id="pb-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Para que serve esta jornada"
              />
            </div>

            <div className="space-y-2">
              <Label>Passos</Label>
              {steps.map((s, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                    <Input
                      value={s.title}
                      onChange={(e) => setStep(i, { title: e.target.value })}
                      placeholder="Título da ação"
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover passo"
                      onClick={() => removeStep(i)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    <Select
                      value={s.actionType}
                      onValueChange={(v) => setStep(i, { actionType: v as TaskType })}
                    >
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
                    <Select
                      value={s.responsibleFunction ?? NONE}
                      onValueChange={(v) =>
                        setStep(i, {
                          responsibleFunction: v === NONE ? null : (v as CommercialFunction),
                        })
                      }
                    >
                      <SelectTrigger aria-label="Função responsável">
                        <SelectValue placeholder="Função responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sem função</SelectItem>
                        {COMMERCIAL_FUNCTIONS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {COMMERCIAL_FUNCTION_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={s.targetRole ?? NONE}
                      onValueChange={(v) =>
                        setStep(i, { targetRole: v === NONE ? null : (v as StakeholderRole) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Papel-alvo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sem papel-alvo</SelectItem>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {STAKEHOLDER_ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={s.priority}
                      onValueChange={(v) => setStep(i, { priority: v as TaskPriority })}
                    >
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
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        value={s.offsetDays}
                        onChange={(e) => setStep(i, { offsetDays: Number(e.target.value) })}
                        className="w-16"
                        aria-label="SLA em dias"
                      />
                      <span className="text-xs text-muted-foreground">SLA (dias)</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Descrição do passo</Label>
                    <RichTextEditor
                      value={s.description ?? ''}
                      onChange={(html) => setStep(i, { description: html })}
                      placeholder="Detalhe o que fazer neste passo…"
                      minHeight={90}
                      ariaLabel={`Descrição do passo ${i + 1}`}
                    />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="mr-1 h-4 w-4" />
                Adicionar passo
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMode('list')}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={!canSave || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? 'Salvar' : 'Criar playbook'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
