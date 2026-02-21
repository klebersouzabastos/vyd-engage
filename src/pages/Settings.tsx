import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Bell, Building2, Plug, CreditCard, CheckCircle, XCircle, Upload, X, Tag, MessageSquare, Plus, HelpCircle, Edit2, Trash2 } from "lucide-react";
import { Switch } from "../components/ui/switch";
import { useCompany } from "../contexts/CompanyContext";
import { TagManager } from "../components/TagManager";
import { resizeImage, isValidImageFile, isValidFileSize } from "../utils/imageUtils";
import { useWhatsApp } from "../contexts/WhatsAppContext";
import { ConnectionCard } from "../components/whatsapp/ConnectionCard";
import { ConnectionForm } from "../components/whatsapp/ConnectionForm";
import { WhatsAppConnection } from "../types/whatsapp";
import { useEmail } from "../contexts/EmailContext";
import { EmailConfigCard } from "../components/email/EmailConfigCard";
import { EmailConfigForm } from "../components/email/EmailConfigForm";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { usePlan } from "../contexts/PlanContext";
import { usePayment } from "../contexts/PaymentContext";
import { PlanType } from "../types/plan";
import { PaymentModal } from "../components/payment/PaymentModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { useCustomFields } from "../contexts/CustomFieldsContext";
import { CustomFieldEditor } from "../components/CustomFieldEditor";
import { CustomField } from "../types";

// Estilo para barras de rolagem customizadas
const scrollbarStyle = {
  scrollbarWidth: 'thin' as const,
  scrollbarColor: '#cbd5e1 #f3f4f6',
  // Garantir que as barras sejam sempre visíveis
  overflowX: 'scroll' as const,
  overflowY: 'scroll' as const,
};

// Ordem dos planos para comparação
const planOrder: PlanType[] = ["starter", "pro", "enterprise"];

export function Settings() {
  const { logo, companyName, setLogo, setCompanyName } = useCompany();
  const { connections, addConnection, updateConnection, deleteConnection, setDefaultConnection, planLimits, canAddConnection } = useWhatsApp();
  const { configs: emailConfigs, addEmailConfig, updateEmailConfig, deleteEmailConfig, setDefaultEmailConfig, planLimits: emailPlanLimits, canAddEmailConfig } = useEmail();
  const { fields: customFields, createField, updateField, deleteField } = useCustomFields();
  const { 
    currentPlan, 
    plans, 
    planLimits: currentPlanLimits, 
    planUsage, 
    subscription, 
    paymentHistory, 
    changePlan,
    changePlanWithPayment,
    getPlan, 
    canUpgrade, 
    canDowngrade 
  } = usePlan();
  const { validateUpgrade, currentPaymentIntent } = usePayment();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "company";
  const [logoPreview, setLogoPreview] = useState<string | null>(logo);
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [isAddingEmailConfig, setIsAddingEmailConfig] = useState(false);
  const [editingEmailConfigId, setEditingEmailConfigId] = useState<string | null>(null);
  const [isCreatingCustomField, setIsCreatingCustomField] = useState(false);
  const [editingCustomFieldId, setEditingCustomFieldId] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState({
    name: companyName,
    website: "https://minhaempresa.com",
    primaryColor: "#2563EB",
  });
  const [planChangeModalOpen, setPlanChangeModalOpen] = useState(false);
  const [selectedPlanToChange, setSelectedPlanToChange] = useState<PlanType | null>(null);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  useEffect(() => {
    setLogoPreview(logo);
  }, [logo]);

  useEffect(() => {
    setCompanyData(prev => ({ ...prev, name: companyName }));
  }, [companyName]);



  // Função para renderizar conteúdo de ajuda do WhatsApp
  const renderWhatsAppHelpContent = () => {
    return (
      <div className="space-y-4 text-sm text-[#1F2937]">
        <div>
          <h3 className="font-semibold mb-2">O que são Conexões WhatsApp?</h3>
          <p className="text-[#6B7280] mb-3">
            As conexões WhatsApp permitem integrar o FlowCRM com WhatsApp para enviar e receber mensagens diretamente do CRM. 
            Você pode usar tanto a API oficial do WhatsApp Business quanto soluções não oficiais.
          </p>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Tipos de conexão disponíveis</h3>
          <ul className="list-disc list-inside space-y-2 text-[#6B7280]">
            <li><strong>WhatsApp Business API (Oficial):</strong> Solução oficial do Meta/Facebook para empresas. Requer aprovação e tem custos por mensagem.</li>
            <li><strong>Baileys:</strong> Biblioteca não oficial que permite conectar usando WhatsApp Web.</li>
            <li><strong>Evolution API:</strong> Solução não oficial que oferece API REST para WhatsApp.</li>
            <li><strong>ChatAPI:</strong> Serviço de terceiros que fornece API para WhatsApp.</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Como funciona?</h3>
          <ol className="list-decimal list-inside space-y-2 text-[#6B7280]">
            <li>Escolha o tipo de conexão que deseja usar</li>
            <li>Configure as credenciais necessárias (API Key, número, token, etc.)</li>
            <li>Para conexões não oficiais, pode ser necessário escanear um QR Code</li>
            <li>Após conectar, você poderá enviar mensagens para leads diretamente do CRM</li>
            <li>Mensagens recebidas aparecerão na timeline de interações do lead</li>
          </ol>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Como configurar?</h3>
          <div className="space-y-3 text-[#6B7280]">
            <div>
              <p className="font-medium mb-1">WhatsApp Business API (Oficial):</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Acesse o <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline">Facebook Business</a></li>
                <li>Crie uma conta Business e configure o WhatsApp Business</li>
                <li>Obtenha o Access Token e número de telefone</li>
                <li>Configure a URL de webhook para receber mensagens</li>
              </ol>
            </div>
            <div>
              <p className="font-medium mb-1">Conexões não oficiais:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Escolha o provedor (Baileys, Evolution API, ChatAPI)</li>
                <li>Configure o servidor ou instância conforme a documentação do provedor</li>
                <li>Obtenha as credenciais necessárias (API Key, URL do servidor, etc.)</li>
                <li>Para Baileys, escaneie o QR Code quando solicitado</li>
              </ol>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Vantagens</h3>
          <ul className="list-disc list-inside space-y-1 text-[#6B7280]">
            <li>Envio de mensagens em massa para campanhas</li>
            <li>Automação de respostas e follow-ups</li>
            <li>Histórico completo de conversas no CRM</li>
            <li>Integração com automações e workflows</li>
            <li>Notificações em tempo real de novas mensagens</li>
          </ul>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-blue-900">💡 Dica</h3>
          <p className="text-blue-800 text-sm">
            Para produção, recomendamos usar a API oficial do WhatsApp Business. 
            Para testes e desenvolvimento, as soluções não oficiais podem ser mais rápidas de configurar.
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-yellow-900">⚠️ Importante</h3>
          <ul className="text-yellow-800 text-sm space-y-1 list-disc list-inside">
            <li>Conexões não oficiais podem ser bloqueadas pelo WhatsApp</li>
            <li>Mantenha suas credenciais seguras e não compartilhe com terceiros</li>
            <li>Respeite as políticas de uso do WhatsApp e evite spam</li>
            <li>Para WhatsApp Business API oficial, há limites de mensagens e custos por mensagem</li>
          </ul>
        </div>
      </div>
    );
  };

  // Função para renderizar conteúdo de ajuda do Email Service
  const renderEmailHelpContent = () => {
    return (
      <div className="space-y-4 text-sm text-[#1F2937]">
        <div>
          <h3 className="font-semibold mb-2">O que é o Serviço de Email?</h3>
          <p className="text-[#6B7280] mb-3">
            O serviço de email permite configurar como o FlowCRM envia emails para seus leads e clientes. 
            Você pode usar SMTP tradicional ou APIs de serviços de email modernos.
          </p>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Tipos de configuração disponíveis</h3>
          <ul className="list-disc list-inside space-y-2 text-[#6B7280]">
            <li><strong>SMTP:</strong> Protocolo tradicional de email. Funciona com Gmail, Outlook, servidores próprios, etc.</li>
            <li><strong>SendGrid:</strong> Serviço de email transacional com API REST.</li>
            <li><strong>Mailgun:</strong> Plataforma de email para desenvolvedores.</li>
            <li><strong>Amazon SES:</strong> Serviço de email da AWS.</li>
            <li><strong>Resend:</strong> API moderna de email para desenvolvedores.</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Como funciona?</h3>
          <ol className="list-decimal list-inside space-y-2 text-[#6B7280]">
            <li>Configure uma ou mais contas de email no FlowCRM</li>
            <li>O sistema usará essas contas para enviar emails automáticos e campanhas</li>
            <li>Você pode definir uma conta padrão para envios automáticos</li>
            <li>Múltiplas contas permitem segmentação por tipo de email ou remetente</li>
            <li>Os emails enviados são registrados na timeline de interações do lead</li>
          </ol>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Como configurar SMTP?</h3>
          <ol className="list-decimal list-inside space-y-2 text-[#6B7280]">
            <li>Escolha seu provedor de email (Gmail, Outlook, servidor próprio, etc.)</li>
            <li>Obtenha as configurações SMTP do seu provedor:
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>Servidor SMTP (ex: smtp.gmail.com)</li>
                <li>Porta (geralmente 587 para TLS ou 465 para SSL)</li>
                <li>Usuário e senha (ou senha de aplicativo)</li>
              </ul>
            </li>
            <li>Para Gmail, você precisará criar uma "Senha de App" nas configurações de segurança</li>
            <li>Preencha os campos no formulário e teste a conexão</li>
          </ol>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Como configurar APIs (SendGrid, Mailgun, etc.)?</h3>
          <ol className="list-decimal list-inside space-y-2 text-[#6B7280]">
            <li>Crie uma conta no serviço escolhido</li>
            <li>Gere uma API Key nas configurações da conta</li>
            <li>Configure o domínio de envio (verificação DNS pode ser necessária)</li>
            <li>Cole a API Key no FlowCRM e teste a conexão</li>
            <li>APIs geralmente oferecem melhor deliverability e analytics</li>
          </ol>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Vantagens de cada tipo</h3>
          <div className="space-y-2 text-[#6B7280]">
            <div>
              <p className="font-medium">SMTP:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Fácil de configurar</li>
                <li>Funciona com qualquer provedor</li>
                <li>Gratuito para volumes baixos</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">APIs (SendGrid, Mailgun, etc.):</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Melhor deliverability</li>
                <li>Analytics detalhados</li>
                <li>Escalável para grandes volumes</li>
                <li>Webhooks e eventos em tempo real</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-blue-900">💡 Dica</h3>
          <p className="text-blue-800 text-sm">
            Para produção e grandes volumes, recomendamos usar APIs como SendGrid ou Mailgun. 
            Para testes e volumes pequenos, SMTP pode ser suficiente.
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-yellow-900">⚠️ Importante</h3>
          <ul className="text-yellow-800 text-sm space-y-1 list-disc list-inside">
            <li>Mantenha suas credenciais SMTP e API Keys seguras</li>
            <li>Para Gmail, use "Senha de App" ao invés da senha normal</li>
            <li>Respeite os limites de envio do seu provedor</li>
            <li>Configure SPF, DKIM e DMARC para melhor deliverability</li>
            <li>Evite spam e siga as melhores práticas de email marketing</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <Header title="Configurações" subtitle="Gerencie as configurações da sua conta" />
      
      <div className="p-8">
        <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB]">
          <Tabs 
            value={activeTab} 
            onValueChange={(value) => {
              setSearchParams({ tab: value });
            }}
            className="w-full"
          >
            <div className="border-b border-[#E5E7EB] px-6">
              <TabsList className="bg-transparent h-auto p-0 gap-8">
                <TabsTrigger 
                  value="company"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#2563EB] rounded-none pb-4 px-0"
                >
                  <Building2 size={16} className="mr-2" />
                  Empresa
                </TabsTrigger>
                <TabsTrigger 
                  value="notifications"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#2563EB] rounded-none pb-4 px-0"
                >
                  <Bell size={16} className="mr-2" />
                  Notificações
                </TabsTrigger>
                <TabsTrigger 
                  value="integrations"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#2563EB] rounded-none pb-4 px-0"
                >
                  <Plug size={16} className="mr-2" />
                  Integrações
                </TabsTrigger>
                <TabsTrigger 
                  value="billing"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#2563EB] rounded-none pb-4 px-0"
                >
                  <CreditCard size={16} className="mr-2" />
                  Planos
                </TabsTrigger>
                <TabsTrigger 
                  value="tags"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#2563EB] rounded-none pb-4 px-0"
                >
                  <Tag size={16} className="mr-2" />
                  Tags
                </TabsTrigger>
                <TabsTrigger 
                  value="custom-fields"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#2563EB] rounded-none pb-4 px-0"
                >
                  <Tag size={16} className="mr-2" />
                  Campos Customizados
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="p-6">
              <div className="max-w-2xl space-y-6">
                <div>
                  <h3 className="text-[#1F2937] mb-4">Preferências de Notificação</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[#1F2937]">Novos leads</p>
                        <p className="text-sm text-[#6B7280]">Receber notificações por e-mail quando novos leads são capturados</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[#1F2937]">Automações</p>
                        <p className="text-sm text-[#6B7280]">Alertas de automações falhadas ou concluídas</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[#1F2937]">Relatórios</p>
                        <p className="text-sm text-[#6B7280]">Relatório semanal por e-mail com estatísticas</p>
                      </div>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[#1F2937]">Atualizações do sistema</p>
                        <p className="text-sm text-[#6B7280]">Notificações sobre novas funcionalidades e atualizações</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[#E5E7EB]">
                  <Button className="bg-[#2563EB] hover:bg-[#1E40AF]">
                    Salvar Preferências
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Company Tab */}
            <TabsContent value="company" className="p-6">
              <div className="max-w-2xl space-y-6">
                <div>
                  <h3 className="text-[#1F2937] mb-4">Dados da Empresa</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="company-name">Nome da empresa</Label>
                      <Input
                        id="company-name"
                        value={companyData.name}
                        onChange={(e) => {
                          setCompanyData({ ...companyData, name: e.target.value });
                          setCompanyName(e.target.value);
                        }}
                        className="mt-1.5"
                        placeholder="Nome da sua empresa"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company-website">Website</Label>
                      <Input
                        id="company-website"
                        defaultValue="https://minhaempresa.com"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="logo">Logo da empresa</Label>
                      <div className="mt-1.5 space-y-3">
                        {logoPreview && (
                          <div className="relative inline-block">
                            <div className="w-32 h-32 border-2 border-[#E5E7EB] rounded-lg p-2 bg-white flex items-center justify-center">
                              <img 
                                src={logoPreview} 
                                alt="Logo da empresa" 
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                            <button
                              onClick={() => {
                                setLogoPreview(null);
                                setLogo(null);
                              }}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                        <div className="flex flex-col gap-2">
                          <input
                            id="logo-upload"
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              // Validar tipo de arquivo
                              if (!isValidImageFile(file)) {
                                alert('Por favor, selecione uma imagem válida (PNG, JPG ou SVG)');
                                e.target.value = '';
                                return;
                              }
                              
                              // Validar tamanho (máximo 5MB antes do redimensionamento)
                              if (!isValidFileSize(file, 5)) {
                                alert('A imagem deve ter no máximo 5MB');
                                e.target.value = '';
                                return;
                              }

                              try {
                                // Redimensionar a imagem para tamanho adequado (200x200px máximo)
                                // Isso garante que a imagem seja otimizada para uso no sidebar e relatórios
                                const resizedImage = await resizeImage(file, 200, 200, 0.9);
                                
                                if (resizedImage && resizedImage.length > 0) {
                                  setLogoPreview(resizedImage);
                                  setLogo(resizedImage);
                                  console.log('Logo atualizado e redimensionado com sucesso');
                                } else {
                                  alert('Erro ao processar a imagem. Tente novamente.');
                                }
                              } catch (error) {
                                console.error('Erro ao processar logo:', error);
                                alert('Erro ao processar a imagem. Tente novamente.');
                              }
                              
                              // Resetar o input para permitir selecionar o mesmo arquivo novamente
                              e.target.value = '';
                            }}
                          />
                          <label 
                            htmlFor="logo-upload" 
                            className="cursor-pointer inline-block"
                            onClick={(e) => {
                              // Garantir que o clique no label abra o input
                              e.preventDefault();
                              document.getElementById('logo-upload')?.click();
                            }}
                          >
                            <Button variant="outline" type="button" className="gap-2">
                              <Upload size={16} />
                              {logoPreview ? "Alterar Logo" : "Upload de Logo"}
                            </Button>
                          </label>
                        </div>
                        <p className="text-xs text-[#6B7280]">
                          Formatos aceitos: PNG, JPG, SVG. Tamanho máximo: 2MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[#E5E7EB]">
                  <h3 className="text-[#1F2937] mb-4">Cores da Marca</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="primary-color">Cor primária</Label>
                      <div className="flex items-center gap-3 mt-1.5">
                        <Input
                          id="primary-color"
                          type="color"
                          defaultValue="#2563EB"
                          className="w-20 h-10 p-1"
                        />
                        <Input
                          defaultValue="#2563EB"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[#E5E7EB]">
                  <Button 
                    className="bg-[#2563EB] hover:bg-[#1E40AF]"
                    onClick={() => {
                      // Salvar logo se houver preview (já foi salvo automaticamente, mas garantimos aqui também)
                      if (logoPreview && logoPreview !== logo) {
                        setLogo(logoPreview);
                      }
                      // Salvar nome da empresa
                      if (companyData.name !== companyName) {
                        setCompanyName(companyData.name);
                      }
                      alert("Configurações salvas com sucesso!");
                    }}
                  >
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Integrations Tab */}
            <TabsContent value="integrations" className="p-6">
              <div className="space-y-6">
                {/* Meta Lead Ads — Em breve */}
                <div className="p-4 rounded-lg border border-[#E5E7EB] opacity-60">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-[#1F2937]">Meta Lead Ads</h4>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                          Em breve
                        </span>
                      </div>
                      <p className="text-sm text-[#6B7280]">Capture leads do Facebook e Instagram automaticamente</p>
                    </div>
                  </div>
                </div>

                {/* Google Lead Form Extensions — Em breve */}
                <div className="p-4 rounded-lg border border-[#E5E7EB] opacity-60">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-[#1F2937]">Google Lead Form Extensions</h4>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                          Em breve
                        </span>
                      </div>
                      <p className="text-sm text-[#6B7280]">Capture leads do Google Ads com extensões de formulário</p>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Connections */}
                <div className="p-4 rounded-lg border border-[#E5E7EB]">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-[#1F2937]">Conexões WhatsApp</h4>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="text-[#6B7280] hover:text-[#2563EB] transition-colors"
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
                                <h3 className="font-semibold text-lg mb-2 text-[#1F2937]">Como funciona as Conexões WhatsApp</h3>
                                <p className="text-sm text-[#6B7280] mb-4">
                                  Entenda como integrar e usar WhatsApp no FlowCRM para enviar e receber mensagens
                                </p>
                              </div>
                              {renderWhatsAppHelpContent()}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <p className="text-sm text-[#6B7280]">
                        Gerencie suas integrações com WhatsApp (Oficial e não oficial)
                      </p>
                      <p className="text-xs text-[#6B7280] mt-1">
                        {connections.length} / {planLimits.maxConnections === Infinity ? "ilimitado" : planLimits.maxConnections} conexões
                      </p>
                    </div>
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
                        Adicionar Conexão
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Lista de Conexões */}
                    <div className="space-y-3">
                      {connections.length > 0 ? (
                        connections.map((connection) => (
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
                      ) : (
                        !isAddingConnection && !editingConnectionId && (
                          <div className="p-4 bg-[#F9FAFB] rounded-lg text-center">
                            <p className="text-sm text-[#6B7280]">
                              Nenhuma conexão configurada
                            </p>
                          </div>
                        )
                      )}
                    </div>

                    {/* Formulário de Adicionar/Editar */}
                    {(isAddingConnection || editingConnectionId) && (
                      <div className="lg:border-l lg:pl-6 lg:border-[#E5E7EB]">
                        <div className="sticky top-4">
                          <div className="p-4 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-medium text-[#1F2937]">
                                {isAddingConnection ? "Nova Conexão WhatsApp" : "Editar Conexão"}
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
                              connection={editingConnectionId ? connections.find(c => c.id === editingConnectionId) : undefined}
                              onSubmit={async (data) => {
                                try {
                                  if (editingConnectionId) {
                                    await updateConnection(editingConnectionId, data);
                                    setEditingConnectionId(null);
                                  } else {
                                    await addConnection(data);
                                    setIsAddingConnection(false);
                                  }
                                } catch (error) {
                                  throw error;
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

                {/* Email Service */}
                <div className="p-4 rounded-lg border border-[#E5E7EB]">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-[#1F2937]">Serviço de Email</h4>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="text-[#6B7280] hover:text-[#2563EB] transition-colors"
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
                                <h3 className="font-semibold text-lg mb-2 text-[#1F2937]">Como funciona o Serviço de Email</h3>
                                <p className="text-sm text-[#6B7280] mb-4">
                                  Entenda como configurar e usar serviços de email no FlowCRM
                                </p>
                              </div>
                              {renderEmailHelpContent()}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <p className="text-sm text-[#6B7280]">
                        Configure seu serviço de envio de emails (SMTP ou APIs)
                      </p>
                      <p className="text-xs text-[#6B7280] mt-1">
                        {emailConfigs.length} / {emailPlanLimits.maxConfigs === Infinity ? "ilimitado" : emailPlanLimits.maxConfigs} configurações
                      </p>
                    </div>
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
                        Adicionar Configuração
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Lista de Configurações */}
                    <div className="space-y-3">
                      {emailConfigs.length > 0 ? (
                        emailConfigs.map((config) => (
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
                      ) : (
                        !isAddingEmailConfig && !editingEmailConfigId && (
                          <div className="p-4 bg-[#F9FAFB] rounded-lg text-center">
                            <p className="text-sm text-[#6B7280]">
                              Nenhuma configuração de email configurada
                            </p>
                          </div>
                        )
                      )}
                    </div>

                    {/* Formulário de Adicionar/Editar */}
                    {(isAddingEmailConfig || editingEmailConfigId) && (
                      <div className="lg:border-l lg:pl-6 lg:border-[#E5E7EB]">
                        <div className="sticky top-4">
                          <div className="p-4 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-medium text-[#1F2937]">
                                {isAddingEmailConfig ? "Nova Configuração de Email" : "Editar Configuração"}
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
                              config={editingEmailConfigId ? emailConfigs.find(c => c.id === editingEmailConfigId) : undefined}
                              onSubmit={async (data) => {
                                try {
                                  if (editingEmailConfigId) {
                                    await updateEmailConfig(editingEmailConfigId, data);
                                    setEditingEmailConfigId(null);
                                  } else {
                                    await addEmailConfig(data);
                                    setIsAddingEmailConfig(false);
                                  }
                                } catch (error) {
                                  throw error;
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

                {/* Webhook — Em breve */}
                <div className="p-4 rounded-lg border border-[#E5E7EB] opacity-60">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-[#1F2937]">Webhook para Captura</h4>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                          Em breve
                        </span>
                      </div>
                      <p className="text-sm text-[#6B7280]">Receba leads de qualquer fonte externa via webhook</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Billing Tab */}
            <TabsContent value="billing" className="p-6">
              <div className="space-y-6">
                {/* Current Plan */}
                <div>
                  <h3 className="text-[#1F2937] mb-4">Plano Atual</h3>
                  {(() => {
                    const currentPlanData = getPlan(currentPlan);
                    return (
                      <div className="p-6 rounded-lg border-2 border-[#2563EB] bg-[#2563EB]/5">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="text-xl font-semibold text-[#1F2937]">{currentPlanData.name}</h4>
                            <p className="text-[#6B7280]">R$ {currentPlanData.price.toFixed(2)}/mês</p>
                          </div>
                          <span className="px-3 py-1 bg-[#2563EB] text-white text-xs rounded-full">
                            {subscription?.status === "active" ? "Ativo" : subscription?.status === "trial" ? "Teste" : "Inativo"}
                          </span>
                        </div>
                        <div className="space-y-2 mb-4">
                          {currentPlanData.features.map((feature, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <CheckCircle size={16} className="text-[#16A34A]" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          {canDowngrade() && (
                            <Button 
                              variant="outline" 
                              className="flex-1"
                              onClick={() => {
                                const currentIndex = planOrder.indexOf(currentPlan);
                                if (currentIndex > 0) {
                                  setSelectedPlanToChange(planOrder[currentIndex - 1]);
                                  setPlanChangeModalOpen(true);
                                }
                              }}
                            >
                              Fazer Downgrade
                            </Button>
                          )}
                          {canUpgrade() && (
                            <Button 
                              className="flex-1 bg-[#2563EB] hover:bg-[#1E40AF]"
                              onClick={() => {
                                const currentIndex = planOrder.indexOf(currentPlan);
                                if (currentIndex < planOrder.length - 1) {
                                  const nextPlan = planOrder[currentIndex + 1];
                                  setSelectedPlanToChange(nextPlan);
                                  // Verificar se precisa de pagamento
                                  const validation = validateUpgrade(nextPlan);
                                  if (!validation.isValid) {
                                    // Abrir modal de pagamento
                                    setPaymentModalOpen(true);
                                  } else {
                                    // Abrir modal de confirmação normal
                                    setPlanChangeModalOpen(true);
                                  }
                                }
                              }}
                            >
                              Fazer Upgrade
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Available Plans Comparison */}
                <div className="pt-6 border-t border-[#E5E7EB]">
                  <h3 className="text-[#1F2937] mb-4">Planos Disponíveis</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {plans.map((plan) => {
                      const isCurrentPlan = plan.id === currentPlan;
                      const isUpgrade = planOrder.indexOf(plan.id) > planOrder.indexOf(currentPlan);
                      const isDowngrade = planOrder.indexOf(plan.id) < planOrder.indexOf(currentPlan);
                      
                      return (
                        <div
                          key={plan.id}
                          className={`p-6 rounded-lg border-2 ${
                            isCurrentPlan
                              ? "border-[#2563EB] bg-[#2563EB]/5"
                              : plan.highlighted
                              ? "border-[#F59E0B] bg-[#F59E0B]/5"
                              : "border-[#E5E7EB] bg-white"
                          }`}
                        >
                          {plan.highlighted && !isCurrentPlan && (
                            <div className="mb-3">
                              <span className="px-2 py-1 bg-[#F59E0B] text-white text-xs rounded-full">
                                Recomendado
                              </span>
                            </div>
                          )}
                          <div className="mb-4">
                            <h4 className="text-lg font-semibold text-[#1F2937] mb-1">{plan.name}</h4>
                            <p className="text-sm text-[#6B7280] mb-2">{plan.description}</p>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-bold text-[#1F2937]">R$ {plan.price.toFixed(2)}</span>
                              <span className="text-sm text-[#6B7280]">/mês</span>
                            </div>
                          </div>
                          <ul className="space-y-2 mb-4">
                            {plan.features.slice(0, 4).map((feature, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm">
                                <CheckCircle size={16} className="text-[#16A34A] mt-0.5 flex-shrink-0" />
                                <span className="text-[#6B7280]">{feature}</span>
                              </li>
                            ))}
                          </ul>
                          {isCurrentPlan ? (
                            <Button variant="outline" className="w-full" disabled>
                              Plano Atual
                            </Button>
                          ) : (
                            <Button
                              className={`w-full ${
                                isUpgrade
                                  ? "bg-[#2563EB] hover:bg-[#1E40AF]"
                                  : "bg-[#6B7280] hover:bg-[#4B5563]"
                              }`}
                              onClick={() => {
                                setSelectedPlanToChange(plan.id);
                                // Verificar se é upgrade e precisa de pagamento
                                if (isUpgrade) {
                                  const validation = validateUpgrade(plan.id);
                                  if (!validation.isValid) {
                                    setPaymentModalOpen(true);
                                  } else {
                                    setPlanChangeModalOpen(true);
                                  }
                                } else {
                                  // Downgrade não precisa de pagamento
                                  setPlanChangeModalOpen(true);
                                }
                              }}
                            >
                              {isUpgrade ? "Fazer Upgrade" : "Fazer Downgrade"}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Usage */}
                <div className="pt-6 border-t border-[#E5E7EB]">
                  <h3 className="text-[#1F2937] mb-4">Uso Atual</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[#6B7280]">Leads</span>
                        <span className="text-sm font-medium">
                          {planUsage.leads.current} / {planUsage.leads.limit === 0 ? "Ilimitado" : planUsage.leads.limit}
                        </span>
                      </div>
                      {planUsage.leads.limit > 0 && (
                        <div className="w-full bg-[#E5E7EB] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              planUsage.leads.percentage >= 90
                                ? "bg-red-500"
                                : planUsage.leads.percentage >= 70
                                ? "bg-yellow-500"
                                : "bg-[#2563EB]"
                            }`}
                            style={{ width: `${Math.min(planUsage.leads.percentage, 100)}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[#6B7280]">Usuários</span>
                        <span className="text-sm font-medium">
                          {planUsage.users.current} / {planUsage.users.limit === 0 ? "Ilimitado" : planUsage.users.limit}
                        </span>
                      </div>
                      {planUsage.users.limit > 0 && (
                        <div className="w-full bg-[#E5E7EB] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              planUsage.users.percentage >= 90
                                ? "bg-red-500"
                                : planUsage.users.percentage >= 70
                                ? "bg-yellow-500"
                                : "bg-[#2563EB]"
                            }`}
                            style={{ width: `${Math.min(planUsage.users.percentage, 100)}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[#6B7280]">Automações</span>
                        <span className="text-sm font-medium">
                          {planUsage.automations.current} / {planUsage.automations.limit === 0 ? "Ilimitado" : planUsage.automations.limit}
                        </span>
                      </div>
                      {planUsage.automations.limit > 0 && (
                        <div className="w-full bg-[#E5E7EB] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              planUsage.automations.percentage >= 90
                                ? "bg-red-500"
                                : planUsage.automations.percentage >= 70
                                ? "bg-yellow-500"
                                : "bg-[#2563EB]"
                            }`}
                            style={{ width: `${Math.min(planUsage.automations.percentage, 100)}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[#6B7280]">Conexões WhatsApp</span>
                        <span className="text-sm font-medium">
                          {planUsage.whatsappConnections.current} / {planUsage.whatsappConnections.limit === 0 ? "Ilimitado" : planUsage.whatsappConnections.limit}
                        </span>
                      </div>
                      {planUsage.whatsappConnections.limit > 0 && (
                        <div className="w-full bg-[#E5E7EB] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              planUsage.whatsappConnections.percentage >= 90
                                ? "bg-red-500"
                                : planUsage.whatsappConnections.percentage >= 70
                                ? "bg-yellow-500"
                                : "bg-[#2563EB]"
                            }`}
                            style={{ width: `${Math.min(planUsage.whatsappConnections.percentage, 100)}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[#6B7280]">Configurações de Email</span>
                        <span className="text-sm font-medium">
                          {planUsage.emailConfigs.current} / {planUsage.emailConfigs.limit === 0 ? "Ilimitado" : planUsage.emailConfigs.limit}
                        </span>
                      </div>
                      {planUsage.emailConfigs.limit > 0 && (
                        <div className="w-full bg-[#E5E7EB] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              planUsage.emailConfigs.percentage >= 90
                                ? "bg-red-500"
                                : planUsage.emailConfigs.percentage >= 70
                                ? "bg-yellow-500"
                                : "bg-[#2563EB]"
                            }`}
                            style={{ width: `${Math.min(planUsage.emailConfigs.percentage, 100)}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment History */}
                <div className="pt-6 border-t border-[#E5E7EB]">
                  <h3 className="text-[#1F2937] mb-4">Histórico de Pagamentos</h3>
                  <div className="space-y-3">
                    {paymentHistory.length > 0 ? (
                      paymentHistory.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg">
                          <div>
                            <p className="font-medium text-[#1F2937]">R$ {payment.amount.toFixed(2)}</p>
                            <p className="text-sm text-[#6B7280]">
                              {new Date(payment.date).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 text-xs rounded-full ${
                              payment.status === "paid"
                                ? "bg-green-100 text-green-700"
                                : payment.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : payment.status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {payment.status === "paid"
                              ? "Pago"
                              : payment.status === "pending"
                              ? "Pendente"
                              : payment.status === "failed"
                              ? "Falhou"
                              : "Reembolsado"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-[#F9FAFB] rounded-lg text-center">
                        <p className="text-sm text-[#6B7280]">Nenhum pagamento registrado</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tags Tab */}
            <TabsContent value="tags" className="p-6">
              <TagManager />
            </TabsContent>

            {/* Custom Fields Tab */}
            <TabsContent value="custom-fields" className="p-6">
              <div className="space-y-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                      Campos Customizados
                    </h3>
                    <p className="text-sm text-[#6B7280]">
                      Crie campos personalizados para capturar informações específicas dos seus leads
                    </p>
                    <p className="text-xs text-[#6B7280] mt-1">
                      {customFields.length} campo{customFields.length !== 1 ? "s" : ""} criado{customFields.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {!isCreatingCustomField && !editingCustomFieldId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsCreatingCustomField(true);
                        setEditingCustomFieldId(null);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Campo
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Lista de Campos */}
                  <div className="space-y-3">
                    {customFields.length > 0 ? (
                      customFields.map((field) => (
                        <div
                          key={field.id}
                          className={`flex items-center gap-4 p-4 border rounded-lg bg-white hover:shadow-md transition-shadow ${
                            editingCustomFieldId === field.id
                              ? "border-[#2563EB] border-2"
                              : "border-[#E5E7EB]"
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-[#1F2937]">{field.name}</h4>
                              {field.required && (
                                <span className="text-xs text-red-500">*</span>
                              )}
                              <span className="text-xs px-2 py-0.5 bg-[#F9FAFB] text-[#6B7280] rounded">
                                {field.type === "text" ? "Texto" :
                                 field.type === "number" ? "Número" :
                                 field.type === "date" ? "Data" :
                                 field.type === "textarea" ? "Texto Longo" :
                                 field.type === "select" ? "Seleção" :
                                 field.type === "checkbox" ? "Checkbox" : field.type}
                              </span>
                            </div>
                            {field.type === "select" && field.options && (
                              <p className="text-sm text-[#6B7280] mt-1">
                                Opções: {field.options.join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingCustomFieldId(field.id);
                                setIsCreatingCustomField(false);
                              }}
                              className="p-2 hover:bg-[#F9FAFB] rounded transition-colors"
                              aria-label="Editar campo"
                              disabled={!!editingCustomFieldId || isCreatingCustomField}
                            >
                              <Edit2 size={16} className="text-[#6B7280]" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Tem certeza que deseja deletar o campo "${field.name}"?`)) {
                                  deleteField(field.id);
                                  if (editingCustomFieldId === field.id) {
                                    setEditingCustomFieldId(null);
                                  }
                                }
                              }}
                              className="p-2 hover:bg-red-50 rounded transition-colors"
                              aria-label="Deletar campo"
                              disabled={!!editingCustomFieldId || isCreatingCustomField}
                            >
                              <Trash2 size={16} className="text-red-600" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      !isCreatingCustomField && !editingCustomFieldId && (
                        <div className="p-4 bg-[#F9FAFB] rounded-lg text-center">
                          <p className="text-sm text-[#6B7280]">
                            Nenhum campo customizado criado ainda
                          </p>
                        </div>
                      )
                    )}
                  </div>

                  {/* Formulário de Adicionar/Editar */}
                  {(isCreatingCustomField || editingCustomFieldId) && (
                    <div className="lg:border-l lg:pl-6 lg:border-[#E5E7EB]">
                      <div className="sticky top-4">
                        <CustomFieldEditor
                          field={editingCustomFieldId ? customFields.find(f => f.id === editingCustomFieldId) : undefined}
                          inline={true}
                          onClose={() => {
                            setIsCreatingCustomField(false);
                            setEditingCustomFieldId(null);
                          }}
                          onSave={(fieldData) => {
                            try {
                              if (editingCustomFieldId) {
                                updateField(editingCustomFieldId, fieldData);
                                setEditingCustomFieldId(null);
                              } else {
                                createField(fieldData);
                                setIsCreatingCustomField(false);
                              }
                            } catch (error: any) {
                              alert(error.message || "Erro ao salvar campo");
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Plan Change Confirmation Modal */}
      <Dialog open={planChangeModalOpen} onOpenChange={setPlanChangeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPlanToChange && planOrder.indexOf(selectedPlanToChange) > planOrder.indexOf(currentPlan)
                ? "Confirmar Upgrade de Plano"
                : "Confirmar Downgrade de Plano"}
            </DialogTitle>
            <DialogDescription>
              {selectedPlanToChange && (
                <>
                  Você está prestes a mudar do plano <strong>{getPlan(currentPlan).name}</strong> para o plano{" "}
                  <strong>{getPlan(selectedPlanToChange).name}</strong>.
                  {planOrder.indexOf(selectedPlanToChange) > planOrder.indexOf(currentPlan) ? (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Upgrade:</strong> Você terá acesso a mais recursos e limites maiores. A mudança será aplicada imediatamente.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Atenção:</strong> Ao fazer downgrade, você pode perder acesso a alguns recursos se estiver usando mais do que o permitido no novo plano.
                      </p>
                    </div>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedPlanToChange && (
            <div className="space-y-4">
              <div className="p-4 bg-[#F9FAFB] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#6B7280]">Plano Atual</span>
                  <span className="font-medium text-[#1F2937]">
                    {getPlan(currentPlan).name} - R$ {getPlan(currentPlan).price.toFixed(2)}/mês
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">Novo Plano</span>
                  <span className="font-medium text-[#1F2937]">
                    {getPlan(selectedPlanToChange).name} - R$ {getPlan(selectedPlanToChange).price.toFixed(2)}/mês
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPlanChangeModalOpen(false);
                setSelectedPlanToChange(null);
              }}
              disabled={isChangingPlan}
            >
              Cancelar
            </Button>
            <Button
              className="bg-[#2563EB] hover:bg-[#1E40AF]"
              onClick={async () => {
                if (!selectedPlanToChange) return;
                setIsChangingPlan(true);
                try {
                  // Verificar se é upgrade e precisa de pagamento
                  const isUpgrade = planOrder.indexOf(selectedPlanToChange) > planOrder.indexOf(currentPlan);
                  if (isUpgrade) {
                    const validation = validateUpgrade(selectedPlanToChange);
                    if (!validation.isValid) {
                      setPlanChangeModalOpen(false);
                      setPaymentModalOpen(true);
                      return;
                    }
                  }
                  await changePlan(selectedPlanToChange);
                  setPlanChangeModalOpen(false);
                  setSelectedPlanToChange(null);
                } catch (error: any) {
                  console.error("Erro ao mudar plano:", error);
                  if (error.message?.includes("pagamento")) {
                    setPlanChangeModalOpen(false);
                    setPaymentModalOpen(true);
                  } else {
                    alert(error.message || "Erro ao mudar plano. Tente novamente.");
                  }
                } finally {
                  setIsChangingPlan(false);
                }
              }}
              disabled={isChangingPlan}
            >
              {isChangingPlan ? "Processando..." : "Confirmar Mudança"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      {selectedPlanToChange && (
        <PaymentModal
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          planId={selectedPlanToChange}
          planName={getPlan(selectedPlanToChange).name}
          amount={getPlan(selectedPlanToChange).price}
          onPaymentSuccess={async () => {
            try {
              // Usar o payment intent atual do contexto
              if (currentPaymentIntent && currentPaymentIntent.status === "paid") {
                await changePlanWithPayment(selectedPlanToChange, currentPaymentIntent.id);
              } else {
                // Fallback: tentar mudar plano normalmente (pode falhar se não houver pagamento)
                await changePlan(selectedPlanToChange);
              }
              setPaymentModalOpen(false);
              setSelectedPlanToChange(null);
            } catch (error: any) {
              console.error("Erro ao atualizar plano após pagamento:", error);
              alert(error.message || "Erro ao atualizar plano. Entre em contato com o suporte.");
            }
          }}
        />
      )}
    </div>
  );
}
