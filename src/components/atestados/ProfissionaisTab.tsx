// Gestão de Atestados Técnicos — aba "Profissionais".
//
// Acervo técnico-profissional (RTs/responsáveis técnicos) + geração de currículos.
// Consome só os hooks de useAtestados.ts (useProfissionais, useCurriculos,
// useAtestadoActions) — nunca chama apiClient direto no JSX.
//
// Regra de negócio importante: o acervo de um profissional DESLIGADO NÃO habilita
// mais a empresa em concorrências (só o acervo OPERACIONAL permanece válido). Por
// isso o vínculo DESLIGADO é destacado e há um aviso no topo da aba.

import { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  Download,
  Users,
  Search,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useProfissionais, useCurriculos, useAtestadoActions } from '@/hooks/useAtestados';
import type { Profissional, VinculoProfissional } from '@/types/atestados';

// ── Constantes de domínio ───────────────────────────────────────────────────

const VINCULO_LABEL: Record<VinculoProfissional, string> = {
  SOCIO: 'Sócio',
  CLT: 'CLT',
  CONTRATO: 'Contrato',
  DESLIGADO: 'Desligado',
};

const VINCULO_OPTIONS: VinculoProfissional[] = ['SOCIO', 'CLT', 'CONTRATO', 'DESLIGADO'];

const VINCULO_FILTER_TODOS = 'TODOS';

/** DESLIGADO em destaque (destructive); demais vínculos em secondary. */
function vinculoVariant(v: VinculoProfissional): 'secondary' | 'destructive' {
  return v === 'DESLIGADO' ? 'destructive' : 'secondary';
}

// ── Formulário do diálogo (criar/editar) ────────────────────────────────────

interface FormState {
  nome: string;
  titulo: string;
  conselho: string;
  conselhoNum: string;
  conselhoUF: string;
  disciplinas: string; // input texto separado por vírgula → string[] ao salvar
  segmento: string;
  area: string;
  vinculo: VinculoProfissional;
  email: string;
  telefone: string;
  curriculoResumo: string;
}

const EMPTY_FORM: FormState = {
  nome: '',
  titulo: '',
  conselho: '',
  conselhoNum: '',
  conselhoUF: '',
  disciplinas: '',
  segmento: '',
  area: '',
  vinculo: 'CLT',
  email: '',
  telefone: '',
  curriculoResumo: '',
};

function formFromProfissional(p: Profissional): FormState {
  return {
    nome: p.nome ?? '',
    titulo: p.titulo ?? '',
    conselho: p.conselho ?? '',
    conselhoNum: p.conselhoNum ?? '',
    conselhoUF: p.conselhoUF ?? '',
    disciplinas: (p.disciplinas ?? []).join(', '),
    segmento: p.segmento ?? '',
    area: p.area ?? '',
    vinculo: p.vinculo,
    email: p.email ?? '',
    telefone: p.telefone ?? '',
    curriculoResumo: p.curriculoResumo ?? '',
  };
}

/** Converte o form em payload de escrita (Partial<Profissional>). */
function formToPayload(form: FormState): Partial<Profissional> {
  const trim = (s: string) => {
    const t = s.trim();
    return t.length ? t : null;
  };
  const disciplinas = form.disciplinas
    .split(',')
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
  return {
    nome: form.nome.trim(),
    titulo: trim(form.titulo),
    conselho: trim(form.conselho),
    conselhoNum: trim(form.conselhoNum),
    conselhoUF: trim(form.conselhoUF),
    disciplinas,
    segmento: trim(form.segmento),
    area: trim(form.area),
    vinculo: form.vinculo,
    email: trim(form.email),
    telefone: trim(form.telefone),
    curriculoResumo: trim(form.curriculoResumo),
  };
}

function attachmentDownloadUrl(attachmentId: string): string {
  const base = import.meta.env.VITE_API_URL || '';
  return `${base}/api/v1/attachments/${attachmentId}/download`;
}

// ── Componente ──────────────────────────────────────────────────────────────

export function ProfissionaisTab() {
  const [search, setSearch] = useState('');
  const [vinculoFilter, setVinculoFilter] = useState<string>(VINCULO_FILTER_TODOS);

  // Monta o objeto de filtros só com o que estiver preenchido.
  const filters: Record<string, string> = {};
  if (search.trim()) filters.search = search.trim();
  if (vinculoFilter !== VINCULO_FILTER_TODOS) filters.vinculo = vinculoFilter;

  const profissionaisQuery = useProfissionais(filters);
  // Currículos já gerados — usado para oferecer download do último PDF por profissional.
  const curriculosQuery = useCurriculos();
  const actions = useAtestadoActions();

  // Diálogo de criar/editar (reaproveitado).
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Profissional | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Exclusão.
  const [deleteTarget, setDeleteTarget] = useState<Profissional | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Estado de "gerar currículo" por linha.
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const profissionais: Profissional[] = profissionaisQuery.data ?? [];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(p: Profissional) {
    setEditing(p);
    setForm(formFromProfissional(p));
    setDialogOpen(true);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error('Informe o nome do profissional.');
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (editing) {
        await actions.updateProfissional(editing.id, payload);
      } else {
        await actions.createProfissional(payload);
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch {
      // O hook já exibe toast de erro; mantém o diálogo aberto para nova tentativa.
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateCurriculo(p: Profissional) {
    setGeneratingId(p.id);
    try {
      const curriculo = await actions.createCurriculo({ profissionalId: p.id });
      const res = await actions.gerarCurriculoPdf(curriculo.id);
      if (res?.attachmentId) {
        const url = attachmentDownloadUrl(res.attachmentId);
        toast.success('Currículo gerado.', {
          action: {
            label: 'Baixar PDF',
            onClick: () => window.open(url, '_blank', 'noopener,noreferrer'),
          },
        });
      } else {
        toast.success('Currículo gerado.');
      }
    } catch {
      // Erro já sinalizado via toast pelos actions.
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await actions.deleteProfissional(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Erro já sinalizado via toast pelos actions.
    } finally {
      setDeleting(false);
    }
  }

  /** URL de download do último currículo gerado (com attachment) do profissional. */
  function lastCurriculoUrl(profissionalId: string): string | null {
    const list = curriculosQuery.data ?? [];
    const match = list.filter((c) => c.profissionalId === profissionalId && c.attachmentId);
    if (match.length === 0) return null;
    const att = match[match.length - 1].attachmentId;
    return att ? attachmentDownloadUrl(att) : null;
  }

  const isLoading = profissionaisQuery.isLoading;
  const isError = profissionaisQuery.isError;

  return (
    <div className="space-y-4">
      {/* Aviso de regra de negócio (RT desligado) */}
      <div className="flex items-start gap-3 rounded-md border border-border bg-muted p-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-muted-foreground" size={18} />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Atenção:</span> o acervo de um
          profissional <span className="font-medium text-foreground">DESLIGADO</span> não habilita
          mais a empresa em concorrências — apenas o acervo operacional (da própria empresa)
          permanece válido. Mantenha o vínculo atualizado para evitar apontar responsáveis técnicos
          que já não integram o quadro.
        </p>
      </div>

      {/* Filtros + ação de criar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, conselho, disciplina…"
              className="pl-8"
              aria-label="Buscar profissional"
            />
          </div>
          <Select value={vinculoFilter} onValueChange={setVinculoFilter}>
            <SelectTrigger className="sm:w-48" aria-label="Filtrar por vínculo">
              <SelectValue placeholder="Vínculo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={VINCULO_FILTER_TODOS}>Todos os vínculos</SelectItem>
              {VINCULO_OPTIONS.map((v) => (
                <SelectItem key={v} value={v}>
                  {VINCULO_LABEL[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus size={16} />
          Novo profissional
        </Button>
      </div>

      {/* Tabela */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <AlertTriangle className="text-destructive" size={28} />
            <p className="font-medium text-foreground">Não foi possível carregar os profissionais</p>
            <p className="text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => profissionaisQuery.refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : profissionais.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <Users className="text-muted-foreground" size={32} />
            <p className="font-medium text-foreground">Nenhum profissional encontrado</p>
            <p className="text-sm text-muted-foreground">
              {Object.keys(filters).length > 0
                ? 'Nenhum resultado para os filtros aplicados. Ajuste a busca ou o vínculo.'
                : 'Cadastre responsáveis técnicos para compor o acervo técnico-profissional.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Conselho</TableHead>
                  <TableHead>Vínculo</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profissionais.map((p) => {
                  const conselhoLabel = [p.conselho, p.conselhoUF].filter(Boolean).join(' / ');
                  const curriculoUrl = lastCurriculoUrl(p.id);
                  const isGenerating = generatingId === p.id;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-foreground">{p.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{p.titulo || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {conselhoLabel || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={vinculoVariant(p.vinculo)}>
                          {VINCULO_LABEL[p.vinculo]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.segmento || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          {curriculoUrl && (
                            <a
                              href={curriculoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex"
                              aria-label={`Baixar último currículo de ${p.nome}`}
                            >
                              <Button variant="outline" size="sm" className="gap-1" asChild={false}>
                                <span className="inline-flex items-center gap-1">
                                  <Download size={14} />
                                  Baixar
                                </span>
                              </Button>
                            </a>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={isGenerating}
                            onClick={() => handleGenerateCurriculo(p)}
                          >
                            {isGenerating ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <FileText size={14} />
                            )}
                            Gerar currículo
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => openEdit(p)}
                          >
                            <Pencil size={14} />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-destructive"
                            onClick={() => setDeleteTarget(p)}
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
          </div>
        )}
      </Card>

      {/* Diálogo criar / editar */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar profissional' : 'Novo profissional'}</DialogTitle>
            <DialogDescription>
              Dados do responsável técnico para o acervo técnico-profissional.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-nome">Nome *</Label>
              <Input
                id="prof-nome"
                value={form.nome}
                onChange={(e) => updateField('nome', e.target.value)}
                placeholder="Nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-titulo">Título</Label>
              <Input
                id="prof-titulo"
                value={form.titulo}
                onChange={(e) => updateField('titulo', e.target.value)}
                placeholder="Ex.: Engenheiro Civil"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-vinculo">Vínculo</Label>
              <Select
                value={form.vinculo}
                onValueChange={(v) => updateField('vinculo', v as VinculoProfissional)}
              >
                <SelectTrigger id="prof-vinculo">
                  <SelectValue placeholder="Selecione o vínculo" />
                </SelectTrigger>
                <SelectContent>
                  {VINCULO_OPTIONS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {VINCULO_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-conselho">Conselho</Label>
              <Input
                id="prof-conselho"
                value={form.conselho}
                onChange={(e) => updateField('conselho', e.target.value)}
                placeholder="Ex.: CREA"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prof-conselho-num">Nº do conselho</Label>
                <Input
                  id="prof-conselho-num"
                  value={form.conselhoNum}
                  onChange={(e) => updateField('conselhoNum', e.target.value)}
                  placeholder="Ex.: 123456"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prof-conselho-uf">UF</Label>
                <Input
                  id="prof-conselho-uf"
                  value={form.conselhoUF}
                  onChange={(e) => updateField('conselhoUF', e.target.value)}
                  placeholder="Ex.: SP"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-disciplinas">Disciplinas</Label>
              <Input
                id="prof-disciplinas"
                value={form.disciplinas}
                onChange={(e) => updateField('disciplinas', e.target.value)}
                placeholder="Separadas por vírgula (ex.: Estrutural, Fundações)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-segmento">Segmento</Label>
              <Input
                id="prof-segmento"
                value={form.segmento}
                onChange={(e) => updateField('segmento', e.target.value)}
                placeholder="Ex.: Infraestrutura"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-area">Área</Label>
              <Input
                id="prof-area"
                value={form.area}
                onChange={(e) => updateField('area', e.target.value)}
                placeholder="Ex.: Rodovias"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-email">E-mail</Label>
              <Input
                id="prof-email"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-telefone">Telefone</Label>
              <Input
                id="prof-telefone"
                value={form.telefone}
                onChange={(e) => updateField('telefone', e.target.value)}
                placeholder="(11) 90000-0000"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="prof-resumo">Resumo do currículo</Label>
              <Textarea
                id="prof-resumo"
                value={form.curriculoResumo}
                onChange={(e) => updateField('curriculoResumo', e.target.value)}
                placeholder="Breve resumo da experiência do profissional…"
                rows={4}
              />
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
            <Button onClick={handleSave} disabled={saving || !form.nome.trim()}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Salvando…
                </span>
              ) : editing ? (
                'Salvar alterações'
              ) : (
                'Criar profissional'
              )}
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
            <AlertDialogTitle>Excluir profissional</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Tem certeza que deseja excluir "${deleteTarget.nome}"? Esta ação não pode ser desfeita.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {deleting ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
