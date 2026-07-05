import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2, Save, Trash2, CheckCircle2, PenLine } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { toast } from 'sonner';
import type { IntegrationStatus } from '../../types/documents';

/**
 * Configuração da assinatura eletrônica (ZapSign) — req 19 (F3).
 *
 * GATING GRACIOSO: enquanto não configurado, mostra o formulário de credencial
 * (apiKey + webhookSecret). Ao conectar, o status vira "conectado" e o recurso
 * de enviar proposta para assinatura passa a ficar disponível nas propostas.
 * Sem credencial, os endpoints respondem "não configurado" e nada quebra.
 */
export function SignatureConfigCard() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await apiClient.getSignatureStatus();
      setStatus(data);
    } catch {
      setStatus({ configured: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSave = async () => {
    if (!apiKey.trim() || !webhookSecret.trim()) {
      toast.error('Informe a API Key e o Webhook Secret do ZapSign.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await apiClient.setSignatureConfig({
        provider: 'zapsign',
        apiKey: apiKey.trim(),
        webhookSecret: webhookSecret.trim(),
      });
      setStatus(data);
      setApiKey('');
      setWebhookSecret('');
      setEditing(false);
      toast.success('Assinatura eletrônica conectada.');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao conectar a assinatura eletrônica.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setRemoving(true);
    try {
      await apiClient.deleteSignatureConfig();
      setStatus({ configured: false });
      setEditing(false);
      toast.success('Assinatura eletrônica desconectada.');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao desconectar a assinatura eletrônica.');
    } finally {
      setRemoving(false);
    }
  };

  const configured = !!status?.configured;
  const showForm = !configured || editing;

  return (
    <div className="p-4 rounded-lg border border-border">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <PenLine size={16} className="text-muted-foreground" />
            <h4 className="font-medium text-foreground">Assinatura eletrônica (ZapSign)</h4>
            {loading ? null : configured ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                <CheckCircle2 size={12} />
                Conectado
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                Não configurado
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Envie propostas para assinatura e acompanhe o status (enviada, assinada, recusada)
            diretamente na timeline do negócio.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          Carregando…
        </div>
      ) : showForm ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="zapsign-api-key" className="mb-1 block">
              API Key
            </Label>
            <Input
              id="zapsign-api-key"
              type="password"
              autoComplete="off"
              placeholder="Token da API do ZapSign"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="zapsign-webhook-secret" className="mb-1 block">
              Webhook Secret
            </Label>
            <Input
              id="zapsign-webhook-secret"
              type="password"
              autoComplete="off"
              placeholder="Segredo para validar os webhooks recebidos"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Usado para validar (HMAC) os webhooks de status de assinatura.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {configured ? 'Salvar credenciais' : 'Conectar'}
            </Button>
            {configured && editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setApiKey('');
                  setWebhookSecret('');
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Editar credenciais
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive"
            onClick={handleDisconnect}
            disabled={removing}
          >
            {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Desconectar
          </Button>
        </div>
      )}
    </div>
  );
}
