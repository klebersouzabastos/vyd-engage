import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { apiClient } from '../../services/api/client';
import { toast } from 'sonner';
import { Calendar, Loader2, Unplug, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

interface GoogleCalendarStatus {
  connected: boolean;
  email?: string;
  syncEnabled?: boolean;
  lastSyncAt?: string | null;
  connectedAt?: string;
}

export function CalendarTab() {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [togglingSync, setTogglingSync] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const result = await apiClient.getGoogleCalendarStatus();
      setStatus(result as GoogleCalendarStatus);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();

    // Check URL for callback result
    const params = new URLSearchParams(window.location.search);
    const googleParam = params.get('google');
    if (googleParam === 'connected') {
      toast.success('Google Calendar conectado com sucesso!');
      // Clean up URL
      params.delete('google');
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', newUrl);
      loadStatus();
    } else if (googleParam === 'error') {
      toast.error('Erro ao conectar Google Calendar. Tente novamente.');
      params.delete('google');
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [loadStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const result = await apiClient.getGoogleCalendarAuthUrl();
      const url = (result as { url: string }).url;
      if (url) {
        // Redirect to Google OAuth2 consent screen
        window.location.href = url;
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao iniciar conexao com Google');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await apiClient.disconnectGoogleCalendar();
      setStatus({ connected: false });
      toast.success('Google Calendar desconectado');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao desconectar');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleSync = async (enabled: boolean) => {
    setTogglingSync(true);
    try {
      await apiClient.toggleGoogleCalendarSync(enabled);
      setStatus((prev) => (prev ? { ...prev, syncEnabled: enabled } : prev));
      toast.success(enabled ? 'Sincronizacao ativada' : 'Sincronizacao desativada');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao alterar sincronizacao');
    } finally {
      setTogglingSync(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const result = await apiClient.syncGoogleCalendar();
      const data = result as { synced: number; total: number };
      toast.success(`${data.synced} de ${data.total} tarefas sincronizadas`);
      loadStatus();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Google Calendar</h3>
        <p className="text-sm text-gray-600">
          Sincronize suas tarefas do VYD Engage com o Google Calendar. Ao criar, atualizar ou
          concluir tarefas com data de vencimento, elas aparecem automaticamente no seu calendario.
        </p>
      </div>

      <div className="p-5 rounded-lg border border-gray-300 bg-card">
        <div className="flex items-start gap-4">
          {/* Google Calendar icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900">Google Calendar</h4>
              {status?.connected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  <CheckCircle2 size={12} />
                  Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                  <XCircle size={12} />
                  Desconectado
                </span>
              )}
            </div>

            {status?.connected ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Conta: <span className="font-medium text-gray-900">{status.email}</span>
                </p>

                {status.lastSyncAt && (
                  <p className="text-xs text-gray-500">
                    Ultima sincronizacao: {new Date(status.lastSyncAt).toLocaleString('pt-BR')}
                  </p>
                )}

                {/* Sync toggle */}
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Sincronizacao automatica</p>
                    <p className="text-xs text-gray-500">
                      Tarefas com data de vencimento sao sincronizadas automaticamente
                    </p>
                  </div>
                  <Switch
                    checked={status.syncEnabled ?? true}
                    onCheckedChange={handleToggleSync}
                    disabled={togglingSync}
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualSync}
                    disabled={syncing || !status.syncEnabled}
                    className="gap-2"
                  >
                    {syncing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    Sincronizar agora
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {disconnecting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Unplug size={14} />
                    )}
                    Desconectar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Conecte sua conta Google para sincronizar tarefas com o Google Calendar. A
                  sincronizacao e unidirecional (VYD Engage para Google Calendar).
                </p>
                <Button onClick={handleConnect} disabled={connecting} className="gap-2">
                  {connecting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Calendar size={14} />
                  )}
                  Conectar Google Calendar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Como funciona</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>
            Tarefas com data de vencimento sao criadas como eventos de 1 hora no Google Calendar
          </li>
          <li>
            Ao atualizar titulo, data ou status da tarefa, o evento e atualizado automaticamente
          </li>
          <li>Ao concluir uma tarefa, o evento e marcado como "[Concluida]"</li>
          <li>Ao excluir uma tarefa, o evento e removido do Google Calendar</li>
          <li>Tarefas sem data de vencimento nao geram eventos</li>
        </ul>
      </div>

      {/* Requirements info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-yellow-900 mb-2">Requisitos</h4>
        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
          <li>Uma conta Google com acesso ao Google Calendar</li>
          <li>Permissao para gerenciar eventos no calendario (solicitada durante a conexao)</li>
          <li>O administrador do sistema deve configurar as credenciais OAuth2 do Google</li>
        </ul>
      </div>
    </div>
  );
}
