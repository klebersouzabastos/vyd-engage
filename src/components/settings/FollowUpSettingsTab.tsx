import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BellRing, FileSignature, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { apiClient } from '../../services/api/client';

/**
 * Settings → Follow-up & Contratos (req 16): ADMIN/GESTOR editam o limiar de
 * inatividade padrão (clientFollowUpDays) e os limiares de antecedência do
 * alerta de contrato (contractAlertDays). Valores inválidos são rejeitados
 * com mensagem clara. 100% tokens semânticos (STRICT_SCOPE do check:colors).
 */

export function FollowUpSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [followUpDays, setFollowUpDays] = useState('30');
  const [alertDaysText, setAlertDaysText] = useState('90, 60, 30');
  const [errors, setErrors] = useState<{ followUpDays?: string; alertDays?: string }>({});

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getTenant()
      .then(({ tenant }) => {
        if (cancelled) return;
        if (tenant.clientFollowUpDays) setFollowUpDays(String(tenant.clientFollowUpDays));
        if (Array.isArray(tenant.contractAlertDays) && tenant.contractAlertDays.length > 0) {
          setAlertDaysText(tenant.contractAlertDays.join(', '));
        }
      })
      .catch(() => toast.error('Erro ao carregar configurações'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Validação (req 16): número > 0; lista de inteiros > 0 sem duplicatas.
  const validate = (): { followUpDays?: number; alertDays?: number[] } | null => {
    const next: { followUpDays?: string; alertDays?: string } = {};

    const days = Number(followUpDays);
    if (!Number.isInteger(days) || days <= 0) {
      next.followUpDays = 'Informe um número inteiro de dias maior que zero';
    }

    const parts = alertDaysText
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const values = parts.map(Number);
    let alertDays: number[] | undefined;
    if (parts.length === 0) {
      next.alertDays = 'Informe ao menos um limiar (ex.: 90, 60, 30)';
    } else if (values.some((v) => !Number.isInteger(v) || v <= 0)) {
      next.alertDays = 'Os limiares devem ser números inteiros de dias maiores que zero';
    } else if (new Set(values).size !== values.length) {
      next.alertDays = 'Os limiares não podem ter valores duplicados';
    } else {
      alertDays = [...values].sort((a, b) => b - a);
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    return { followUpDays: days, alertDays };
  };

  const save = async () => {
    const parsed = validate();
    if (!parsed) return;
    try {
      setSaving(true);
      const { tenant } = await apiClient.updateTenant({
        clientFollowUpDays: parsed.followUpDays,
        contractAlertDays: parsed.alertDays,
      });
      // Reflete a ordem decrescente persistida pelo backend (req 16).
      if (Array.isArray(tenant?.contractAlertDays)) {
        setAlertDaysText(tenant.contractAlertDays.join(', '));
      }
      toast.success('Configurações salvas!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 size={16} className="animate-spin" />
        Carregando configurações...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BellRing size={18} className="text-primary" />
          <h3 className="font-semibold text-foreground">Follow-up de clientes ativos</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Clientes ativos sem contato por mais dias que o limiar abaixo geram tarefa de
          follow-up e alerta para o dono da conta. Cada empresa pode ter cadência própria no
          cadastro (que substitui este padrão).
        </p>
        <div>
          <Label htmlFor="followup-days">Limiar de inatividade padrão (dias)</Label>
          <Input
            id="followup-days"
            type="number"
            min={1}
            value={followUpDays}
            onChange={(e) => setFollowUpDays(e.target.value)}
            className="mt-1 w-40"
            error={errors.followUpDays}
          />
          {errors.followUpDays && (
            <p className="text-xs text-destructive mt-1">{errors.followUpDays}</p>
          )}
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <FileSignature size={18} className="text-primary" />
          <h3 className="font-semibold text-foreground">Alertas de vencimento de contrato</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          A equipe é alertada quando o vencimento do contrato guarda-chuva de uma empresa entra
          em cada limiar de antecedência (em dias, separados por vírgula).
        </p>
        <div>
          <Label htmlFor="contract-alert-days">Limiares de antecedência (dias)</Label>
          <Input
            id="contract-alert-days"
            value={alertDaysText}
            onChange={(e) => setAlertDaysText(e.target.value)}
            placeholder="90, 60, 30"
            className="mt-1 w-64"
            error={errors.alertDays}
          />
          {errors.alertDays && <p className="text-xs text-destructive mt-1">{errors.alertDays}</p>}
        </div>
      </section>

      <div className="pt-2">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
