// Módulo Gestão de Atestados Técnicos — Aba "Terceiros / Parceiros".
//
// Área SEPARADA dos atestados próprios. Lista empresas parceiras (consórcio,
// subcontratação, cessão de acervo), com controle de "uso livre" e validade da
// parceria. Consome apiClient SÓ via os hooks de useAtestados (useTerceiros /
// useAtestadoActions). Estado de diálogo/formulário é local (useState).

import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Users } from 'lucide-react';
import { useTerceiros, useAtestadoActions } from '@/hooks/useAtestados';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Terceiro, NaturezaParceria } from '@/types/atestados';

const NATUREZA_LABEL: Record<NaturezaParceria, string> = {
  CONSORCIO: 'Consórcio',
  SUBCONTRATACAO: 'Subcontratação',
  CESSAO_DE_ACERVO: 'Cessão de acervo',
};

const NATUREZA_OPCOES: NaturezaParceria[] = ['CONSORCIO', 'SUBCONTRATACAO', 'CESSAO_DE_ACERVO'];

/** Estado do formulário do parceiro (diálogo de criar/editar). */
interface FormState {
  empresa: string;
  contatoNome: string;
  contatoEmail: string;
  contatoTelefone: string;
  validadeParceria: string;
  condicoes: string;
  usoLivre: boolean;
  naturezaParceria: NaturezaParceria;
}

const FORM_VAZIO: FormState = {
  empresa: '',
  contatoNome: '',
  contatoEmail: '',
  contatoTelefone: '',
  validadeParceria: '',
  condicoes: '',
  usoLivre: false,
  naturezaParceria: 'CONSORCIO',
};

/** Converte um Terceiro existente no estado do formulário (para editar). */
function terceiroParaForm(t: Terceiro): FormState {
  return {
    empresa: t.empresa,
    contatoNome: t.contatoNome ?? '',
    contatoEmail: t.contatoEmail ?? '',
    contatoTelefone: t.contatoTelefone ?? '',
    // input date espera yyyy-mm-dd; corta o horário do ISO, se houver.
    validadeParceria: t.validadeParceria ? t.validadeParceria.slice(0, 10) : '',
    condicoes: t.condicoes ?? '',
    usoLivre: t.usoLivre,
    naturezaParceria: t.naturezaParceria ?? 'CONSORCIO',
  };
}

/** Monta o payload de escrita a partir do formulário (campos vazios → null). */
function formParaPayload(f: FormState): Partial<Terceiro> {
  const trim = (v: string) => {
    const s = v.trim();
    return s.length > 0 ? s : null;
  };
  return {
    empresa: f.empresa.trim(),
    contatoNome: trim(f.contatoNome),
    contatoEmail: trim(f.contatoEmail),
    contatoTelefone: trim(f.contatoTelefone),
    validadeParceria: f.validadeParceria ? f.validadeParceria : null,
    condicoes: trim(f.condicoes),
    usoLivre: f.usoLivre,
    naturezaParceria: f.naturezaParceria,
  };
}

/** Formata data ISO em dd/mm/aaaa (pt-BR); "—" quando ausente/ inválida. */
function formatarData(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

/** true quando a validade da parceria já passou. */
function parceriaVencida(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

export function TerceirosTab() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useTerceiros(search);
  const actions = useAtestadoActions();

  // Diálogo de criar/editar. editing === null => criação.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Terceiro | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [saving, setSaving] = useState(false);

  // Exclusão via AlertDialog.
  const [deleteTarget, setDeleteTarget] = useState<Terceiro | null>(null);
  const [deleting, setDeleting] = useState(false);

  const terceiros = (data ?? []) as Terceiro[];

  const abrirNovo = () => {
    setEditing(null);
    setForm(FORM_VAZIO);
    setDialogOpen(true);
  };

  const abrirEdicao = (t: Terceiro) => {
    setEditing(t);
    setForm(terceiroParaForm(t));
    setDialogOpen(true);
  };

  const fecharDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(FORM_VAZIO);
  };

  const salvar = async () => {
    if (!form.empresa.trim()) return;
    setSaving(true);
    try {
      const payload = formParaPayload(form);
      if (editing) {
        await actions.updateTerceiro(editing.id, payload);
      } else {
        await actions.createTerceiro(payload);
      }
      fecharDialog();
    } catch {
      // toast de erro já é emitido dentro de useAtestadoActions; mantém o diálogo aberto.
    } finally {
      setSaving(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await actions.deleteTerceiro(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // erro já sinalizado por toast; mantém o alvo para nova tentativa.
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Nota da área separada */}
      <div className="rounded-md border border-border bg-muted px-4 py-3">
        <p className="text-sm text-foreground">
          Atestados de terceiros ficam em área separada; podem ser incluídos nas buscas e
          análises de concorrência quando você optar.
        </p>
      </div>

      {/* Busca + Novo parceiro */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={16}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar parceiro por empresa ou contato…"
            className="pl-8"
          />
        </div>
        <Button className="gap-1" onClick={abrirNovo}>
          <Plus size={16} />
          Novo parceiro
        </Button>
      </div>

      {/* Tabela / estados */}
      <div className="rounded-md border border-border bg-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <Users className="mb-3 text-muted-foreground" size={32} />
            <p className="font-medium text-foreground">Não foi possível carregar os parceiros</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ocorreu um erro ao buscar os terceiros. Tente novamente em instantes.
            </p>
          </div>
        ) : terceiros.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <Users className="mb-3 text-muted-foreground" size={32} />
            <p className="font-medium text-foreground">
              {search.trim() ? 'Nenhum parceiro encontrado' : 'Nenhum parceiro cadastrado'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search.trim()
                ? 'Ajuste os termos da busca ou cadastre um novo parceiro.'
                : 'Cadastre empresas parceiras para incluir os atestados delas nas análises.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Natureza</TableHead>
                <TableHead>Uso</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Atestados</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terceiros.map((t) => {
                const vencida = parceriaVencida(t.validadeParceria);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-foreground">{t.empresa}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.contatoNome || '—'}
                      {t.contatoEmail && (
                        <span className="block text-xs text-muted-foreground">{t.contatoEmail}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.naturezaParceria ? (
                        <Badge variant="secondary">{NATUREZA_LABEL[t.naturezaParceria]}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.usoLivre ? 'default' : 'outline'}>
                        {t.usoLivre ? 'Uso livre' : 'Condicionado'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.validadeParceria ? (
                        vencida ? (
                          <Badge variant="destructive">
                            Vencida em {formatarData(t.validadeParceria)}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {formatarData(t.validadeParceria)}
                          </span>
                        )
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t._count?.atestados ?? 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => abrirEdicao(t)}
                        >
                          <Pencil size={14} />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setDeleteTarget(t)}
                        >
                          <Trash2 size={14} />
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Diálogo criar/editar parceiro */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) fecharDialog();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar parceiro' : 'Novo parceiro'}</DialogTitle>
            <DialogDescription>
              Empresas parceiras cujos atestados ficam em área separada dos próprios.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="terceiro-empresa">Empresa *</Label>
              <Input
                id="terceiro-empresa"
                value={form.empresa}
                onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))}
                placeholder="Razão social do parceiro"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="terceiro-contato-nome">Nome do contato</Label>
                <Input
                  id="terceiro-contato-nome"
                  value={form.contatoNome}
                  onChange={(e) => setForm((f) => ({ ...f, contatoNome: e.target.value }))}
                  placeholder="Pessoa de contato"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terceiro-contato-email">E-mail do contato</Label>
                <Input
                  id="terceiro-contato-email"
                  type="email"
                  value={form.contatoEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contatoEmail: e.target.value }))}
                  placeholder="contato@empresa.com"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="terceiro-contato-telefone">Telefone do contato</Label>
                <Input
                  id="terceiro-contato-telefone"
                  value={form.contatoTelefone}
                  onChange={(e) => setForm((f) => ({ ...f, contatoTelefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terceiro-validade">Validade da parceria</Label>
                <Input
                  id="terceiro-validade"
                  type="date"
                  value={form.validadeParceria}
                  onChange={(e) => setForm((f) => ({ ...f, validadeParceria: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="terceiro-natureza">Natureza da parceria</Label>
              <Select
                value={form.naturezaParceria}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, naturezaParceria: v as NaturezaParceria }))
                }
              >
                <SelectTrigger id="terceiro-natureza">
                  <SelectValue placeholder="Selecione a natureza" />
                </SelectTrigger>
                <SelectContent>
                  {NATUREZA_OPCOES.map((op) => (
                    <SelectItem key={op} value={op}>
                      {NATUREZA_LABEL[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="terceiro-condicoes">Condições</Label>
              <Textarea
                id="terceiro-condicoes"
                value={form.condicoes}
                onChange={(e) => setForm((f) => ({ ...f, condicoes: e.target.value }))}
                placeholder="Condições e restrições de uso do acervo do parceiro…"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <Label htmlFor="terceiro-uso-livre" className="text-foreground">
                  Uso livre
                </Label>
                <p className="text-xs text-muted-foreground">
                  Se desligado, o uso dos atestados fica condicionado às condições acima.
                </p>
              </div>
              <Switch
                id="terceiro-uso-livre"
                checked={form.usoLivre}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, usoLivre: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={fecharDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={saving || !form.empresa.trim()}>
              {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar parceiro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir parceiro</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Tem certeza que deseja excluir "${deleteTarget.empresa}"? Esta ação não pode ser desfeita.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarExclusao();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground"
            >
              {deleting ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
