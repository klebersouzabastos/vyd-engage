import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, Sparkles, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { apiClient } from '../../services/api/client';
import type { EnrichFieldDiff } from '../../types/documents';

/**
 * Enriquecimento por CNPJ (upgrade-rd-parity, req 20).
 *
 * Consulta o CNPJ (BrasilAPI / ReceitaWS via backend) e apresenta um diff campo
 * a campo — coluna "Atual" (na empresa) vs "Sugerido" (da consulta). O usuário
 * marca quais campos aplicar; NUNCA sobrescreve silenciosamente. O apply devolve
 * ao formulário apenas os campos marcados (o pai grava via PUT /companies normal).
 */

interface CnpjEnrichDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** CNPJ digitado no formulário (usado como valor inicial da consulta). */
  cnpj: string;
  /** Empresa já existente — passa o id p/ o backend montar o "current" do servidor. */
  companyId?: string;
  /**
   * Aplica os campos marcados de volta ao formulário. Chave → valor sugerido
   * (string ou null quando o sugerido é vazio).
   */
  onApply: (fields: Record<string, string | null>) => void;
}

function normalizeCnpj(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function CnpjEnrichDialog({
  open,
  onOpenChange,
  cnpj,
  companyId,
  onApply,
}: CnpjEnrichDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<EnrichFieldDiff[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const runEnrich = useCallback(async () => {
    const digits = normalizeCnpj(cnpj);
    if (digits.length !== 14) {
      setError('Informe um CNPJ válido com 14 dígitos.');
      setFields([]);
      return;
    }
    setLoading(true);
    setError(null);
    setFields([]);
    setSelected({});
    try {
      const res = await apiClient.enrichCnpj({ cnpj: digits, companyId });
      const diff = res.data?.fields ?? [];
      // Só oferece campos em que há sugestão E ela difere do atual (mudança real).
      const changed = diff.filter(
        (f) => f.suggested != null && f.suggested !== '' && f.suggested !== f.current
      );
      if (changed.length === 0) {
        setError('Nenhum dado novo encontrado para este CNPJ.');
        return;
      }
      setFields(changed);
      // Pré-marca todos os campos com sugestão (usuário pode desmarcar).
      setSelected(Object.fromEntries(changed.map((f) => [f.key, true])));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível consultar o CNPJ.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [cnpj, companyId]);

  // Ao abrir, dispara a consulta automaticamente quando o CNPJ já é válido.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setFields([]);
    setSelected({});
    if (normalizeCnpj(cnpj).length === 14) {
      runEnrich();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedCount = fields.filter((f) => selected[f.key]).length;

  const apply = () => {
    const chosen: Record<string, string | null> = {};
    for (const f of fields) {
      if (selected[f.key]) chosen[f.key] = f.suggested;
    }
    onApply(chosen);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            Enriquecer pelo CNPJ
          </DialogTitle>
          <DialogDescription>
            Compare os dados atuais com os da Receita Federal e escolha o que aplicar. Nada é
            gravado até você clicar em &quot;Aplicar selecionados&quot;.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            Consultando CNPJ...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle size={16} className="text-destructive" />
              {error}
            </div>
            <Button variant="outline" size="sm" onClick={runEnrich} className="gap-2">
              <Search size={14} />
              Tentar novamente
            </Button>
          </div>
        ) : fields.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Confira o CNPJ no formulário e consulte a Receita Federal.
            </p>
            <Button size="sm" onClick={runEnrich} className="gap-2">
              <Search size={14} />
              Consultar CNPJ
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="w-10 py-2 pr-2" aria-label="Selecionar" />
                  <th className="py-2 pr-3 font-medium">Campo</th>
                  <th className="py-2 pr-3 font-medium">Atual</th>
                  <th className="py-2 font-medium">Sugerido</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.key} className="border-b border-border align-top last:border-0">
                    <td className="py-2 pr-2">
                      <Checkbox
                        checked={!!selected[f.key]}
                        onCheckedChange={() => toggle(f.key)}
                        aria-label={`Aplicar ${f.label}`}
                      />
                    </td>
                    <td className="py-2 pr-3 font-medium text-foreground">{f.label}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {f.current || <span className="italic">vazio</span>}
                    </td>
                    <td className="py-2 text-foreground">
                      {f.suggested || <span className="italic text-muted-foreground">vazio</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={apply} disabled={loading || selectedCount === 0}>
            Aplicar selecionados{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
