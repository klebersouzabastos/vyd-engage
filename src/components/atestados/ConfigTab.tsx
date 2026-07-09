// Aba "Configurações" do módulo de Gestão de Atestados Técnicos.
//
// Duas seções:
//   1. Ciclo de vida das pendências — CRUD das etapas (PendenciaStatus): criar,
//      editar (nome/ordem/isFinal) e excluir (etapas em uso são bloqueadas no
//      backend; o erro é exibido via toast pelo wrap de useAtestadoActions).
//   2. Taxonomia controlada — Select de tipo (CATEGORIA/DISCIPLINA/SEGMENTO/SERVICO)
//      controla useTaxonomias(tipo); adicionar/remover itens. Itens "padrão"
//      (builtin) não podem ser removidos (erro via toast).
//
// Componentes consomem só os hooks de useAtestados.ts — nunca apiClient direto.

import { useState } from 'react';
import { Plus, Pencil, Trash2, Bell } from 'lucide-react';
import { usePendenciaStatus, useTaxonomias, useAtestadoActions, useAtestadoConfig } from '@/hooks/useAtestados';
import type { PendenciaStatus, TaxonomiaTipo } from '@/types/atestados';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const TAXONOMIA_TIPOS: { value: TaxonomiaTipo; label: string }[] = [
  { value: 'CATEGORIA', label: 'Categoria' },
  { value: 'DISCIPLINA', label: 'Disciplina' },
  { value: 'SEGMENTO', label: 'Segmento' },
  { value: 'SERVICO', label: 'Serviço' },
];

// ── Seção 1: ciclo de vida das pendências ────────────────────────────────────
function PendenciaStatusSection() {
  const { data: statuses, isLoading, isError } = usePendenciaStatus();
  const actions = useAtestadoActions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PendenciaStatus | null>(null);
  const [nome, setNome] = useState('');
  const [ordem, setOrdem] = useState('0');
  const [isFinal, setIsFinal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PendenciaStatus | null>(null);
  const [deleting, setDeleting] = useState(false);

  const ordered = [...(statuses ?? [])].sort((a, b) => a.ordem - b.ordem);

  function openCreate() {
    setEditing(null);
    setNome('');
    setOrdem(String(ordered.length));
    setIsFinal(false);
    setDialogOpen(true);
  }

  function openEdit(status: PendenciaStatus) {
    setEditing(status);
    setNome(status.nome);
    setOrdem(String(status.ordem));
    setIsFinal(status.isFinal);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const nomeTrim = nome.trim();
    if (!nomeTrim) return;
    const ordemNum = Number.parseInt(ordem, 10);
    const ordemVal = Number.isFinite(ordemNum) ? ordemNum : 0;
    setSaving(true);
    try {
      if (editing) {
        await actions.updateStatus(editing.id, { nome: nomeTrim, ordem: ordemVal, isFinal });
      } else {
        await actions.createStatus({ nome: nomeTrim, ordem: ordemVal, isFinal });
      }
      setDialogOpen(false);
    } catch {
      // Erro já exibido via toast pelo wrap de useAtestadoActions; diálogo fica aberto.
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await actions.deleteStatus(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Etapas em uso não podem ser removidas — erro exibido via toast.
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Ciclo de vida das pendências</CardTitle>
          <CardDescription>
            Etapas pelas quais uma pendência passa até virar atestado. Etapas marcadas
            como finais encerram o fluxo.
          </CardDescription>
        </div>
        <Button size="sm" className="gap-1 shrink-0" onClick={openCreate}>
          <Plus size={14} />
          Nova etapa
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Não foi possível carregar as etapas.
          </p>
        ) : ordered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma etapa cadastrada. Crie a primeira etapa do ciclo.
          </p>
        ) : (
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-24">Ordem</TableHead>
                  <TableHead className="w-24">Tipo</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordered.map((status) => (
                  <TableRow key={status.id}>
                    <TableCell className="font-medium text-foreground">
                      {status.nome}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{status.ordem}</TableCell>
                    <TableCell>
                      {status.isFinal ? (
                        <Badge variant="secondary">Final</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => openEdit(status)}
                        >
                          <Pencil size={13} />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setDeleteTarget(status)}
                        >
                          <Trash2 size={13} />
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Diálogo criar/editar etapa */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!saving) setDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar etapa' : 'Nova etapa'}</DialogTitle>
            <DialogDescription>
              Defina o nome, a ordem de exibição e se a etapa encerra o fluxo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status-nome">Nome</Label>
              <Input
                id="status-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Em análise"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-ordem">Ordem</Label>
              <Input
                id="status-ordem"
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="status-final">Etapa final</Label>
                <p className="text-xs text-muted-foreground">
                  Encerra o ciclo da pendência.
                </p>
              </div>
              <Switch id="status-final" checked={isFinal} onCheckedChange={setIsFinal} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !nome.trim()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de etapa */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etapa</AlertDialogTitle>
            <AlertDialogDescription>
              A etapa "{deleteTarget?.nome}" será removida. Etapas em uso por pendências
              não podem ser excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
            >
              {deleting ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ── Seção 2: taxonomia controlada ────────────────────────────────────────────
function TaxonomiaSection() {
  const [tipo, setTipo] = useState<TaxonomiaTipo>('CATEGORIA');
  const { data: itens, isLoading, isError } = useTaxonomias(tipo);
  const actions = useAtestadoActions();

  const [novoNome, setNovoNome] = useState('');
  const [adding, setAdding] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const lista = itens ?? [];

  async function handleAdd() {
    const nomeTrim = novoNome.trim();
    if (!nomeTrim) return;
    setAdding(true);
    try {
      await actions.createTaxonomia(tipo, nomeTrim);
      setNovoNome('');
    } catch {
      // Erro já exibido via toast pelo wrap de useAtestadoActions.
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await actions.deleteTaxonomia(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Itens padrão (builtin) não podem ser removidos — erro via toast.
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Taxonomia controlada</CardTitle>
        <CardDescription>
          Listas padronizadas de categorias, disciplinas, segmentos e serviços usadas
          no acervo. Itens padrão não podem ser removidos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="taxonomia-tipo">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TaxonomiaTipo)}>
              <SelectTrigger id="taxonomia-tipo" className="w-full sm:w-52">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TAXONOMIA_TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="taxonomia-nome">Novo item</Label>
            <Input
              id="taxonomia-nome"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && novoNome.trim() && !adding) {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Nome do item"
              maxLength={120}
            />
          </div>
          <Button className="gap-1" onClick={handleAdd} disabled={adding || !novoNome.trim()}>
            <Plus size={14} />
            {adding ? 'Adicionando…' : 'Adicionar'}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Não foi possível carregar os itens.
          </p>
        ) : lista.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum item cadastrado para este tipo.
          </p>
        ) : (
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-28">Origem</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-foreground">{item.nome}</TableCell>
                    <TableCell>
                      {item.builtin ? (
                        <Badge variant="secondary">padrão</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={item.builtin}
                          onClick={() => setDeleteTarget({ id: item.id, nome: item.nome })}
                        >
                          <Trash2 size={13} />
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Confirmação de exclusão de item de taxonomia */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item</AlertDialogTitle>
            <AlertDialogDescription>
              O item "{deleteTarget?.nome}" será removido da taxonomia. Itens padrão não
              podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
            >
              {deleting ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ── Seção 3: alertas de pendências ───────────────────────────────────────────
function AlertasSection() {
  const { data: config, isLoading, isError } = useAtestadoConfig();
  const actions = useAtestadoActions();

  const [dias, setDias] = useState('');
  const [saving, setSaving] = useState(false);
  const [carregado, setCarregado] = useState(false);

  // Pré-preenche o campo com o valor atual assim que o config chega (uma vez).
  if (config && !carregado) {
    setDias(String(config.atestadoAlertDays));
    setCarregado(true);
  }

  async function handleSave() {
    const num = Number.parseInt(dias, 10);
    if (!Number.isFinite(num) || num < 0 || num > 365) return;
    setSaving(true);
    try {
      await actions.updateConfig({ atestadoAlertDays: num });
    } catch {
      // Erro já exibido via toast pelo wrap de useAtestadoActions.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <Bell size={18} className="text-muted-foreground shrink-0" />
        <div>
          <CardTitle>Alertas de pendências</CardTitle>
          <CardDescription>
            Antecedência (dias) para avisar sobre pendências próximas do prazo.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full sm:w-52" />
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Não foi possível carregar a configuração.
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2 sm:max-w-52">
              <Label htmlFor="alerta-dias">Antecedência (dias)</Label>
              <Input
                id="alerta-dias"
                type="number"
                min={0}
                max={365}
                value={dias}
                onChange={(e) => setDias(e.target.value)}
              />
            </div>
            <Button onClick={handleSave} disabled={saving || !dias.trim()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ConfigTab() {
  return (
    <div className="space-y-6">
      <PendenciaStatusSection />
      <TaxonomiaSection />
      <AlertasSection />
    </div>
  );
}
