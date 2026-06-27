import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';

const PREFS_KEY = 'vyd_notification_prefs';

interface NotificationPrefs {
  newLeads: boolean;
  automations: boolean;
  reports: boolean;
  systemUpdates: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  newLeads: true,
  automations: true,
  reports: false,
  systemUpdates: true,
};

function loadPrefs(): NotificationPrefs {
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    if (saved) return { ...DEFAULT_PREFS, ...JSON.parse(saved) };
  } catch {
    /* noop: prefs corrompidas caem no default */
  }
  return { ...DEFAULT_PREFS };
}

export function NotificationsTab() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs);
  const [dirty, setDirty] = useState(false);

  const updatePref = (key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    setDirty(false);
    toast.success('Preferencias salvas');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-gray-900 mb-4">Preferencias de Notificacao</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Novos leads</p>
              <p className="text-sm text-gray-600">
                Receber notificacoes por e-mail quando novos leads sao capturados
              </p>
            </div>
            <Switch checked={prefs.newLeads} onCheckedChange={(v) => updatePref('newLeads', v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Automacoes</p>
              <p className="text-sm text-gray-600">Alertas de automacoes falhadas ou concluidas</p>
            </div>
            <Switch
              checked={prefs.automations}
              onCheckedChange={(v) => updatePref('automations', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Relatorios</p>
              <p className="text-sm text-gray-600">Relatorio semanal por e-mail com estatisticas</p>
            </div>
            <Switch checked={prefs.reports} onCheckedChange={(v) => updatePref('reports', v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Atualizacoes do sistema</p>
              <p className="text-sm text-gray-600">
                Notificacoes sobre novas funcionalidades e atualizacoes
              </p>
            </div>
            <Switch
              checked={prefs.systemUpdates}
              onCheckedChange={(v) => updatePref('systemUpdates', v)}
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-300">
        <Button className="bg-primary hover:bg-primary-dark" onClick={handleSave} disabled={!dirty}>
          Salvar Preferencias
        </Button>
      </div>
    </div>
  );
}
