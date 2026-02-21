import { Button } from "../ui/button";
import { Switch } from "../ui/switch";

export function NotificationsTab() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-gray-900 mb-4">Preferencias de Notificacao</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Novos leads</p>
              <p className="text-sm text-gray-600">Receber notificacoes por e-mail quando novos leads sao capturados</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Automacoes</p>
              <p className="text-sm text-gray-600">Alertas de automacoes falhadas ou concluidas</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Relatorios</p>
              <p className="text-sm text-gray-600">Relatorio semanal por e-mail com estatisticas</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Atualizacoes do sistema</p>
              <p className="text-sm text-gray-600">Notificacoes sobre novas funcionalidades e atualizacoes</p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-300">
        <Button className="bg-primary hover:bg-primary-dark">
          Salvar Preferencias
        </Button>
      </div>
    </div>
  );
}
