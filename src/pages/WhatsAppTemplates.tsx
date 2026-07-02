import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  ArrowLeft,
  MessageSquare,
  Loader2,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  Copy,
} from 'lucide-react';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';
import { ScreenRibbon } from '@/contexts/RibbonContext';

interface WhatsAppConnection {
  id: string;
  name: string;
  provider: string;
  status: string;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components?: any[];
}

export function WhatsAppTemplates() {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (selectedConnectionId) {
      loadTemplates(selectedConnectionId);
    }
  }, [selectedConnectionId]);

  const loadConnections = async () => {
    try {
      const result = await apiClient.getWhatsAppConnections();
      const conns = (result?.data || result || []) as WhatsAppConnection[];
      setConnections(conns);
      const connected = conns.find((c) => c.status === 'CONNECTED') || conns[0];
      if (connected) setSelectedConnectionId(connected.id);
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async (connectionId: string) => {
    setLoadingTemplates(true);
    try {
      const result = await apiClient.getWhatsAppTemplates(connectionId);
      const data = result?.data || result || [];
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Erro ao carregar templates:', error);
      if (error.message?.includes('Official API')) {
        toast.error('Templates só estão disponíveis para conexões com a API Oficial do WhatsApp');
      } else {
        toast.error('Erro ao carregar templates');
      }
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return <CheckCircle size={14} className="text-green-600" />;
      case 'PENDING':
        return <Clock size={14} className="text-yellow-600" />;
      case 'REJECTED':
        return <XCircle size={14} className="text-red-600" />;
      default:
        return <Clock size={14} className="text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return 'Aprovado';
      case 'PENDING':
        return 'Pendente';
      case 'REJECTED':
        return 'Rejeitado';
      default:
        return status || 'Desconhecido';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return 'bg-green-100 text-green-700';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      case 'REJECTED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'MARKETING':
        return 'Marketing';
      case 'UTILITY':
        return 'Utilitário';
      case 'AUTHENTICATION':
        return 'Autenticação';
      default:
        return category || 'Outro';
    }
  };

  const getTemplateBody = (template: WhatsAppTemplate): string => {
    if (!template.components) return '';
    const body = template.components.find((c: any) => c.type === 'BODY');
    return body?.text || '';
  };

  const getTemplateHeader = (template: WhatsAppTemplate): string => {
    if (!template.components) return '';
    const header = template.components.find((c: any) => c.type === 'HEADER');
    return header?.text || '';
  };

  const copyTemplateName = (name: string) => {
    navigator.clipboard.writeText(name);
    toast.success('Nome do template copiado');
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Templates WhatsApp" subtitle="Gerencie seus templates de mensagem" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ScreenRibbon
        groups={[
          {
            label: 'Templates',
            items: [
              {
                icon: RefreshCw,
                label: 'Atualizar',
                onClick: () => selectedConnectionId && loadTemplates(selectedConnectionId),
                disabled: !selectedConnectionId || loadingTemplates,
              },
            ],
          },
        ]}
      />
      <Header title="Templates WhatsApp" subtitle="Gerencie seus templates de mensagem" />

      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={() => navigate('/app/settings')} className="gap-2">
            <ArrowLeft size={16} /> Voltar
          </Button>

          <div className="flex items-center gap-3">
            {connections.length > 0 && (
              <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Selecione uma conexão" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${conn.status === 'CONNECTED' ? 'bg-green-500' : 'bg-gray-400'}`}
                        />
                        {conn.name} ({conn.provider})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {connections.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-lg border border-gray-300">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma conexão WhatsApp</h3>
            <p className="text-gray-500 mb-4">
              Configure uma conexão WhatsApp nas Configurações para ver templates
            </p>
            <Button onClick={() => navigate('/app/settings')}>Ir para Configurações</Button>
          </div>
        ) : loadingTemplates ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
            <span className="text-gray-500">Buscando templates da API...</span>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-lg border border-gray-300">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum template encontrado</h3>
            <p className="text-gray-500 mb-4">
              Templates são gerenciados no painel do Meta Business Suite. Apenas conexões com a API
              Oficial do WhatsApp suportam templates.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-500">
              {templates.length} template{templates.length !== 1 ? 's' : ''} encontrado
              {templates.length !== 1 ? 's' : ''}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => {
                const body = getTemplateBody(template);
                const header = getTemplateHeader(template);

                return (
                  <div
                    key={template.id || template.name}
                    className="bg-card rounded-lg border border-gray-300 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-gray-900 text-sm">{template.name}</h3>
                        <button
                          onClick={() => copyTemplateName(template.name)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          title="Copiar nome do template"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(template.status)}`}
                        >
                          {getStatusIcon(template.status)}
                          {getStatusLabel(template.status)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {getCategoryLabel(template.category)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                          {template.language}
                        </span>
                      </div>
                    </div>

                    <div className="p-4">
                      {header && <p className="text-xs font-medium text-gray-700 mb-2">{header}</p>}
                      {body ? (
                        <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4">
                          {body}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Sem conteúdo de texto</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Dica:</strong> Para criar ou editar templates, acesse o{' '}
                <a
                  href="https://business.facebook.com/latest/whatsapp_manager/message_templates"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Meta Business Suite
                </a>
                . Os templates criados lá aparecerão automaticamente aqui após aprovação.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
