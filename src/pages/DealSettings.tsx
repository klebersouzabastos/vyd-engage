import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PageSkeleton } from '../components/PageSkeleton';
import { apiClient, ConfigItem } from '../services/api/client';

type Api = {
  list: (activeOnly?: boolean) => Promise<{ status: number; data: ConfigItem[] }>;
  create: (value: string) => Promise<{ status: number; data: ConfigItem }>;
  update: (
    id: string,
    data: { active?: boolean; order?: number; name?: string; label?: string }
  ) => Promise<{ status: number; data: ConfigItem }>;
  remove: (id: string) => Promise<{ status: number; data: { deleted: boolean } }>;
};

const labelOf = (it: ConfigItem) => it.label ?? it.name ?? '';

/**
 * Seção genérica de lista de configuração (Motivos de Perda / Fontes / Campanhas).
 * Adicionar, ativar/desativar e remover itens; reusa o CRUD tenant-scoped do backend.
 */
function ConfigSection({
  title,
  description,
  placeholder,
  api,
}: {
  title: string;
  description: string;
  placeholder: string;
  api: Api;
}) {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list();
      setItems(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const v = newValue.trim();
    if (!v) return;
    setSaving(true);
    try {
      await api.create(v);
      setNewValue('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (it: ConfigItem) => {
    try {
      await api.update(it.id, { active: !it.active });
      setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, active: !p.active } : p)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar');
    }
  };

  const remove = async (it: ConfigItem) => {
    try {
      await api.remove(it.id);
      setItems((prev) => prev.filter((p) => p.id !== it.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover');
    }
  };

  return (
    <div className="rounded-lg border border-gray-300 bg-white shadow-sm">
      <div className="border-b border-gray-300 p-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{description}</p>
      </div>

      <div className="flex gap-2 p-4">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={placeholder}
          maxLength={120}
        />
        <Button onClick={add} disabled={saving || !newValue.trim()} className="gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Adicionar
        </Button>
      </div>

      {loading ? (
        <div className="p-4">
          <PageSkeleton type="cards" />
        </div>
      ) : items.length === 0 ? (
        <p className="p-4 text-sm text-gray-500">Nenhum item cadastrado.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span
                className={`text-sm ${it.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}
              >
                {labelOf(it)}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggle(it)}
                  title={it.active ? 'Desativar' : 'Ativar'}
                >
                  {it.active ? 'Ativo' : 'Inativo'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  aria-label="Remover"
                  onClick={() => remove(it)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DealSettings() {
  return (
    <div className="min-h-screen">
      <Header
        title="Configurações de Negócios"
        subtitle="Motivos de perda, fontes e campanhas de origem"
      />
      <div className="space-y-6 p-8">
        <ConfigSection
          title="Motivos de Perda"
          description="Lista usada ao marcar uma negociação como perdida (obrigatório escolher um)."
          placeholder="Novo motivo de perda"
          api={{
            list: (a) => apiClient.getLostReasons(a),
            create: (v) => apiClient.createLostReason(v),
            update: (id, d) => apiClient.updateLostReason(id, d),
            remove: (id) => apiClient.deleteLostReason(id),
          }}
        />
        <ConfigSection
          title="Fontes"
          description="Origem da negociação (de onde veio a oportunidade)."
          placeholder="Nova fonte"
          api={{
            list: (a) => apiClient.getDealSources(a),
            create: (v) => apiClient.createDealSource(v),
            update: (id, d) => apiClient.updateDealSource(id, d),
            remove: (id) => apiClient.deleteDealSource(id),
          }}
        />
        <ConfigSection
          title="Campanhas de origem"
          description="Campanha que originou a negociação (distinta das campanhas de e-mail)."
          placeholder="Nova campanha"
          api={{
            list: (a) => apiClient.getOriginCampaigns(a),
            create: (v) => apiClient.createOriginCampaign(v),
            update: (id, d) => apiClient.updateOriginCampaign(id, d),
            remove: (id) => apiClient.deleteOriginCampaign(id),
          }}
        />
      </div>
    </div>
  );
}
