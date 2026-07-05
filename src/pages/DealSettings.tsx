import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import {
  Award,
  Bell,
  Building2,
  ClipboardList,
  FileText,
  ListChecks,
  Mail,
  Megaphone,
  Plus,
  Repeat,
  Trash2,
  Loader2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PageSkeleton } from '../components/PageSkeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { QualificationTab } from '../components/settings/QualificationTab';
import { QuestionnairesTab } from '../components/settings/QuestionnairesTab';
import { FieldPresetsTab } from '../components/settings/FieldPresetsTab';
import { ManagerTriggersTab } from '../components/settings/ManagerTriggersTab';
import { SalesFlagsTab } from '../components/settings/SalesFlagsTab';
import { EmailTemplatesTab } from '../components/settings/EmailTemplatesTab';
import { ProposalTemplatesTab } from '../components/settings/ProposalTemplatesTab';
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
 * Seção genérica de lista de configuração (Motivos de Perda / Fontes /
 * Campanhas / Segmentos). Adicionar, ativar/desativar e remover itens;
 * reusa o CRUD tenant-scoped do backend.
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
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border p-4">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
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
        <p className="p-4 text-sm text-muted-foreground">Nenhum item cadastrado.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span
                className={`text-sm ${it.active ? 'text-foreground' : 'text-muted-foreground line-through'}`}
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
                  className="text-destructive hover:bg-destructive/10"
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

// Adapta o CRUD de segmentos de empresas (upgrade-rd-parity req 6) ao shape
// genérico de ConfigItem (CompanySegment não tem `order`).
const segmentsApi: Api = {
  list: async () => {
    const res = await apiClient.getCompanySegments();
    return {
      status: res.status,
      data: res.data.map((s) => ({ id: s.id, name: s.name, active: s.active, order: 0 })),
    };
  },
  create: async (name) => {
    const res = await apiClient.createCompanySegment(name);
    return {
      status: res.status,
      data: { id: res.data.id, name: res.data.name, active: res.data.active, order: 0 },
    };
  },
  update: async (id, d) => {
    const res = await apiClient.updateCompanySegment(id, { name: d.name, active: d.active });
    return {
      status: res.status,
      data: { id: res.data.id, name: res.data.name, active: res.data.active, order: 0 },
    };
  },
  remove: (id) => apiClient.deleteCompanySegment(id),
};

const TAB_TRIGGER_CLASS =
  'bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 px-0';

export function DealSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'qualification';

  return (
    <div className="min-h-screen">
      <Header
        title="Configurações de Negócios"
        subtitle="Qualificação, questionários, fontes, gatilhos e modelos de e-mail"
      />
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setSearchParams({ tab: value })}
            className="w-full"
          >
            <div className="overflow-x-auto border-b border-border px-6">
              <TabsList className="h-auto gap-8 bg-transparent p-0">
                <TabsTrigger value="qualification" className={TAB_TRIGGER_CLASS}>
                  <Award size={16} className="mr-2" />
                  Qualificação
                </TabsTrigger>
                <TabsTrigger value="questionnaires" className={TAB_TRIGGER_CLASS}>
                  <ClipboardList size={16} className="mr-2" />
                  Questionários
                </TabsTrigger>
                <TabsTrigger value="sources" className={TAB_TRIGGER_CLASS}>
                  <Megaphone size={16} className="mr-2" />
                  Fontes &amp; Campanhas
                </TabsTrigger>
                <TabsTrigger value="lost-reasons" className={TAB_TRIGGER_CLASS}>
                  <XCircle size={16} className="mr-2" />
                  Motivos de perda
                </TabsTrigger>
                <TabsTrigger value="segments" className={TAB_TRIGGER_CLASS}>
                  <Building2 size={16} className="mr-2" />
                  Segmentos
                </TabsTrigger>
                <TabsTrigger value="presets" className={TAB_TRIGGER_CLASS}>
                  <ListChecks size={16} className="mr-2" />
                  Pré-definidos
                </TabsTrigger>
                <TabsTrigger value="triggers" className={TAB_TRIGGER_CLASS}>
                  <Bell size={16} className="mr-2" />
                  Gatilhos
                </TabsTrigger>
                <TabsTrigger value="multi-sales" className={TAB_TRIGGER_CLASS}>
                  <Repeat size={16} className="mr-2" />
                  Multi-vendas
                </TabsTrigger>
                <TabsTrigger value="email-templates" className={TAB_TRIGGER_CLASS}>
                  <Mail size={16} className="mr-2" />
                  Modelos de e-mail
                </TabsTrigger>
                <TabsTrigger value="proposal-templates" className={TAB_TRIGGER_CLASS}>
                  <FileText size={16} className="mr-2" />
                  Modelos de proposta
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="qualification" className="p-6">
              <QualificationTab />
            </TabsContent>

            <TabsContent value="questionnaires" className="p-6">
              <QuestionnairesTab />
            </TabsContent>

            <TabsContent value="sources" className="space-y-6 p-6">
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
            </TabsContent>

            <TabsContent value="lost-reasons" className="p-6">
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
            </TabsContent>

            <TabsContent value="segments" className="p-6">
              <ConfigSection
                title="Segmentos de empresas"
                description="Segmentos configuráveis para classificar e filtrar empresas."
                placeholder="Novo segmento"
                api={segmentsApi}
              />
            </TabsContent>

            <TabsContent value="presets" className="p-6">
              <FieldPresetsTab />
            </TabsContent>

            <TabsContent value="triggers" className="p-6">
              <ManagerTriggersTab />
            </TabsContent>

            <TabsContent value="multi-sales" className="p-6">
              <SalesFlagsTab />
            </TabsContent>

            <TabsContent value="email-templates" className="p-6">
              <EmailTemplatesTab />
            </TabsContent>

            <TabsContent value="proposal-templates" className="p-6">
              <ProposalTemplatesTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
