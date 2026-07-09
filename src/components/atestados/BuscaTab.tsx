// Módulo Gestão de Atestados Técnicos — aba "Busca inteligente".
//
// Busca sob demanda (semântica quando embeddings estão habilitados; senão por
// palavra-chave). Diferente das demais abas, a busca NÃO tem hook dedicado em
// useAtestados.ts, então — por exceção explícita à regra de consumo via hooks —
// chamamos apiClient.buscaAtestados(q, includeTerceiros) direto no handler.
// O status (embeddingEnabled) continua vindo do hook useAtestadoStatus().

import { useState } from 'react';
import { Search, Loader2, FileSearch, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/services/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAtestadoStatus } from '@/hooks/useAtestados';
import type { BuscaResult } from '@/types/atestados';

/** Converte o score do backend em rótulo de porcentagem (ex.: "82%"). */
function formatScore(score: number): string {
  if (!Number.isFinite(score)) return '—';
  // Score costuma ser similaridade em [0,1]; se vier já em escala 0–100, usa direto.
  const pct = score <= 1 ? score * 100 : score;
  const clamped = Math.max(0, Math.min(100, pct));
  return `${Math.round(clamped)}%`;
}

export function BuscaTab() {
  const { data: status } = useAtestadoStatus();
  const embeddingEnabled = status?.embeddingEnabled ?? false;

  const [termo, setTermo] = useState('');
  const [includeTerceiros, setIncludeTerceiros] = useState(false);
  const [resultados, setResultados] = useState<BuscaResult[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const handleBuscar = async () => {
    const q = termo.trim();
    if (!q) {
      toast.error('Digite um termo para buscar.');
      return;
    }
    setBuscando(true);
    try {
      const res = await apiClient.buscaAtestados(q, includeTerceiros);
      setResultados(res ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao realizar a busca.';
      toast.error(msg);
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleBuscar();
  };

  return (
    <div className="space-y-6">
      {/* Aviso: busca semântica indisponível */}
      {!embeddingEnabled && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-foreground">
            Busca semântica indisponível (IA de embeddings não configurada) — usando busca por
            palavra-chave.
          </p>
        </div>
      )}

      {/* Campo de busca + toggle + botão */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Descreva o serviço, quantitativo ou objeto do atestado…"
              className="h-11 pl-10 text-base"
              aria-label="Termo de busca"
            />
          </div>
          <Button type="submit" size="lg" className="gap-2" disabled={buscando}>
            {buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Buscar
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="busca-incluir-terceiros"
            checked={includeTerceiros}
            onCheckedChange={(checked) => setIncludeTerceiros(checked === true)}
          />
          <Label htmlFor="busca-incluir-terceiros" className="cursor-pointer text-sm text-foreground">
            Incluir terceiros
          </Label>
        </div>
      </form>

      {/* Resultados */}
      {buscando ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Carregando…</span>
        </div>
      ) : resultados === null ? (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <FileSearch size={32} className="mb-3 text-muted-foreground" />
          <p className="font-medium text-foreground">Busque no acervo de atestados</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Digite um termo acima para encontrar atestados por objeto, serviço ou quantitativo.
          </p>
        </div>
      ) : resultados.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <FileSearch size={32} className="mb-3 text-muted-foreground" />
          <p className="font-medium text-foreground">
            Nenhum atestado encontrado para esta busca.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tente outros termos ou marque “Incluir terceiros”.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {resultados.length}{' '}
            {resultados.length === 1 ? 'atestado encontrado' : 'atestados encontrados'}
          </p>
          {resultados.map((r) => (
            <Card key={r.atestado.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default">{formatScore(r.score)}</Badge>
                  <Badge variant={r.atestado.origem === 'PROPRIO' ? 'secondary' : 'outline'}>
                    {r.atestado.origem === 'PROPRIO' ? 'PRÓPRIO' : 'TERCEIRO'}
                  </Badge>
                  <span className="text-sm font-medium text-foreground">
                    {r.atestado.numero}
                  </span>
                  <span className="text-sm text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">
                    {r.atestado.contratante}
                  </span>
                </div>

                <p className="line-clamp-2 text-sm text-foreground">{r.atestado.objeto}</p>

                {r.trecho && (
                  <p className="rounded-md bg-muted p-3 text-sm italic text-foreground">
                    {r.trecho}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
