// Aba "Pendências" do módulo de Gestão de Atestados Técnicos.
//
// Rastreia todo atestado que ainda não entrou no acervo (para "não esquecer
// nenhum"): agrupa as pendências por etapa (PendenciaStatus, ordenadas por
// `ordem`), sinaliza atrasadas (prazo < hoje e etapa não-final), permite mover
// de etapa, converter em atestado do acervo e excluir. Consome exclusivamente
// os hooks de useAtestados.ts — nunca chama apiClient direto.

import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Plus, ArrowRightLeft, Trash2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { usePendencias, usePendenciaStatus, useAtestadoActions } from '@/hooks/useAtestados';
import type { Pendencia, PendenciaStatus, AtestadoInput } from '@/types/atestados';

const ORIGEM_LABEL: Record<Pendencia['origem'], string> = {
  DEAL: 'Negócio',
  CONTRATO: 'Contrato',
  MANUAL: 'Manual',
};

/** Uma pendência está atrasada se tem prazo no passado e a etapa não é final. */
function isAtrasada(p: Pendencia): boolean {
  if (!p.prazo || p.status?.isFinal) return false;
  const prazo = new Date(p.prazo);
  if (Number.isNaN(prazo.getTime())) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return prazo < hoje;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function PendenciasTab() {
  const [statusFilter, setStatusFilter] = useState<string>('__all__');
  const [soAtrasadas, setSoAtrasadas] = useState(false);

  const filters = useMemo<Record<string, string>>(() => {
    const f: Record<string, string> = {};
    if (statusFilter !== '__all__') f.statusId = statusFilter;
    if (soAtrasadas) f.atrasadas = 'true';
    return f;
  }, [statusFilter, soAtrasadas]);

  const pendenciasQuery = usePendencias(filters);
  const statusQuery = usePendenciaStatus();
  const actions = useAtestadoActions();

  const pendencias = useMemo(() => pendenciasQuery.data ?? [], [pendenciasQuery.data]);
  const etapas = useMemo<PendenciaStatus[]>(
    () => [...(statusQuery.data ?? [])].sort((a, b) => a.ordem - b.ordem),
    [statusQuery.data]
  );

  const total = pendencias.length;
  const atrasadasCount = useMemo(() => pendencias.filter(isAtrasada).length, [pendencias]);

  // Agrupa por etapa (statusId) preservando a ordem das etapas.
  const grupos = useMemo(() => {
    const byStatus = new Map<string, Pendencia[]>();
    for (const p of pendencias) {
      const arr = byStatus.get(p.statusId) ?? [];
      arr.push(p);
      byStatus.set(p.statusId, arr);
    }
    return etapas.map((etapa) => ({ etapa, itens: byStatus.get(etapa.id) ?? [] }));
  }, [pendencias, etapas]);

  // ── Diálogo: nova pendência ────────────────────────────────────────────────
  const [novaOpen, setNovaOpen] = useState(false);
  const [novaTitulo, setNovaTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaPrazo, setNovaPrazo] = useState('');
  const [novaStatusId, setNovaStatusId] = useState('');
  const [novaOsRef, setNovaOsRef] = useState('');
  const [criando, setCriando] = useState(false);

  function abrirNova() {
    setNovaTitulo('');
    setNovaDescricao('');
    setNovaPrazo('');
    setNovaStatusId(etapas[0]?.id ?? '');
    setNovaOsRef('');
    setNovaOpen(true);
  }

  async function submitNova() {
    if (!novaTitulo.trim() || !novaStatusId) return;
    setCriando(true);
    try {
      const data: Partial<Pendencia> = {
        titulo: novaTitulo.trim(),
        descricao: novaDescricao.trim() || null,
        prazo: novaPrazo ? new Date(novaPrazo).toISOString() : null,
        statusId: novaStatusId,
        osRef: novaOsRef.trim() || null,
      };
      await actions.createPendencia(data);
      setNovaOpen(false);
    } catch {
      // erro já sinalizado via toast no hook; mantém o diálogo aberto p/ correção.
    } finally {
      setCriando(false);
    }
  }

  // ── Mover de etapa (por item) ──────────────────────────────────────────────
  const [movendoId, setMovendoId] = useState<string | null>(null);

  async function moverEtapa(p: Pendencia, statusId: string) {
    if (statusId === p.statusId) return;
    setMovendoId(p.id);
    try {
      await actions.updatePendencia(p.id, { statusId });
    } catch {
      // erro já sinalizado via toast no hook.
    } finally {
      setMovendoId(null);
    }
  }

  // ── Diálogo: converter em atestado ─────────────────────────────────────────
  const [convertAlvo, setConvertAlvo] = useState<Pendencia | null>(null);
  const [convNumero, setConvNumero] = useState('');
  const [convContratante, setConvContratante] = useState('');
  const [convObjeto, setConvObjeto] = useState('');
  const [convertendo, setConvertendo] = useState(false);

  function abrirConverter(p: Pendencia) {
    setConvertAlvo(p);
    setConvNumero('');
    setConvContratante('');
    setConvObjeto(p.titulo ?? '');
  }

  async function submitConverter() {
    if (!convertAlvo) return;
    if (!convNumero.trim() || !convContratante.trim() || !convObjeto.trim()) return;
    setConvertendo(true);
    try {
      const input: AtestadoInput = {
        numero: convNumero.trim(),
        contratante: convContratante.trim(),
        objeto: convObjeto.trim(),
      };
      await actions.convertPendencia(convertAlvo.id, input);
      setConvertAlvo(null);
    } catch {
      // erro já sinalizado via toast no hook.
    } finally {
      setConvertendo(false);
    }
  }

  // ── Excluir ────────────────────────────────────────────────────────────────
  const [excluirAlvo, setExcluirAlvo] = useState<Pendencia | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  async function confirmarExcluir() {
    if (!excluirAlvo) return;
    setExcluindo(true);
    try {
      await actions.deletePendencia(excluirAlvo.id);
      setExcluirAlvo(null);
    } catch {
      // erro já sinalizado via toast no hook.
    } finally {
      setExcluindo(false);
    }
  }

  const loading = pendenciasQuery.isLoading || statusQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* ── Cabeçalho: contadores + ações ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-foreground text-lg font-semibold">Pendências</h3>
            <p className="text-muted-foreground text-sm">
              Atestados em andamento até entrarem no acervo.
            </p>
          </div>
          <Badge variant="secondary">{total} no total</Badge>
          {atrasadasCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle size={13} />
              {atrasadasCount} atrasada{atrasadasCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por etapa */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger size="sm" className="w-[180px]">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as etapas</SelectItem>
              {etapas.map((etapa) => (
                <SelectItem key={etapa.id} value={etapa.id}>
                  {etapa.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Toggle "Só atrasadas" */}
          <Button
            type="button"
            size="sm"
            variant={soAtrasadas ? 'default' : 'outline'}
            className="gap-1"
            onClick={() => setSoAtrasadas((v) => !v)}
            aria-pressed={soAtrasadas}
          >
            <AlertTriangle size={14} />
            Só atrasadas
          </Button>

          <Button type="button" size="sm" className="gap-1" onClick={abrirNova}>
            <Plus size={14} />
            Nova pendência
          </Button>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : total === 0 ? (
        <div className="border-border bg-card flex flex-col items-center justify-center rounded-md border px-4 py-12 text-center">
          <ClipboardList className="text-muted-foreground mb-3" size={32} />
          <p className="text-foreground font-medium">Nenhuma pendência encontrada</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {soAtrasadas || statusFilter !== '__all__'
              ? 'Ajuste os filtros ou crie uma nova pendência para acompanhar.'
              : 'Crie uma pendência para não esquecer nenhum atestado em andamento.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(({ etapa, itens }) => (
            <Card key={etapa.id}>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="text-foreground font-semibold">{etapa.nome}</span>
                  <Badge variant={etapa.isFinal ? 'default' : 'outline'}>
                    {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {itens.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma pendência nesta etapa.</p>
                ) : (
                  <ul className="divide-border divide-y">
                    {itens.map((p) => {
                      const atrasada = isAtrasada(p);
                      return (
                        <li
                          key={p.id}
                          className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 md:flex-row md:items-start md:justify-between"
                        >
                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-foreground font-medium">{p.titulo}</span>
                              <Badge variant={atrasada ? 'destructive' : 'secondary'} className="gap-1">
                                {atrasada && <AlertTriangle size={12} />}
                                Prazo: {formatDate(p.prazo)}
                              </Badge>
                            </div>
                            {p.descricao && (
                              <p className="text-muted-foreground mt-1 text-sm">{p.descricao}</p>
                            )}
                            <p className="text-muted-foreground mt-1 text-xs">
                              Origem: {ORIGEM_LABEL[p.origem] ?? p.origem}
                              {p.osRef ? ` · OS ${p.osRef}` : ''}
                            </p>
                          </div>

                          {/* Ações */}
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={p.statusId}
                              onValueChange={(v) => moverEtapa(p, v)}
                              disabled={movendoId === p.id}
                            >
                              <SelectTrigger size="sm" className="w-[160px]">
                                <SelectValue placeholder="Etapa" />
                              </SelectTrigger>
                              <SelectContent>
                                {etapas.map((e) => (
                                  <SelectItem key={e.id} value={e.id}>
                                    {e.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => abrirConverter(p)}
                            >
                              <ArrowRightLeft size={14} />
                              Converter em atestado
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => setExcluirAlvo(p)}
                            >
                              <Trash2 size={14} />
                              Excluir
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Diálogo: nova pendência ── */}
      <Dialog
        open={novaOpen}
        onOpenChange={(open) => {
          if (!open) setNovaOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pendência</DialogTitle>
            <DialogDescription>
              Registre um atestado em andamento para acompanhá-lo até o acervo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pend-titulo">Título *</Label>
              <Input
                id="pend-titulo"
                value={novaTitulo}
                onChange={(e) => setNovaTitulo(e.target.value)}
                placeholder="Ex.: Solicitar CAT da obra XYZ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pend-descricao">Descrição</Label>
              <Textarea
                id="pend-descricao"
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Detalhes do que precisa ser feito…"
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pend-prazo">Prazo</Label>
                <Input
                  id="pend-prazo"
                  type="date"
                  value={novaPrazo}
                  onChange={(e) => setNovaPrazo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pend-status">Etapa</Label>
                <Select value={novaStatusId} onValueChange={setNovaStatusId}>
                  <SelectTrigger id="pend-status">
                    <SelectValue placeholder="Selecione a etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {etapas.map((etapa) => (
                      <SelectItem key={etapa.id} value={etapa.id}>
                        {etapa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pend-osref">Referência (OS)</Label>
              <Input
                id="pend-osref"
                value={novaOsRef}
                onChange={(e) => setNovaOsRef(e.target.value)}
                placeholder="Ex.: OS-2026-001"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNovaOpen(false)} disabled={criando}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={submitNova}
              disabled={criando || !novaTitulo.trim() || !novaStatusId}
              className="gap-1"
            >
              {criando && <Loader2 size={14} className="animate-spin" />}
              Criar pendência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: converter em atestado ── */}
      <Dialog
        open={!!convertAlvo}
        onOpenChange={(open) => {
          if (!open) setConvertAlvo(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converter em atestado</DialogTitle>
            <DialogDescription>
              {convertAlvo ? `Pendência: ${convertAlvo.titulo}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="conv-numero">Número *</Label>
              <Input
                id="conv-numero"
                value={convNumero}
                onChange={(e) => setConvNumero(e.target.value)}
                placeholder="Número do atestado"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conv-contratante">Contratante *</Label>
              <Input
                id="conv-contratante"
                value={convContratante}
                onChange={(e) => setConvContratante(e.target.value)}
                placeholder="Órgão / empresa contratante"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conv-objeto">Objeto *</Label>
              <Textarea
                id="conv-objeto"
                value={convObjeto}
                onChange={(e) => setConvObjeto(e.target.value)}
                placeholder="Objeto do contrato/atestado"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConvertAlvo(null)}
              disabled={convertendo}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={submitConverter}
              disabled={
                convertendo ||
                !convNumero.trim() ||
                !convContratante.trim() ||
                !convObjeto.trim()
              }
              className="gap-1"
            >
              {convertendo && <Loader2 size={14} className="animate-spin" />}
              Converter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Excluir ── */}
      <AlertDialog
        open={!!excluirAlvo}
        onOpenChange={(open) => {
          if (!open) setExcluirAlvo(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pendência</AlertDialogTitle>
            <AlertDialogDescription>
              {excluirAlvo
                ? `Tem certeza que deseja excluir "${excluirAlvo.titulo}"? Esta ação não pode ser desfeita.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarExcluir();
              }}
              disabled={excluindo}
              className="bg-destructive text-primary-foreground gap-1"
            >
              {excluindo && <Loader2 size={14} className="animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
