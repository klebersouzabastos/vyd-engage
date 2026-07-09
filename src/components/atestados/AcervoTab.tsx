// Aba "Acervo" do módulo de Gestão de Atestados Técnicos — atestados próprios.
// Filtros + importação de planilha + criação manual + detalhe lateral (Sheet).
// Todas as chamadas de API passam pelos hooks de useAtestados.ts.

import { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Upload,
  Search,
  FileWarning,
  RefreshCw,
  Trash2,
  FileUp,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { toast } from 'sonner';
import { useAtestados, useAtestadoActions } from '@/hooks/useAtestados';
import type {
  Atestado,
  AcervoTipo,
  AtestadoDocStatus,
  AtestadoInput,
  AtestadoSuggestion,
  ImportReport,
} from '@/types/atestados';

// ── Rótulos e opções (pt-BR) ────────────────────────────────────────────────
const ACERVO_TIPO_LABEL: Record<AcervoTipo, string> = {
  OPERACIONAL: 'Operacional',
  PROFISSIONAL: 'Profissional',
  AMBOS: 'Ambos',
};

const DOC_STATUS_LABEL: Record<AtestadoDocStatus, string> = {
  SEM_DOCUMENTO: 'Sem documento',
  PENDENTE_EXTRACAO: 'Pendente de extração',
  OK: 'OK',
  ILEGIVEL: 'Ilegível',
};

const ACERVO_TIPO_OPCOES: AcervoTipo[] = ['OPERACIONAL', 'PROFISSIONAL', 'AMBOS'];
const DOC_STATUS_OPCOES: AtestadoDocStatus[] = [
  'OK',
  'PENDENTE_EXTRACAO',
  'ILEGIVEL',
  'SEM_DOCUMENTO',
];

/** docStatus que exige atenção → badge destrutivo + alerta no detalhe. */
function docStatusPrecisaAtencao(status: AtestadoDocStatus): boolean {
  return status === 'ILEGIVEL' || status === 'PENDENTE_EXTRACAO';
}

function docStatusVariant(
  status: AtestadoDocStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (docStatusPrecisaAtencao(status)) return 'destructive';
  if (status === 'OK') return 'default';
  return 'outline';
}

// ── Estado de formulário (criação manual) ───────────────────────────────────
interface ResponsavelLinha {
  nome: string;
  funcao: string;
  categoria: string;
}
interface QuantitativoLinha {
  grandeza: string;
  valor: string;
  unidade: string;
}
interface NovoAtestadoForm {
  numero: string;
  contratante: string;
  objeto: string;
  contrato: string;
  periodoTexto: string;
  acervoTipo: AcervoTipo;
  artNumero: string;
  catNumero: string;
  conselho: string;
  conselhoUF: string;
  valorContrato: string;
  responsaveis: ResponsavelLinha[];
  quantitativos: QuantitativoLinha[];
}

const FORM_INICIAL: NovoAtestadoForm = {
  numero: '',
  contratante: '',
  objeto: '',
  contrato: '',
  periodoTexto: '',
  acervoTipo: 'OPERACIONAL',
  artNumero: '',
  catNumero: '',
  conselho: '',
  conselhoUF: '',
  valorContrato: '',
  responsaveis: [],
  quantitativos: [],
};

/** Converte uma AtestadoSuggestion (IA) no estado do formulário "Novo atestado". */
function suggestionToForm(s: AtestadoSuggestion): NovoAtestadoForm {
  // A IA sugere responsáveis com múltiplas funções; o form usa uma linha por função.
  const responsaveis: ResponsavelLinha[] = [];
  for (const r of s.responsaveis ?? []) {
    const funcoes = r.funcoes ?? [];
    if (funcoes.length === 0) {
      responsaveis.push({ nome: r.nome ?? '', funcao: '', categoria: '' });
      continue;
    }
    for (const f of funcoes) {
      responsaveis.push({
        nome: r.nome ?? '',
        funcao: f.funcao ?? '',
        categoria: f.categoria ?? '',
      });
    }
  }

  const quantitativos: QuantitativoLinha[] = (s.quantitativos ?? []).map((q) => ({
    grandeza: q.grandeza ?? '',
    valor: q.valor != null ? String(q.valor) : '',
    unidade: q.unidade ?? '',
  }));

  return {
    ...FORM_INICIAL,
    contratante: s.contratante ?? '',
    objeto: s.objeto ?? '',
    contrato: s.contrato ?? '',
    artNumero: s.artNumero ?? '',
    catNumero: s.catNumero ?? '',
    conselho: s.conselho ?? '',
    conselhoUF: s.conselhoUF ?? '',
    valorContrato: s.valorContrato != null ? String(s.valorContrato) : '',
    responsaveis,
    quantitativos,
  };
}

export function AcervoTab() {
  const actions = useAtestadoActions();

  // Filtros (mantidos em estado; só chaves definidas viram query).
  const [search, setSearch] = useState('');
  const [acervoTipo, setAcervoTipo] = useState<string>('__todos');
  const [docStatus, setDocStatus] = useState<string>('__todos');

  // Diálogos e detalhe.
  const [novoOpen, setNovoOpen] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<Atestado | null>(null);
  const [excluirOpen, setExcluirOpen] = useState(false);

  // Refs de inputs de arquivo (escondidos).
  const importInputRef = useRef<HTMLInputElement>(null);
  const documentoInputRef = useRef<HTMLInputElement>(null);
  const iaInputRef = useRef<HTMLInputElement>(null);

  // Estados de ocupação.
  const [importando, setImportando] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviandoDoc, setEnviandoDoc] = useState(false);
  const [reindexando, setReindexando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [extractionMsg, setExtractionMsg] = useState<string | null>(null);
  // Aviso exibido dentro do dialog "Novo atestado" quando a IA não pôde sugerir.
  const [iaAviso, setIaAviso] = useState<string | null>(null);

  const [form, setForm] = useState<NovoAtestadoForm>(FORM_INICIAL);

  // Monta o objeto de filtros: sempre includeTerceiros='false' (só próprios).
  const filters = useMemo<Record<string, string>>(() => {
    const f: Record<string, string> = { includeTerceiros: 'false' };
    const s = search.trim();
    if (s) f.search = s;
    if (acervoTipo !== '__todos') f.acervoTipo = acervoTipo;
    if (docStatus !== '__todos') f.docStatus = docStatus;
    return f;
  }, [search, acervoTipo, docStatus]);

  const { data: atestados, isLoading, isError } = useAtestados(filters);

  // ── Importação de planilha ────────────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reimportar o mesmo arquivo
    if (!file) return;
    setImportando(true);
    try {
      const report = await actions.importAtestados(file);
      setImportReport(report);
      setImportOpen(true);
    } catch {
      // erro já sinalizado via toast no hook
    } finally {
      setImportando(false);
    }
  };

  // ── Cadastro assistido por IA (a partir de PDF/imagem) ────────────────────
  const handleIaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reprocessar o mesmo arquivo
    if (!file) return;
    setSugerindo(true);
    setIaAviso(null);
    try {
      const res = await actions.sugerirAtestado(file);
      const okExtracao = res.extraction?.status === 'OK';
      if (res.suggestion && okExtracao) {
        // Pré-preenche o form para o usuário REVISAR antes de criar (nunca grava sozinho).
        setForm(suggestionToForm(res.suggestion));
        setIaAviso(null);
      } else {
        // IA desligada, extração falhou ou sem sugestão: abre o form vazio p/ preenchimento manual.
        setForm(FORM_INICIAL);
        const msg =
          res.extraction?.message ??
          'Não foi possível sugerir os dados a partir do arquivo. Preencha o atestado manualmente.';
        setIaAviso(msg);
        toast.warning(msg);
      }
      setNovoOpen(true);
    } catch {
      // erro já sinalizado via toast no hook
    } finally {
      setSugerindo(false);
    }
  };

  // ── Criação manual ────────────────────────────────────────────────────────
  const setFormField = <K extends keyof NovoAtestadoForm>(
    key: K,
    value: NovoAtestadoForm[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const addResponsavel = () =>
    setForm((prev) => ({
      ...prev,
      responsaveis: [...prev.responsaveis, { nome: '', funcao: '', categoria: '' }],
    }));
  const updateResponsavel = (idx: number, patch: Partial<ResponsavelLinha>) =>
    setForm((prev) => ({
      ...prev,
      responsaveis: prev.responsaveis.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  const removeResponsavel = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      responsaveis: prev.responsaveis.filter((_, i) => i !== idx),
    }));

  const addQuantitativo = () =>
    setForm((prev) => ({
      ...prev,
      quantitativos: [...prev.quantitativos, { grandeza: '', valor: '', unidade: '' }],
    }));
  const updateQuantitativo = (idx: number, patch: Partial<QuantitativoLinha>) =>
    setForm((prev) => ({
      ...prev,
      quantitativos: prev.quantitativos.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    }));
  const removeQuantitativo = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      quantitativos: prev.quantitativos.filter((_, i) => i !== idx),
    }));

  const podeSalvar =
    form.numero.trim().length > 0 &&
    form.contratante.trim().length > 0 &&
    form.objeto.trim().length > 0;

  const handleCriar = async () => {
    if (!podeSalvar) return;

    // Agrupa funções por nome de responsável.
    const porNome = new Map<string, Array<{ funcao: string; categoria?: string | null }>>();
    for (const r of form.responsaveis) {
      const nome = r.nome.trim();
      const funcao = r.funcao.trim();
      if (!nome || !funcao) continue;
      const funcoes = porNome.get(nome) ?? [];
      funcoes.push({ funcao, categoria: r.categoria.trim() || null });
      porNome.set(nome, funcoes);
    }
    const responsaveis = Array.from(porNome.entries()).map(([nome, funcoes]) => ({
      nome,
      funcoes,
    }));

    const quantitativos = form.quantitativos
      .filter((q) => q.grandeza.trim() && q.unidade.trim())
      .map((q) => ({
        grandeza: q.grandeza.trim(),
        valor: Number(q.valor) || 0,
        unidade: q.unidade.trim(),
      }));

    const valorContratoNum = form.valorContrato.trim() ? Number(form.valorContrato) : NaN;

    const input: AtestadoInput = {
      numero: form.numero.trim(),
      contratante: form.contratante.trim(),
      objeto: form.objeto.trim(),
      origem: 'PROPRIO',
      acervoTipo: form.acervoTipo,
      contrato: form.contrato.trim() || null,
      periodoTexto: form.periodoTexto.trim() || null,
      artNumero: form.artNumero.trim() || null,
      catNumero: form.catNumero.trim() || null,
      conselho: form.conselho.trim() || null,
      conselhoUF: form.conselhoUF.trim() || null,
      ...(Number.isFinite(valorContratoNum) ? { valorContrato: valorContratoNum } : {}),
      ...(responsaveis.length > 0 ? { responsaveis } : {}),
      ...(quantitativos.length > 0 ? { quantitativos } : {}),
    };

    setSalvando(true);
    try {
      await actions.createAtestado(input);
      setNovoOpen(false);
      setForm(FORM_INICIAL);
      setIaAviso(null);
    } catch {
      // toast pelo hook
    } finally {
      setSalvando(false);
    }
  };

  // ── Ações no detalhe ──────────────────────────────────────────────────────
  const abrirDetalhe = (a: Atestado) => {
    setExtractionMsg(null);
    setDetalhe(a);
  };

  const handleUploadDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !detalhe) return;
    setEnviandoDoc(true);
    setExtractionMsg(null);
    try {
      const res = await actions.uploadDocumento(detalhe.id, file);
      setDetalhe(res.atestado);
      setExtractionMsg(res.extraction?.message ?? null);
    } catch {
      // toast pelo hook
    } finally {
      setEnviandoDoc(false);
    }
  };

  const handleReindex = async () => {
    if (!detalhe) return;
    setReindexando(true);
    try {
      await actions.reindexAtestado(detalhe.id);
    } catch {
      // toast pelo hook
    } finally {
      setReindexando(false);
    }
  };

  const handleExcluir = async () => {
    if (!detalhe) return;
    setExcluindo(true);
    try {
      await actions.deleteAtestado(detalhe.id);
      setExcluirOpen(false);
      setDetalhe(null);
    } catch {
      // toast pelo hook
    } finally {
      setExcluindo(false);
    }
  };

  const lista = atestados ?? [];

  return (
    <div className="space-y-4">
      {/* Inputs de arquivo escondidos */}
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={handleImportFile}
      />
      <input
        ref={iaInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={handleIaFile}
      />
      <input
        ref={documentoInputRef}
        type="file"
        className="hidden"
        onChange={handleUploadDocumento}
      />

      {/* ── Barra de filtros + ações ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="acervo-busca">Buscar</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <Input
                id="acervo-busca"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Número, contratante ou objeto…"
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Tipo de acervo</Label>
            <Select value={acervoTipo} onValueChange={setAcervoTipo}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos">Todos</SelectItem>
                {ACERVO_TIPO_OPCOES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ACERVO_TIPO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Documento</Label>
            <Select value={docStatus} onValueChange={setDocStatus}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos">Todos</SelectItem>
                {DOC_STATUS_OPCOES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {DOC_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={importando}
            onClick={() => importInputRef.current?.click()}
          >
            {importando ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            Importar planilha
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={sugerindo}
            onClick={() => iaInputRef.current?.click()}
          >
            {sugerindo ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            Cadastrar via IA (PDF)
          </Button>
          <Button className="gap-1.5" onClick={() => setNovoOpen(true)}>
            <Plus size={16} />
            Novo atestado
          </Button>
        </div>
      </div>

      {/* ── Tabela / estados ── */}
      <div className="rounded-md border border-border bg-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <FileWarning className="mb-3 text-destructive" size={32} />
            <p className="font-medium text-foreground">Erro ao carregar o acervo</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Não foi possível buscar os atestados. Tente novamente.
            </p>
          </div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <FileUp className="mb-3 text-muted-foreground" size={32} />
            <p className="font-medium text-foreground">Nenhum atestado encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste os filtros, importe uma planilha ou cadastre um novo atestado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Contratante</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="text-right">Responsáveis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => abrirDetalhe(a)}
                  >
                    <TableCell className="font-medium text-foreground">{a.numero}</TableCell>
                    <TableCell className="text-foreground">{a.contratante}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {a.objeto}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ACERVO_TIPO_LABEL[a.acervoTipo]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={docStatusVariant(a.docStatus)}>
                        {DOC_STATUS_LABEL[a.docStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {a.responsaveis.length}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Dialog: relatório de importação ── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importação concluída</DialogTitle>
            <DialogDescription>
              Resultado do processamento da planilha enviada.
            </DialogDescription>
          </DialogHeader>
          {importReport ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-semibold text-foreground">
                    {importReport.created}
                  </p>
                  <p className="text-xs text-muted-foreground">Criados</p>
                </div>
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-semibold text-foreground">
                    {importReport.skipped}
                  </p>
                  <p className="text-xs text-muted-foreground">Ignorados</p>
                </div>
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-semibold text-foreground">
                    {importReport.errors.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>
              {importReport.errors.length > 0 ? (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {importReport.errors.map((err, i) => (
                    <div key={`${err.numero}-${i}`} className="text-sm">
                      <span className="font-medium text-foreground">{err.numero || '—'}:</span>{' '}
                      <span className="text-destructive">{err.motivo}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum erro registrado nesta importação.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados de importação.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: novo atestado ── */}
      <Dialog
        open={novoOpen}
        onOpenChange={(open) => {
          setNovoOpen(open);
          if (!open) {
            setForm(FORM_INICIAL);
            setIaAviso(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo atestado</DialogTitle>
            <DialogDescription>
              Cadastre manualmente um atestado do acervo próprio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {iaAviso && (
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted px-3 py-2">
                <FileWarning size={16} className="mt-0.5 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{iaAviso}</p>
              </div>
            )}

            {/* Campos base */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="novo-numero">Número *</Label>
                <Input
                  id="novo-numero"
                  value={form.numero}
                  onChange={(e) => setFormField('numero', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="novo-contratante">Contratante *</Label>
                <Input
                  id="novo-contratante"
                  value={form.contratante}
                  onChange={(e) => setFormField('contratante', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="novo-objeto">Objeto *</Label>
              <Textarea
                id="novo-objeto"
                rows={3}
                value={form.objeto}
                onChange={(e) => setFormField('objeto', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="novo-contrato">Contrato</Label>
                <Input
                  id="novo-contrato"
                  value={form.contrato}
                  onChange={(e) => setFormField('contrato', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="novo-periodo">Período</Label>
                <Input
                  id="novo-periodo"
                  value={form.periodoTexto}
                  onChange={(e) => setFormField('periodoTexto', e.target.value)}
                  placeholder="Ex.: jan/2022 a dez/2023"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Tipo de acervo</Label>
                <Select
                  value={form.acervoTipo}
                  onValueChange={(v) => setFormField('acervoTipo', v as AcervoTipo)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACERVO_TIPO_OPCOES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ACERVO_TIPO_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="novo-art">ART</Label>
                  <Input
                    id="novo-art"
                    value={form.artNumero}
                    onChange={(e) => setFormField('artNumero', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="novo-cat">CAT</Label>
                  <Input
                    id="novo-cat"
                    value={form.catNumero}
                    onChange={(e) => setFormField('catNumero', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="novo-conselho">Conselho</Label>
                <Input
                  id="novo-conselho"
                  value={form.conselho}
                  onChange={(e) => setFormField('conselho', e.target.value)}
                  placeholder="Ex.: CREA"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="novo-conselho-uf">UF do conselho</Label>
                <Input
                  id="novo-conselho-uf"
                  value={form.conselhoUF}
                  onChange={(e) => setFormField('conselhoUF', e.target.value)}
                  placeholder="Ex.: SP"
                />
              </div>
            </div>

            {/* Responsáveis */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Responsáveis técnicos</Label>
                <Button variant="outline" size="sm" className="gap-1" onClick={addResponsavel}>
                  <Plus size={14} />
                  Adicionar
                </Button>
              </div>
              {form.responsaveis.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum responsável adicionado.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.responsaveis.map((r, idx) => (
                    <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={r.nome}
                        onChange={(e) => updateResponsavel(idx, { nome: e.target.value })}
                        placeholder="Nome"
                        className="flex-1"
                      />
                      <Input
                        value={r.funcao}
                        onChange={(e) => updateResponsavel(idx, { funcao: e.target.value })}
                        placeholder="Função"
                        className="flex-1"
                      />
                      <Input
                        value={r.categoria}
                        onChange={(e) => updateResponsavel(idx, { categoria: e.target.value })}
                        placeholder="Categoria"
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Remover responsável"
                        onClick={() => removeResponsavel(idx)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quantitativos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Quantitativos</Label>
                <Button variant="outline" size="sm" className="gap-1" onClick={addQuantitativo}>
                  <Plus size={14} />
                  Adicionar
                </Button>
              </div>
              {form.quantitativos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum quantitativo adicionado.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.quantitativos.map((q, idx) => (
                    <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={q.grandeza}
                        onChange={(e) => updateQuantitativo(idx, { grandeza: e.target.value })}
                        placeholder="Grandeza"
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={q.valor}
                        onChange={(e) => updateQuantitativo(idx, { valor: e.target.value })}
                        placeholder="Valor"
                        className="flex-1"
                      />
                      <Input
                        value={q.unidade}
                        onChange={(e) => updateQuantitativo(idx, { unidade: e.target.value })}
                        placeholder="Unidade"
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Remover quantitativo"
                        onClick={() => removeQuantitativo(idx)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNovoOpen(false);
                setForm(FORM_INICIAL);
                setIaAviso(null);
              }}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button onClick={handleCriar} disabled={!podeSalvar || salvando}>
              {salvando ? 'Salvando…' : 'Salvar atestado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Sheet: detalhe do atestado ── */}
      <Sheet
        open={!!detalhe}
        onOpenChange={(open) => {
          if (!open) {
            setDetalhe(null);
            setExtractionMsg(null);
          }
        }}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          {detalhe && (
            <>
              <SheetHeader>
                <SheetTitle>{detalhe.numero}</SheetTitle>
                <SheetDescription>{detalhe.contratante}</SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-4 pb-6">
                {docStatusPrecisaAtencao(detalhe.docStatus) && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive px-3 py-2 text-destructive-foreground">
                    <FileWarning size={16} className="mt-0.5 shrink-0" />
                    <p className="text-sm">
                      O documento deste atestado precisa de atenção (
                      {DOC_STATUS_LABEL[detalhe.docStatus]}). Envie um documento legível para
                      concluir a extração.
                    </p>
                  </div>
                )}

                {extractionMsg && (
                  <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                    {extractionMsg}
                  </div>
                )}

                {/* Metadados */}
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{ACERVO_TIPO_LABEL[detalhe.acervoTipo]}</Badge>
                    <Badge variant={docStatusVariant(detalhe.docStatus)}>
                      {DOC_STATUS_LABEL[detalhe.docStatus]}
                    </Badge>
                  </div>

                  <DetailRow label="Objeto" value={detalhe.objeto} />
                  <DetailRow label="Contrato" value={detalhe.contrato} />
                  <DetailRow label="Período" value={detalhe.periodoTexto} />
                  <DetailRow label="ART" value={detalhe.artNumero} />
                  <DetailRow label="CAT" value={detalhe.catNumero} />
                  <DetailRow label="Conselho" value={detalhe.conselho} />
                  <DetailRow label="UF do conselho" value={detalhe.conselhoUF} />
                </div>

                {/* Responsáveis */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Responsáveis técnicos</p>
                  {detalhe.responsaveis.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum responsável cadastrado.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {detalhe.responsaveis.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-md border border-border bg-card p-3"
                        >
                          <p className="font-medium text-foreground">
                            {r.profissional.nome}
                          </p>
                          {r.funcoes.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sem funções.</p>
                          ) : (
                            <ul className="mt-1 space-y-0.5">
                              {r.funcoes.map((f) => (
                                <li key={f.id} className="text-sm text-foreground">
                                  {f.funcao}
                                  {f.categoria ? (
                                    <span className="text-muted-foreground">
                                      {' '}
                                      — {f.categoria}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quantitativos */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Quantitativos</p>
                  {detalhe.quantitativos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum quantitativo cadastrado.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Grandeza</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Unidade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detalhe.quantitativos.map((q) => (
                            <TableRow key={q.id}>
                              <TableCell className="text-foreground">{q.grandeza}</TableCell>
                              <TableCell className="text-right text-foreground">
                                {q.valor}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {q.unidade}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    disabled={enviandoDoc}
                    onClick={() => documentoInputRef.current?.click()}
                  >
                    {enviandoDoc ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <FileUp size={16} />
                    )}
                    Enviar documento
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    disabled={reindexando}
                    onClick={handleReindex}
                  >
                    {reindexando ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Reindexar
                  </Button>
                  <Button
                    variant="destructive"
                    className="justify-start gap-2"
                    onClick={() => setExcluirOpen(true)}
                  >
                    <Trash2 size={16} />
                    Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── AlertDialog: confirmação de exclusão ── */}
      <AlertDialog open={excluirOpen} onOpenChange={setExcluirOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atestado</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e removerá o atestado
              {detalhe ? ` "${detalhe.numero}"` : ''} do acervo. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              disabled={excluindo}
              onClick={(e) => {
                e.preventDefault();
                handleExcluir();
              }}
            >
              {excluindo ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Linha rótulo/valor do detalhe — oculta valores vazios com um traço. */
function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="col-span-2 text-sm text-foreground">
        {value && value.trim() ? value : '—'}
      </span>
    </div>
  );
}
