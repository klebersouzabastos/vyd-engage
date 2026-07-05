import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { SlackTeamsSection } from './SlackTeamsSection';
import { MeetingScheduleSection } from './MeetingScheduleSection';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Plus, HelpCircle, X, FileText, Copy, Key, Loader2, Bot, Sparkles } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useWhatsApp } from '../../contexts/WhatsAppContext';
import { useAIStatus } from '../../hooks/useAIStatus';
import { useEmail } from '../../contexts/EmailContext';
import { useAuth } from '../../contexts/AuthContext';
import { ConnectionCard } from '../whatsapp/ConnectionCard';
import { ConnectionForm } from '../whatsapp/ConnectionForm';
import { EmailConfigCard } from '../email/EmailConfigCard';
import { EmailConfigForm } from '../email/EmailConfigForm';
import { SignatureConfigCard } from '../integrations/SignatureConfigCard';
import { PhoneConfigCard } from '../integrations/PhoneConfigCard';

const scrollbarStyle = {
  scrollbarWidth: 'thin' as const,
  scrollbarColor: 'var(--vyd-border) var(--vyd-border)',
  overflowX: 'scroll' as const,
  overflowY: 'scroll' as const,
};

function WhatsAppHelpContent() {
  return (
    <div className="space-y-4 text-sm text-gray-900">
      <div>
        <h3 className="font-semibold mb-2">O que sao Conexoes WhatsApp?</h3>
        <p className="text-gray-600 mb-3">
          As conexoes WhatsApp permitem integrar o VYD Engage com WhatsApp para enviar e receber
          mensagens diretamente do CRM. Voce pode usar tanto a API oficial do WhatsApp Business
          quanto solucoes nao oficiais.
        </p>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Tipos de conexao disponiveis</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-600">
          <li>
            <strong>WhatsApp Business API (Oficial):</strong> Solucao oficial do Meta/Facebook para
            empresas. Requer aprovacao e tem custos por mensagem.
          </li>
          <li>
            <strong>Baileys:</strong> Biblioteca nao oficial que permite conectar usando WhatsApp
            Web.
          </li>
          <li>
            <strong>Evolution API:</strong> Solucao nao oficial que oferece API REST para WhatsApp.
          </li>
          <li>
            <strong>ChatAPI:</strong> Servico de terceiros que fornece API para WhatsApp.
          </li>
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Como funciona?</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-600">
          <li>Escolha o tipo de conexao que deseja usar</li>
          <li>Configure as credenciais necessarias (API Key, numero, token, etc.)</li>
          <li>Para conexoes nao oficiais, pode ser necessario escanear um QR Code</li>
          <li>Apos conectar, voce podera enviar mensagens para leads diretamente do CRM</li>
          <li>Mensagens recebidas aparecerao na timeline de interacoes do lead</li>
        </ol>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Como configurar?</h3>
        <div className="space-y-3 text-gray-600">
          <div>
            <p className="font-medium mb-1">WhatsApp Business API (Oficial):</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>
                Acesse o{' '}
                <a
                  href="https://business.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Facebook Business
                </a>
              </li>
              <li>Crie uma conta Business e configure o WhatsApp Business</li>
              <li>Obtenha o Access Token e numero de telefone</li>
              <li>Configure a URL de webhook para receber mensagens</li>
            </ol>
          </div>
          <div>
            <p className="font-medium mb-1">Conexoes nao oficiais:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Escolha o provedor (Baileys, Evolution API, ChatAPI)</li>
              <li>Configure o servidor ou instancia conforme a documentacao do provedor</li>
              <li>Obtenha as credenciais necessarias (API Key, URL do servidor, etc.)</li>
              <li>Para Baileys, escaneie o QR Code quando solicitado</li>
            </ol>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Vantagens</h3>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
          <li>Envio de mensagens em massa para campanhas</li>
          <li>Automacao de respostas e follow-ups</li>
          <li>Historico completo de conversas no CRM</li>
          <li>Integracao com automacoes e workflows</li>
          <li>Notificacoes em tempo real de novas mensagens</li>
        </ul>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-blue-900">Dica</h3>
        <p className="text-blue-800 text-sm">
          Para producao, recomendamos usar a API oficial do WhatsApp Business. Para testes e
          desenvolvimento, as solucoes nao oficiais podem ser mais rapidas de configurar.
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-yellow-900">Importante</h3>
        <ul className="text-yellow-800 text-sm space-y-1 list-disc list-inside">
          <li>Conexoes nao oficiais podem ser bloqueadas pelo WhatsApp</li>
          <li>Mantenha suas credenciais seguras e nao compartilhe com terceiros</li>
          <li>Respeite as politicas de uso do WhatsApp e evite spam</li>
          <li>Para WhatsApp Business API oficial, ha limites de mensagens e custos por mensagem</li>
        </ul>
      </div>
    </div>
  );
}

function EmailHelpContent() {
  return (
    <div className="space-y-4 text-sm text-gray-900">
      <div>
        <h3 className="font-semibold mb-2">O que e o Servico de Email?</h3>
        <p className="text-gray-600 mb-3">
          O servico de email permite configurar como o VYD Engage envia emails para seus leads e
          clientes. Voce pode usar SMTP tradicional ou APIs de servicos de email modernos.
        </p>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Tipos de configuracao disponiveis</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-600">
          <li>
            <strong>SMTP:</strong> Protocolo tradicional de email. Funciona com Gmail, Outlook,
            servidores proprios, etc.
          </li>
          <li>
            <strong>SendGrid:</strong> Servico de email transacional com API REST.
          </li>
          <li>
            <strong>Mailgun:</strong> Plataforma de email para desenvolvedores.
          </li>
          <li>
            <strong>Amazon SES:</strong> Servico de email da AWS.
          </li>
          <li>
            <strong>Resend:</strong> API moderna de email para desenvolvedores.
          </li>
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Como funciona?</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-600">
          <li>Configure uma ou mais contas de email no VYD Engage</li>
          <li>O sistema usara essas contas para enviar emails automaticos e campanhas</li>
          <li>Voce pode definir uma conta padrao para envios automaticos</li>
          <li>Multiplas contas permitem segmentacao por tipo de email ou remetente</li>
          <li>Os emails enviados sao registrados na timeline de interacoes do lead</li>
        </ol>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Como configurar SMTP?</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-600">
          <li>Escolha seu provedor de email (Gmail, Outlook, servidor proprio, etc.)</li>
          <li>
            Obtenha as configuracoes SMTP do seu provedor:
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
              <li>Servidor SMTP (ex: smtp.gmail.com)</li>
              <li>Porta (geralmente 587 para TLS ou 465 para SSL)</li>
              <li>Usuario e senha (ou senha de aplicativo)</li>
            </ul>
          </li>
          <li>
            Para Gmail, voce precisara criar uma "Senha de App" nas configuracoes de seguranca
          </li>
          <li>Preencha os campos no formulario e teste a conexao</li>
        </ol>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Como configurar APIs (SendGrid, Mailgun, etc.)?</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-600">
          <li>Crie uma conta no servico escolhido</li>
          <li>Gere uma API Key nas configuracoes da conta</li>
          <li>Configure o dominio de envio (verificacao DNS pode ser necessaria)</li>
          <li>Cole a API Key no VYD Engage e teste a conexao</li>
          <li>APIs geralmente oferecem melhor deliverability e analytics</li>
        </ol>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Vantagens de cada tipo</h3>
        <div className="space-y-2 text-gray-600">
          <div>
            <p className="font-medium">SMTP:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Facil de configurar</li>
              <li>Funciona com qualquer provedor</li>
              <li>Gratuito para volumes baixos</li>
            </ul>
          </div>
          <div>
            <p className="font-medium">APIs (SendGrid, Mailgun, etc.):</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Melhor deliverability</li>
              <li>Analytics detalhados</li>
              <li>Escalavel para grandes volumes</li>
              <li>Webhooks e eventos em tempo real</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-blue-900">Dica</h3>
        <p className="text-blue-800 text-sm">
          Para producao e grandes volumes, recomendamos usar APIs como SendGrid ou Mailgun. Para
          testes e volumes pequenos, SMTP pode ser suficiente.
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-yellow-900">Importante</h3>
        <ul className="text-yellow-800 text-sm space-y-1 list-disc list-inside">
          <li>Mantenha suas credenciais SMTP e API Keys seguras</li>
          <li>Para Gmail, use "Senha de App" ao inves da senha normal</li>
          <li>Respeite os limites de envio do seu provedor</li>
          <li>Configure SPF, DKIM e DMARC para melhor deliverability</li>
          <li>Evite spam e siga as melhores praticas de email marketing</li>
        </ul>
      </div>
    </div>
  );
}

function MetaLeadAdsSection() {
  return (
    <div className="p-4 rounded-lg border border-gray-300 opacity-50 pointer-events-none relative">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900">Meta Lead Ads</h4>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              Em breve
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Capture leads do Facebook e Instagram automaticamente com integracao direta
          </p>
        </div>
        <Button variant="outline" size="sm" disabled>
          Como configurar
        </Button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Enquanto isso, use a secao "Webhook para Captura" abaixo para receber leads do Meta via
        webhook.
      </p>
    </div>
  );
}

function GoogleLeadFormsSection() {
  return (
    <div className="p-4 rounded-lg border border-gray-300 opacity-50 pointer-events-none relative">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900">Google Lead Form Extensions</h4>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              Em breve
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Capture leads do Google Ads com integracao direta de formularios
          </p>
        </div>
        <Button variant="outline" size="sm" disabled>
          Como configurar
        </Button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Enquanto isso, use a secao "Webhook para Captura" abaixo para receber leads do Google Ads
        via webhook.
      </p>
    </div>
  );
}

function WebhookCaptureSection() {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const result = await apiClient.getApiKeys();
      const keys = result?.data || result || [];
      setApiKeys(Array.isArray(keys) ? keys : []);
    } catch {
      /* noop: falha ao carregar chaves não bloqueia a UI */
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    setCreating(true);
    try {
      const result = await apiClient.createApiKey({ name: 'Webhook Capture Key' });
      const data = result?.data || result;
      if (data?.fullKey) {
        setNewKeyValue(data.fullKey);
      }
      await loadApiKeys();
      toast.success('Chave API criada');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar chave');
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const activeKey = apiKeys.find((k) => k.active);
  const webhookUrl = activeKey ? `${apiUrl}/api/webhooks/capture/YOUR_API_KEY` : null;

  return (
    <div className="p-4 rounded-lg border border-gray-300">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900">Webhook para Captura</h4>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              Ativo
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Receba leads de qualquer fonte externa via webhook HTTP POST
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? 'Fechar' : 'Configurar'}
        </Button>
      </div>

      {showDetails && (
        <div className="mt-4 space-y-4">
          {/* API Key section */}
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Key size={14} /> Chave de API
            </h5>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : activeKey ? (
              <div className="flex items-center gap-2">
                <code className="text-xs bg-gray-100 px-3 py-1.5 rounded border border-gray-200 font-mono flex-1 truncate">
                  {activeKey.key}
                </code>
                <span className="text-xs text-green-600">Ativa</span>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateKey}
                disabled={creating}
                className="gap-2"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Criar Chave API
              </Button>
            )}
            {newKeyValue && (
              <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800 font-medium mb-1">
                  Copie sua chave agora — ela nao sera exibida novamente:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-card px-2 py-1 rounded border border-yellow-300 font-mono flex-1 break-all">
                    {newKeyValue}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newKeyValue, 'Chave API')}
                    className="p-1.5 rounded hover:bg-yellow-100"
                  >
                    <Copy size={14} className="text-yellow-700" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Webhook URL */}
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2">URL do Webhook</h5>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-gray-100 px-3 py-1.5 rounded border border-gray-200 font-mono flex-1 truncate">
                POST {apiUrl}/api/webhooks/capture/&#123;sua_api_key&#125;
              </code>
              {webhookUrl && (
                <button
                  onClick={() => copyToClipboard(webhookUrl, 'URL')}
                  className="p-1.5 rounded hover:bg-gray-100"
                >
                  <Copy size={14} className="text-gray-500" />
                </button>
              )}
            </div>
          </div>

          {/* Payload format */}
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2">Formato do Payload (JSON)</h5>
            <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto font-mono text-gray-700">
              {`{
  "name": "Nome do Lead",
  "email": "email@exemplo.com",
  "phone": "(11) 99999-0000",
  "company": "Empresa",
  "position": "Cargo",
  "source": "WEBSITE",
  "notes": "Observacoes"
}`}
            </pre>
            <p className="text-xs text-gray-500 mt-2">
              Campos aceitos: name (obrigatorio), email, phone/telefone, company/empresa,
              position/cargo, source, notes/observacao
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Copiloto IA via WhatsApp — configuração (Upgrade RD P3, req 25).
 *
 * Designa UMA conexão WhatsApp do tenant como o "número do Copiloto IA": mensagens
 * enviadas a esse número são respondidas pela IA (leitura de tarefas/deals; escrita
 * só após confirmação). Regras desta UI:
 *   - GATING GRACIOSO: só faz sentido com IA configurada (useAIStatus). Sem IA →
 *     seção explica que é preciso configurar o provedor de IA e desabilita os toggles.
 *   - Só 1 conexão por tenant pode ser o copiloto — ligar uma desliga a anterior.
 *   - Sem conexões WhatsApp → orienta a criar uma conexão primeiro.
 *
 * Lê o estado real (`isCopilot`) direto de `apiClient.getWhatsAppConnections()` (o raw
 * da API traz o campo; o contexto tipado ainda não o expõe) e alterna via
 * `apiClient.updateWhatsAppConnection(id, { name, provider, config, isCopilot })` —
 * o PUT /whatsapp/:id exige o payload completo da conexão (schema não-parcial).
 */
interface RawWhatsAppConnection {
  id: string;
  name: string;
  provider: string;
  config?: unknown;
  status?: string;
  isCopilot?: boolean;
}

function WhatsAppCopilotSection() {
  const { enabled: aiEnabled, loading: aiLoading } = useAIStatus();
  const { user } = useAuth();
  // Só ADMIN pode designar a conexão do copiloto — o backend (PUT /whatsapp/:id)
  // rejeita isCopilot de não-ADMIN com 403. Espelhamos essa regra aqui: não-admin
  // vê a seção (para entender o recurso) mas com o Switch desabilitado.
  const isAdmin = user?.role === 'ADMIN';
  const [connections, setConnections] = useState<RawWhatsAppConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = (await apiClient.getWhatsAppConnections()) as unknown as RawWhatsAppConnection[];
      setConnections(Array.isArray(result) ? result : []);
    } catch {
      /* silencioso: falha ao carregar não bloqueia o restante das integrações */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (conn: RawWhatsAppConnection, next: boolean) => {
    // Guarda extra: o backend só permite ADMIN alterar isCopilot (403). Evita a
    // chamada que resultaria em erro para não-admin, mesmo que o Switch seja acionado.
    if (!isAdmin) return;
    setSavingId(conn.id);
    try {
      // Só 1 por tenant: ao ligar uma, desliga qualquer outra atualmente ativa.
      if (next) {
        const previous = connections.find((c) => c.isCopilot && c.id !== conn.id);
        if (previous) {
          await apiClient.updateWhatsAppConnection(previous.id, {
            name: previous.name,
            provider: previous.provider,
            config: previous.config ?? {},
            isCopilot: false,
          });
        }
      }
      await apiClient.updateWhatsAppConnection(conn.id, {
        name: conn.name,
        provider: conn.provider,
        config: conn.config ?? {},
        isCopilot: next,
      });
      toast.success(
        next
          ? `"${conn.name}" agora é o número do Copiloto IA`
          : `Copiloto desativado em "${conn.name}"`
      );
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar o Copiloto IA');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-border">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Bot size={16} className="text-primary" />
            <h4 className="font-medium text-foreground">Copiloto IA no WhatsApp</h4>
            {aiEnabled && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                IA ativa
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Escolha uma conexão WhatsApp como número do Copiloto IA. Mensagens enviadas a esse
            número são interpretadas pela IA — ela consulta suas tarefas e negócios e propõe ações
            (a escrita só acontece após você confirmar). Apenas um número por conta.
          </p>
        </div>
      </div>

      {aiLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : !aiEnabled ? (
        <div className="flex items-start gap-2 bg-muted border border-border rounded-lg p-3">
          <Sparkles size={16} className="text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Configure um provedor de IA (OpenAI ou Anthropic) para habilitar o Copiloto. Enquanto a
            IA não estiver configurada, o número do copiloto fica indisponível.
          </p>
        </div>
      ) : loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : connections.length === 0 ? (
        <div className="p-4 bg-muted rounded-lg text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma conexão WhatsApp configurada. Crie uma conexão acima para poder designar o
            número do Copiloto IA.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{conn.name}</p>
                <p className="text-xs text-muted-foreground">
                  {conn.isCopilot ? 'Respondendo como Copiloto IA' : 'Conexão normal de mensagens'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {savingId === conn.id && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <Switch
                  checked={!!conn.isCopilot}
                  disabled={!isAdmin || savingId !== null}
                  onCheckedChange={(v) => handleToggle(conn, v)}
                  aria-label={`Usar "${conn.name}" como número do Copiloto IA`}
                />
              </div>
            </div>
          ))}
          {isAdmin ? (
            <p className="text-xs text-muted-foreground">
              Dica: use um número dedicado ao Copiloto. Só usuários com o próprio número cadastrado
              no perfil conseguem comandar a IA por ele.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Apenas administradores podem designar o número do Copiloto IA. Fale com um
              administrador da conta para ativar ou trocar esse número.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function IntegrationsTab() {
  const navigate = useNavigate();
  const {
    connections,
    addConnection,
    updateConnection,
    deleteConnection,
    setDefaultConnection,
    planLimits,
    canAddConnection,
  } = useWhatsApp();
  const {
    configs: emailConfigs,
    addEmailConfig,
    updateEmailConfig,
    deleteEmailConfig,
    setDefaultEmailConfig,
    planLimits: emailPlanLimits,
    canAddEmailConfig,
  } = useEmail();
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [isAddingEmailConfig, setIsAddingEmailConfig] = useState(false);
  const [editingEmailConfigId, setEditingEmailConfigId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Meta Lead Ads */}
      <MetaLeadAdsSection />

      {/* Google Lead Form Extensions */}
      <GoogleLeadFormsSection />

      {/* WhatsApp Connections */}
      <div className="p-4 rounded-lg border border-gray-300">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900">Conexoes WhatsApp</h4>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="text-gray-600 hover:text-primary transition-colors"
                  >
                    <HelpCircle size={16} className="cursor-pointer" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[500px] max-h-[600px] overflow-y-scroll overflow-x-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:hover:bg-gray-400 [&::-webkit-scrollbar-thumb]:min-h-[50px] [&::-webkit-scrollbar-thumb]:min-w-[50px]"
                  style={scrollbarStyle}
                  align="start"
                  side="right"
                >
                  <div className="space-y-4 pr-2">
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-gray-900">
                        Como funciona as Conexoes WhatsApp
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Entenda como integrar e usar WhatsApp no VYD Engage para enviar e receber
                        mensagens
                      </p>
                    </div>
                    <WhatsAppHelpContent />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-sm text-gray-600">
              Gerencie suas integracoes com WhatsApp (Oficial e nao oficial)
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {connections.length} /{' '}
              {planLimits.maxConnections === Infinity ? 'ilimitado' : planLimits.maxConnections}{' '}
              conexoes
            </p>
          </div>
          <div className="flex items-center gap-2">
            {connections.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/app/whatsapp/templates')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Templates
              </Button>
            )}
            {canAddConnection() && !isAddingConnection && !editingConnectionId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddingConnection(true);
                  setEditingConnectionId(null);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Conexao
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            {connections.length > 0
              ? connections.map((connection) => (
                  <ConnectionCard
                    key={connection.id}
                    connection={connection}
                    onEdit={() => {
                      setEditingConnectionId(connection.id);
                      setIsAddingConnection(false);
                    }}
                    onDelete={async () => {
                      await deleteConnection(connection.id);
                      if (editingConnectionId === connection.id) {
                        setEditingConnectionId(null);
                      }
                    }}
                    onSetDefault={async () => {
                      await setDefaultConnection(connection.id);
                    }}
                  />
                ))
              : !isAddingConnection &&
                !editingConnectionId && (
                  <div className="p-4 bg-gray-100 rounded-lg text-center">
                    <p className="text-sm text-gray-600">Nenhuma conexao configurada</p>
                  </div>
                )}
          </div>

          {(isAddingConnection || editingConnectionId) && (
            <div className="lg:border-l lg:pl-6 lg:border-gray-300">
              <div className="sticky top-4">
                <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-900">
                      {isAddingConnection ? 'Nova Conexao WhatsApp' : 'Editar Conexao'}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsAddingConnection(false);
                        setEditingConnectionId(null);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <ConnectionForm
                    connection={
                      editingConnectionId
                        ? connections.find((c) => c.id === editingConnectionId)
                        : undefined
                    }
                    onSubmit={async (data) => {
                      if (editingConnectionId) {
                        await updateConnection(editingConnectionId, data);
                        setEditingConnectionId(null);
                      } else {
                        await addConnection(data);
                        setIsAddingConnection(false);
                      }
                    }}
                    onCancel={() => {
                      setIsAddingConnection(false);
                      setEditingConnectionId(null);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Copiloto IA no WhatsApp (req 25) — gated por useAIStatus */}
      <WhatsAppCopilotSection />

      {/* Email Service */}
      <div className="p-4 rounded-lg border border-gray-300">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900">Servico de Email</h4>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="text-gray-600 hover:text-primary transition-colors"
                  >
                    <HelpCircle size={16} className="cursor-pointer" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[500px] max-h-[600px] overflow-y-scroll overflow-x-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:hover:bg-gray-400 [&::-webkit-scrollbar-thumb]:min-h-[50px] [&::-webkit-scrollbar-thumb]:min-w-[50px]"
                  style={scrollbarStyle}
                  align="start"
                  side="right"
                >
                  <div className="space-y-4 pr-2">
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-gray-900">
                        Como funciona o Servico de Email
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Entenda como configurar e usar servicos de email no VYD Engage
                      </p>
                    </div>
                    <EmailHelpContent />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-sm text-gray-600">
              Configure seu servico de envio de emails (SMTP ou APIs)
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {emailConfigs.length} /{' '}
              {emailPlanLimits.maxConfigs === Infinity ? 'ilimitado' : emailPlanLimits.maxConfigs}{' '}
              configuracoes
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canAddEmailConfig() && !isAddingEmailConfig && !editingEmailConfigId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddingEmailConfig(true);
                  setEditingEmailConfigId(null);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Configuracao
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/app/email/campaigns')}>
              <FileText className="h-4 w-4 mr-2" />
              Campanhas
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            {emailConfigs.length > 0
              ? emailConfigs.map((config) => (
                  <EmailConfigCard
                    key={config.id}
                    config={config}
                    onEdit={() => {
                      setEditingEmailConfigId(config.id);
                      setIsAddingEmailConfig(false);
                    }}
                    onDelete={async () => {
                      await deleteEmailConfig(config.id);
                      if (editingEmailConfigId === config.id) {
                        setEditingEmailConfigId(null);
                      }
                    }}
                    onSetDefault={async () => {
                      await setDefaultEmailConfig(config.id);
                    }}
                  />
                ))
              : !isAddingEmailConfig &&
                !editingEmailConfigId && (
                  <div className="p-4 bg-gray-100 rounded-lg text-center">
                    <p className="text-sm text-gray-600">
                      Nenhuma configuracao de email configurada
                    </p>
                  </div>
                )}
          </div>

          {(isAddingEmailConfig || editingEmailConfigId) && (
            <div className="lg:border-l lg:pl-6 lg:border-gray-300">
              <div className="sticky top-4">
                <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-900">
                      {isAddingEmailConfig ? 'Nova Configuracao de Email' : 'Editar Configuracao'}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsAddingEmailConfig(false);
                        setEditingEmailConfigId(null);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <EmailConfigForm
                    config={
                      editingEmailConfigId
                        ? emailConfigs.find((c) => c.id === editingEmailConfigId)
                        : undefined
                    }
                    onSubmit={async (data) => {
                      if (editingEmailConfigId) {
                        await updateEmailConfig(editingEmailConfigId, data);
                        setEditingEmailConfigId(null);
                      } else {
                        await addEmailConfig(data);
                        setIsAddingEmailConfig(false);
                      }
                    }}
                    onCancel={() => {
                      setIsAddingEmailConfig(false);
                      setEditingEmailConfigId(null);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assinatura eletrônica (ZapSign) — gated (req 19) */}
      <SignatureConfigCard />

      {/* Telefone virtual (Twilio) — gated (req 21) */}
      <PhoneConfigCard />

      {/* Webhook */}
      <WebhookCaptureSection />

      {/* Slack / MS Teams */}
      <SlackTeamsSection />

      {/* Meeting Scheduling */}
      <MeetingScheduleSection />
    </div>
  );
}
