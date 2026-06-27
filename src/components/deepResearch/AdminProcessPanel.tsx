import { useRef, useState } from 'react';
import { Copy, Upload, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { useDeepResearchActions } from '../../hooks/useDeepResearch';
import type { DeepResearch } from '../../types/deepResearch';

const MAX_REPORT = 500_000;

interface AdminProcessPanelProps {
  research: DeepResearch;
  onSaved?: (research: DeepResearch) => void;
}

/**
 * Painel de processamento — visível apenas para o platform admin. Mostra o
 * prompt confidencial (montado no backend), permite copiá-lo para rodar no
 * ChatGPT e colar/importar o resultado, publicando o relatório.
 */
export function AdminProcessPanel({ research, onSaved }: AdminProcessPanelProps) {
  const { updateResearch } = useDeepResearchActions();
  const [reportMarkdown, setReportMarkdown] = useState(research.reportMarkdown ?? '');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const tooLarge = reportMarkdown.length > MAX_REPORT;

  const copyPrompt = async () => {
    if (!research.promptUsed) return;
    try {
      await navigator.clipboard.writeText(research.promptUsed);
      toast.success('Prompt copiado!');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReportMarkdown(String(reader.result ?? ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  const save = async () => {
    if (tooLarge || !reportMarkdown.trim()) return;
    setSaving(true);
    try {
      const saved = await updateResearch(research.id, { reportMarkdown });
      onSaved?.(saved);
    } catch {
      // toast no hook
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
        <ShieldCheck className="h-4 w-4" />
        Processamento — admin da plataforma
      </p>
      <p className="mt-1 text-xs text-amber-700">
        Conteúdo confidencial. A geração é automática; se ela não estiver disponível, copie o
        prompt, rode num motor de Deep Research e cole o resultado para publicar o relatório.
      </p>

      {research.providerError ? (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          Erro no processamento automático: {research.providerError}. Você pode colar o resultado
          manualmente abaixo.
        </div>
      ) : research.status === 'RESEARCHING' &&
        (research.requestedAt || research.providerResponseId) ? (
        <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Processando automaticamente… esta página atualiza sozinha quando concluir.
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between">
        <Label className="text-xs font-medium text-amber-900">Prompt montado</Label>
        <Button size="sm" variant="outline" onClick={copyPrompt} disabled={!research.promptUsed}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          Copiar prompt
        </Button>
      </div>
      <Textarea
        readOnly
        value={research.promptUsed ?? ''}
        rows={6}
        className="mt-1 bg-white font-mono text-xs"
      />

      <div className="mt-4 flex items-center justify-between">
        <Label className="text-xs font-medium text-amber-900">Resultado (markdown)</Label>
        <input
          ref={fileRef}
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          className="hidden"
          onChange={importFile}
        />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1 h-3.5 w-3.5" />
          Importar .md
        </Button>
      </div>
      <Textarea
        value={reportMarkdown}
        onChange={(e) => setReportMarkdown(e.target.value)}
        rows={6}
        className="mt-1 bg-white font-mono text-xs"
        placeholder="Cole aqui o relatório em markdown…"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className={tooLarge ? 'text-xs text-red-600' : 'text-xs text-slate-400'}>
          {tooLarge
            ? `Máx. ${MAX_REPORT.toLocaleString('pt-BR')} caracteres.`
            : `${reportMarkdown.length.toLocaleString('pt-BR')} caracteres`}
        </span>
        <Button size="sm" onClick={save} disabled={saving || tooLarge || !reportMarkdown.trim()}>
          {saving ? 'Publicando…' : 'Publicar relatório'}
        </Button>
      </div>
    </div>
  );
}
