import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2, Save, Trash2, CheckCircle2, Phone } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { toast } from 'sonner';
import type { IntegrationStatus } from '../../types/documents';

/**
 * Configuração da telefonia virtual (Twilio) — req 21 (F3).
 *
 * GATING GRACIOSO: enquanto não configurado, mostra o formulário de credencial
 * (accountSid + authToken + twimlAppSid opcional). Ao conectar, o botão "Ligar"
 * (click-to-call) passa a aparecer nos telefones de Lead/Contato. Sem credencial,
 * o link `tel:` continua funcionando e o webphone fica oculto.
 */
export function PhoneConfigCard({ onStatusChange }: { onStatusChange?: () => void }) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [twimlAppSid, setTwimlAppSid] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await apiClient.getPhoneStatus();
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
    if (!accountSid.trim() || !authToken.trim()) {
      toast.error('Informe o Account SID e o Auth Token.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await apiClient.setPhoneConfig({
        provider: 'twilio',
        accountSid: accountSid.trim(),
        authToken: authToken.trim(),
        twimlAppSid: twimlAppSid.trim() || undefined,
      });
      setStatus(data);
      setAccountSid('');
      setAuthToken('');
      setTwimlAppSid('');
      setEditing(false);
      toast.success('Telefone virtual conectado.');
      onStatusChange?.();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao conectar o telefone virtual.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setRemoving(true);
    try {
      await apiClient.deletePhoneConfig();
      setStatus({ configured: false });
      setEditing(false);
      toast.success('Telefone virtual desconectado.');
      onStatusChange?.();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao desconectar o telefone virtual.');
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
            <Phone size={16} className="text-muted-foreground" />
            <h4 className="font-medium text-foreground">Telefone virtual (Twilio)</h4>
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
            Habilita o botão "Ligar" (click-to-call) nos telefones de leads e contatos, com registro
            automático da ligação na timeline.
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
            <Label htmlFor="twilio-account-sid" className="mb-1 block">
              Account SID
            </Label>
            <Input
              id="twilio-account-sid"
              autoComplete="off"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="twilio-auth-token" className="mb-1 block">
              Auth Token
            </Label>
            <Input
              id="twilio-auth-token"
              type="password"
              autoComplete="off"
              placeholder="Token de autenticação"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="twilio-twiml-app-sid" className="mb-1 block">
              TwiML App SID <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="twilio-twiml-app-sid"
              autoComplete="off"
              placeholder="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={twimlAppSid}
              onChange={(e) => setTwimlAppSid(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Necessário apenas para o webphone (token de acesso do provedor).
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
                  setAccountSid('');
                  setAuthToken('');
                  setTwimlAppSid('');
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
