import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Loader2, Save } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { toast } from 'sonner';

export function SlackTeamsSection() {
  const [slackUrl, setSlackUrl] = useState('');
  const [teamsUrl, setTeamsUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .getTenant()
      .then(({ tenant }) => {
        const s = tenant.settings as { slackWebhookUrl?: string; teamsWebhookUrl?: string };
        setSlackUrl(s?.slackWebhookUrl ?? '');
        setTeamsUrl(s?.teamsWebhookUrl ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.updateTenant({
        settings: {
          slackWebhookUrl: slackUrl.trim() || null,
          teamsWebhookUrl: teamsUrl.trim() || null,
        },
      });
      toast.success('Configurações de notificação salvas');
    } catch {
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-gray-300">
      <div className="mb-4">
        <h4 className="font-medium text-gray-900 mb-1">Notificações Slack / MS Teams</h4>
        <p className="text-sm text-gray-500">
          Receba alertas de deals ganhos/perdidos, leads capturados e tarefas atrasadas.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" />
          Carregando…
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="slack-webhook-url"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Slack Incoming Webhook URL
            </label>
            <Input
              id="slack-webhook-url"
              placeholder="https://hooks.slack.com/services/..."
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Crie em: <span className="font-mono">api.slack.com/apps → Incoming Webhooks</span>
            </p>
          </div>

          <div>
            <label
              htmlFor="teams-webhook-url"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              MS Teams Webhook URL
            </label>
            <Input
              id="teams-webhook-url"
              placeholder="https://outlook.office.com/webhook/..."
              value={teamsUrl}
              onChange={(e) => setTeamsUrl(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Crie via conector "Incoming Webhook" em um canal do Teams.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </Button>
        </div>
      )}
    </div>
  );
}
