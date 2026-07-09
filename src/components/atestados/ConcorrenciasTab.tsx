// Aba "Concorrências" do módulo de Gestão de Atestados Técnicos.
// Análise de edital → matriz de exigências × atestados do acervo.
// Consome só os hooks de useAtestados.ts; mutations via useAtestadoActions().

import { useState } from 'react';
import {
  FileSearch,
  Plus,
  Sparkles,
  Loader2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
  useConcorrencias,
  useConcorrencia,
  useAtestadoStatus,
  useAtestadoActions,
} from '@/hooks/useAtestados';
import type {
  Concorrencia,
  ConcorrenciaExigencia,
  ExigenciaMatch,
  ConcorrenciaStatus,
  MatchStatus,
  ExigenciaAcervo,
} from '@/types/atestados';

// ── Rótulos e variantes de badge (só tokens via variants do DS) ──────────────

const CONCORRENCIA_STATUS_LABEL: Record<ConcorrenciaStatus, string> = {
  RASCUNHO: 'Rascunho',
  ANALISANDO: 'Analisando',
  CONCLUIDA: 'Concluída',
  ARQUIVADA: 'Arquivada',
};

const CONCORRENCIA_STATUS_VARIANT: Record<
  ConcorrenciaStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  RASCUNHO: 'outline',
  ANALISANDO: 'secondary',
  CONCLUIDA: 'default',
  ARQUIVADA: 'outline',
};

const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  ATENDE: 'Atende',
  ATENDE_PARCIAL: 'Atende parcial',
  NAO_ATENDE: 'Não atende',
  REVISAR: 'Revisar',
};

const MATCH_STATUS_VARIANT: Record<
  MatchStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  ATENDE: 'default',
  ATENDE_PARCIAL: 'secondary',
  NAO_ATENDE: 'destructive',
  REVISAR: 'outline',
};

const ACERVO_LABEL: Record<ExigenciaAcervo, string> = {
  OPERACIONAL: 'Operacional',
  PROFISSIONAL: 'Profissional',
  INDEFINIDO: 'Indefinido',
};

function formatConfianca(confianca: number | null): string {
  if (confianca == null || Number.isNaN(confianca)) return '—';
  const pct = confianca <= 1 ? confianca * 100 : confianca;
  return `${Math.round(pct)}%`;
}

// ── Diálogo: Nova concorrência ───────────────────────────────────────────────

interface NovaConcorrenciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

function NovaConcorrenciaDialog({ open, onOpenChange, onCreated }: NovaConcorrenciaDialogProps) {
  const actions = useAtestadoActions();
  const [titulo, setTitulo] = useState('');
  const [orgao, setOrgao] = useState('');
  const [editalTexto, setEditalTexto] = useState('');
  const [incluirTerceiros, setIncluirTerceiros] = useState(false);
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitulo('');
    setOrgao('');
    setEditalTexto('');
    setIncluirTerceiros(false);
  }

  async function handleSubmit() {
    if (!titulo.trim()) return;
    setSaving(true);
    try {
      const created = (await actions.createConcorrencia({
        titulo: titulo.trim(),
        orgao: orgao.trim() || null,
        editalTexto: editalTexto.trim() || null,
        incluirTerceiros,
      })) as Concorrencia;
      reset();
      onOpenChange(false);
      if (created?.id) onCreated(created.id);
    } catch {
      // erro já reportado por toast dentro do hook
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova concorrência</DialogTitle>
          <DialogDescription>
            Cadastre o edital para análise. Cole o texto do edital para permitir a extração
            automática das exigências.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="conc-titulo">Título *</Label>
            <Input
              id="conc-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Pregão Eletrônico 042/2026"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="conc-orgao">Órgão</Label>
            <Input
              id="conc-orgao"
              value={orgao}
              onChange={(e) => setOrgao(e.target.value)}
              placeholder="Ex.: Prefeitura Municipal de..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="conc-edital">Texto do edital</Label>
            <Textarea
              id="conc-edital"
              value={editalTexto}
              onChange={(e) => setEditalTexto(e.target.value)}
              placeholder="Cole aqui o trecho de habilitação técnica / qualificação do edital…"
              rows={10}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="conc-terceiros" className="cursor-pointer">
                Incluir acervo de terceiros
              </Label>
              <p className="text-muted-foreground text-xs">
                Considera atestados de parceiros (consórcio, cessão, subcontratação) na matriz.
              </p>
            </div>
            <Switch
              id="conc-terceiros"
              checked={incluirTerceiros}
              onCheckedChange={setIncluirTerceiros}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !titulo.trim()}>
            {saving ? (
              <>
                <Loader2 size={14} className="mr-1 animate-spin" />
                Criando…
              </>
            ) : (
              'Criar concorrência'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Diálogo: Adicionar exigência ─────────────────────────────────────────────

interface AddExigenciaDialogProps {
  concorrenciaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddExigenciaDialog({ concorrenciaId, open, onOpenChange }: AddExigenciaDialogProps) {
  const actions = useAtestadoActions();
  const [descricao, setDescricao] = useState('');
  const [acervo, setAcervo] = useState<ExigenciaAcervo>('INDEFINIDO');
  const [grandeza, setGrandeza] = useState('');
  const [quantMinimo, setQuantMinimo] = useState('');
  const [unidade, setUnidade] = useState('');
  const [permiteSomatorio, setPermiteSomatorio] = useState(false);
  const [saving, setSaving] = useState(false);

  function reset() {
    setDescricao('');
    setAcervo('INDEFINIDO');
    setGrandeza('');
    setQuantMinimo('');
    setUnidade('');
    setPermiteSomatorio(false);
  }

  async function handleSubmit() {
    if (!descricao.trim()) return;
    setSaving(true);
    try {
      const quantNum = quantMinimo.trim() === '' ? null : Number(quantMinimo);
      await actions.addExigencia(concorrenciaId, {
        descricao: descricao.trim(),
        acervo,
        grandeza: grandeza.trim() || null,
        quantMinimo: quantNum != null && !Number.isNaN(quantNum) ? quantNum : null,
        unidade: unidade.trim() || null,
        permiteSomatorio,
      });
      reset();
      onOpenChange(false);
    } catch {
      // erro já reportado por toast dentro do hook
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar exigência</DialogTitle>
          <DialogDescription>
            Inclua manualmente um requisito de qualificação técnica à matriz.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exig-descricao">Descrição *</Label>
            <Textarea
              id="exig-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Execução de rede de esgoto em diâmetro mínimo de 300mm…"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="exig-acervo">Acervo</Label>
              <Select value={acervo} onValueChange={(v) => setAcervo(v as ExigenciaAcervo)}>
                <SelectTrigger id="exig-acervo">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPERACIONAL">Operacional</SelectItem>
                  <SelectItem value="PROFISSIONAL">Profissional</SelectItem>
                  <SelectItem value="INDEFINIDO">Indefinido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exig-grandeza">Grandeza</Label>
              <Input
                id="exig-grandeza"
                value={grandeza}
                onChange={(e) => setGrandeza(e.target.value)}
                placeholder="Ex.: Extensão de rede"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exig-quant">Quantidade mínima</Label>
              <Input
                id="exig-quant"
                type="number"
                value={quantMinimo}
                onChange={(e) => setQuantMinimo(e.target.value)}
                placeholder="Ex.: 1000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exig-unidade">Unidade</Label>
              <Input
                id="exig-unidade"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                placeholder="Ex.: m, m², t"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="exig-somatorio" className="cursor-pointer">
                Permite somatório
              </Label>
              <p className="text-muted-foreground text-xs">
                A quantidade mínima pode ser comprovada pela soma de vários atestados.
              </p>
            </div>
            <Switch
              id="exig-somatorio"
              checked={permiteSomatorio}
              onCheckedChange={setPermiteSomatorio}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !descricao.trim()}>
            {saving ? (
              <>
                <Loader2 size={14} className="mr-1 animate-spin" />
                Adicionando…
              </>
            ) : (
              'Adicionar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Card de um match (atestado que comprova a exigência) ─────────────────────

interface MatchRowProps {
  match: ExigenciaMatch;
}

function MatchRow({ match }: MatchRowProps) {
  const actions = useAtestadoActions();
  const [busy, setBusy] = useState(false);

  async function toggleIncluido(next: boolean) {
    setBusy(true);
    try {
      await actions.updateMatch(match.id, { incluido: next });
    } catch {
      // erro já reportado por toast dentro do hook
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground text-sm font-medium">
            {match.atestado.numero || 'Sem número'}
          </span>
          <span className="text-muted-foreground text-sm">{match.atestado.contratante}</span>
          <Badge variant={MATCH_STATUS_VARIANT[match.status]}>
            {MATCH_STATUS_LABEL[match.status]}
          </Badge>
          {match.atestado.origem === 'TERCEIRO' && (
            <Badge variant="outline">
              <Building2 size={11} className="mr-1" />
              {match.atestado.terceiro?.empresa
                ? `Terceiro: ${match.atestado.terceiro.empresa}`
                : 'Terceiro'}
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>Confiança: {formatConfianca(match.confianca)}</span>
          {match.quantComprovado != null && (
            <span>Comprovado: {String(match.quantComprovado)}</span>
          )}
          {match.rtDesligado && (
            <span className="text-destructive">RT desligado</span>
          )}
        </div>
        {match.alertaTerceiro && (
          <p className="text-destructive mt-1 flex items-start gap-1 text-xs">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            Parceria com uso condicionado ou validade vencida — verifique antes de usar.
          </p>
        )}
        {match.trecho && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs italic">"{match.trecho}"</p>
        )}
      </div>
      <label
        htmlFor={`incluir-${match.id}`}
        className="flex shrink-0 cursor-pointer items-center gap-2 pt-0.5"
      >
        <Checkbox
          id={`incluir-${match.id}`}
          checked={match.incluido}
          disabled={busy}
          onCheckedChange={(checked) => toggleIncluido(checked === true)}
        />
        <span className="text-foreground text-xs">Incluir</span>
      </label>
    </div>
  );
}

// ── Bloco de uma exigência (linha da matriz) ─────────────────────────────────

interface ExigenciaBlockProps {
  exigencia: ConcorrenciaExigencia;
}

function ExigenciaBlock({ exigencia }: ExigenciaBlockProps) {
  const hasMatches = exigencia.matches.length > 0;
  const somatorioAtual = exigencia.somatorioAtual ?? 0;
  const minimo =
    exigencia.quantMinimo == null ? null : Number(exigencia.quantMinimo);
  const somatorioAtingido =
    minimo == null || Number.isNaN(minimo) ? null : somatorioAtual >= minimo;
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-medium">{exigencia.descricao}</p>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span>Acervo: {ACERVO_LABEL[exigencia.acervo]}</span>
            {exigencia.grandeza && <span>Grandeza: {exigencia.grandeza}</span>}
            {exigencia.quantMinimo != null && (
              <span>
                Mínimo: {String(exigencia.quantMinimo)}
                {exigencia.unidade ? ` ${exigencia.unidade}` : ''}
              </span>
            )}
            {exigencia.permiteSomatorio && <span>Permite somatório</span>}
          </div>
          {exigencia.quantMinimo != null && somatorioAtingido != null && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {somatorioAtingido ? (
                <>
                  <span className="text-foreground">
                    Acumulado: {somatorioAtual} / mínimo {String(exigencia.quantMinimo)}
                    {exigencia.unidade ? ` ${exigencia.unidade}` : ''}
                  </span>
                  <Badge variant="default">Atingido</Badge>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Acumulado: {somatorioAtual} / mínimo {String(exigencia.quantMinimo)}
                  {exigencia.unidade ? ` ${exigencia.unidade}` : ''}
                </span>
              )}
            </div>
          )}
          {!exigencia.permiteSomatorio && exigencia.quantMinimo != null && (
            <div className="mt-2">
              <Badge variant="destructive">
                <Ban size={11} className="mr-1" />
                Edital exige comprovação em ÚNICO atestado — somatório vedado
              </Badge>
            </div>
          )}
        </div>
        <Badge variant={MATCH_STATUS_VARIANT[exigencia.statusAgregado]}>
          {MATCH_STATUS_LABEL[exigencia.statusAgregado]}
        </Badge>
      </div>

      {exigencia.alertaRtDesligado && (
        <Alert variant="destructive" className="mt-3">
          <AlertTriangle />
          <AlertTitle>Depende de acervo de RT desligado</AlertTitle>
          <AlertDescription>
            A comprovação desta exigência depende de responsável técnico desligado — confirme a
            manutenção do vínculo do acervo antes de usar.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-3 space-y-2">
        {hasMatches ? (
          exigencia.matches.map((m) => <MatchRow key={m.id} match={m} />)
        ) : (
          <p className="text-destructive rounded-md border border-border bg-background px-3 py-2 text-sm">
            Sem atestado que comprove (lacuna)
          </p>
        )}
      </div>
    </div>
  );
}

// ── Detalhe da concorrência selecionada ──────────────────────────────────────

interface DetalheProps {
  concorrenciaId: string;
  aiEnabled: boolean;
}

function ConcorrenciaDetalhe({ concorrenciaId, aiEnabled }: DetalheProps) {
  const { data: concorrencia, isLoading, isError } = useConcorrencia(concorrenciaId);
  const actions = useAtestadoActions();
  const [analisando, setAnalisando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dossieOk, setDossieOk] = useState(false);

  async function handleAnalisar() {
    setAnalisando(true);
    setDossieOk(false);
    try {
      await actions.analisar(concorrenciaId);
    } catch {
      // erro já reportado por toast dentro do hook
    } finally {
      setAnalisando(false);
    }
  }

  async function handleGerarDossie() {
    setGerando(true);
    try {
      await actions.gerarDossie(concorrenciaId);
      setDossieOk(true);
    } catch {
      setDossieOk(false);
    } finally {
      setGerando(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !concorrencia) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Não foi possível carregar a concorrência</AlertTitle>
        <AlertDescription>
          Ocorreu um erro ao buscar os detalhes. Tente selecionar novamente ou recarregar a página.
        </AlertDescription>
      </Alert>
    );
  }

  const semExigencias = concorrencia.exigencias.length === 0;
  const mostrarErroAnalise =
    !!concorrencia.analiseErro ||
    (concorrencia.status === 'CONCLUIDA' && semExigencias);

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-foreground truncate text-lg font-semibold">{concorrencia.titulo}</h3>
            <Badge variant={CONCORRENCIA_STATUS_VARIANT[concorrencia.status]}>
              {CONCORRENCIA_STATUS_LABEL[concorrencia.status]}
            </Badge>
          </div>
          {concorrencia.orgao && (
            <p className="text-muted-foreground mt-0.5 text-sm">{concorrencia.orgao}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAnalisar} disabled={analisando}>
            {analisando ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <Sparkles size={14} className="mr-1" />
            )}
            {analisando ? 'Analisando…' : 'Analisar'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} className="mr-1" />
            Adicionar exigência
          </Button>
          <Button size="sm" onClick={handleGerarDossie} disabled={gerando}>
            {gerando ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <FileText size={14} className="mr-1" />
            )}
            {gerando ? 'Gerando…' : 'Gerar dossiê'}
          </Button>
        </div>
      </div>

      {/* Erro de análise — nunca silenciado */}
      {mostrarErroAnalise && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Falha na análise do edital</AlertTitle>
          <AlertDescription>
            {concorrencia.analiseErro ||
              'A análise foi concluída, mas nenhuma exigência foi extraída do edital. Revise o texto do edital e execute a análise novamente, ou adicione exigências manualmente.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Aviso quando IA está desligada */}
      {!aiEnabled && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Extração automática indisponível</AlertTitle>
          <AlertDescription>
            A extração automática de exigências exige a IA habilitada, que está desligada neste
            ambiente. Você ainda pode adicionar exigências manualmente à matriz.
          </AlertDescription>
        </Alert>
      )}

      {/* Sucesso do dossiê */}
      {dossieOk && (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Dossiê gerado</AlertTitle>
          <AlertDescription>
            {concorrencia.dossieAttachmentId
              ? 'O dossiê foi gerado e anexado à concorrência.'
              : 'O dossiê foi gerado com sucesso.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Matriz */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-foreground text-sm font-medium">
            Matriz de exigências
            <span className="text-muted-foreground ml-2 font-normal">
              ({concorrencia.exigencias.length})
            </span>
          </h4>
        </div>
        {semExigencias ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-border bg-card px-4 py-10 text-center">
            <FileSearch className="text-muted-foreground mb-3" size={28} />
            <p className="text-foreground text-sm font-medium">Nenhuma exigência na matriz</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Execute "Analisar" para extrair do edital{aiEnabled ? '' : ' (requer IA)'} ou adicione
              exigências manualmente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {concorrencia.exigencias.map((ex) => (
              <ExigenciaBlock key={ex.id} exigencia={ex} />
            ))}
          </div>
        )}
      </div>

      <AddExigenciaDialog
        concorrenciaId={concorrenciaId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export function ConcorrenciasTab() {
  const { data: concorrencias, isLoading, isError } = useConcorrencias();
  const { data: status } = useAtestadoStatus();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);

  const aiEnabled = status?.aiEnabled !== false;
  const lista: Concorrencia[] = Array.isArray(concorrencias) ? concorrencias : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-base font-semibold">Concorrências</h2>
          <p className="text-muted-foreground text-sm">
            Análise de editais e matriz de comprovação por atestado.
          </p>
        </div>
        <Button size="sm" onClick={() => setNovaOpen(true)}>
          <Plus size={14} className="mr-1" />
          Nova concorrência
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Lista de concorrências (conteúdo do canvas, não sidebar do shell) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Editais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : isError ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Erro ao carregar</AlertTitle>
                <AlertDescription>
                  Não foi possível carregar a lista de concorrências. Recarregue a página.
                </AlertDescription>
              </Alert>
            ) : lista.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-2 py-8 text-center">
                <FileSearch className="text-muted-foreground mb-2" size={24} />
                <p className="text-foreground text-sm font-medium">Nenhuma concorrência</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Crie uma concorrência para iniciar a análise de edital.
                </p>
              </div>
            ) : (
              lista.map((conc) => {
                const active = conc.id === selectedId;
                const qtdExigencias = conc._count?.exigencias ?? conc.exigencias?.length ?? 0;
                return (
                  <button
                    key={conc.id}
                    type="button"
                    onClick={() => setSelectedId(conc.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                      active
                        ? 'border-primary bg-muted'
                        : 'border-border bg-background hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-foreground truncate text-sm font-medium">
                        {conc.titulo}
                      </span>
                      <Badge variant={CONCORRENCIA_STATUS_VARIANT[conc.status]}>
                        {CONCORRENCIA_STATUS_LABEL[conc.status]}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
                      <span className="truncate">{conc.orgao || 'Sem órgão'}</span>
                      <span className="shrink-0">
                        {qtdExigencias} exigência{qtdExigencias === 1 ? '' : 's'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Detalhe da concorrência selecionada */}
        <Card>
          <CardContent className="pt-6">
            {selectedId ? (
              <ConcorrenciaDetalhe concorrenciaId={selectedId} aiEnabled={aiEnabled} />
            ) : (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <FileSearch className="text-muted-foreground mb-3" size={32} />
                <p className="text-foreground text-sm font-medium">
                  Selecione uma concorrência
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Escolha um edital na lista ao lado para ver a matriz de exigências e atestados.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <NovaConcorrenciaDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        onCreated={(id) => setSelectedId(id)}
      />
    </div>
  );
}
