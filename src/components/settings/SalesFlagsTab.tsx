import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, PartyPopper, Repeat } from 'lucide-react';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { apiClient } from '../../services/api/client';
import type { SalesFlags } from '../../types/sales';

/**
 * Configurações de Negócios → Multi-vendas & Comemoração (upgrade-rd-parity
 * reqs 4 e 11): toggles dos flags do tenant, salvos imediatamente ao alternar.
 * 100% tokens semânticos (STRICT_SCOPE do check:colors).
 */

export function SalesFlagsTab() {
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<SalesFlags>({
    multiSalesEnabled: false,
    celebrationEnabled: true,
  });
  const [savingKey, setSavingKey] = useState<keyof SalesFlags | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getSalesFlags()
      .then((res) => {
        if (!cancelled) setFlags(res.data);
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar configurações')
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (key: keyof SalesFlags, value: boolean) => {
    const previous = flags;
    setFlags((prev) => ({ ...prev, [key]: value }));
    setSavingKey(key);
    try {
      const res = await apiClient.updateSalesFlags({ [key]: value });
      setFlags(res.data);
      toast.success('Configuração salva!');
    } catch (err) {
      setFlags(previous);
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar configuração');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        Carregando configurações...
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Repeat size={18} className="text-primary" />
          <h3 className="font-semibold text-foreground">Multi-vendas</h3>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="multi-sales">Agendar próxima negociação ao ganhar ou perder</Label>
            <p className="text-xs text-muted-foreground">
              Ao marcar um negócio como ganho ou perdido, o sistema oferece agendar a próxima
              negociação (pós-venda, cross-sell, upsell, recompra...). Na data, o negócio é
              criado automaticamente e o responsável é notificado.
            </p>
          </div>
          <Switch
            id="multi-sales"
            checked={flags.multiSalesEnabled}
            onCheckedChange={(v) => toggle('multiSalesEnabled', v)}
            disabled={savingKey !== null}
          />
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <PartyPopper size={18} className="text-primary" />
          <h3 className="font-semibold text-foreground">Comemoração de venda</h3>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="celebration">Exibir celebração ao marcar venda</Label>
            <p className="text-xs text-muted-foreground">
              Ao ganhar um negócio, exibe uma comemoração breve com a contagem e o valor das
              vendas do usuário no mês.
            </p>
          </div>
          <Switch
            id="celebration"
            checked={flags.celebrationEnabled}
            onCheckedChange={(v) => toggle('celebrationEnabled', v)}
            disabled={savingKey !== null}
          />
        </div>
      </section>
    </div>
  );
}
