import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  ArrowLeft, Mail, Send, Users, FileText, Save, Trash2,
  Loader2, Search, CheckCircle, XCircle, Eye, AlertTriangle
} from "lucide-react";
import { apiClient } from "../services/api/client";
import { toast } from "sonner";

interface EmailConfig {
  id: string;
  name: string;
  fromEmail: string;
  fromName?: string;
  provider: string;
  isVerified?: boolean;
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  status: string;
  source?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  createdAt: string;
}

const TEMPLATES_KEY = "vyd_email_templates";

function loadLocalTemplates(): EmailTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]");
  } catch { return []; }
}

function saveLocalTemplates(templates: EmailTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

const VARIABLE_OPTIONS = [
  { label: "Nome do Lead", value: "{{name}}" },
  { label: "Email do Lead", value: "{{email}}" },
  { label: "Empresa", value: "{{company}}" },
  { label: "Telefone", value: "{{phone}}" },
];

export function EmailCampaigns() {
  const navigate = useNavigate();

  // Email configs
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [loadingConfigs, setLoadingConfigs] = useState(true);

  // Leads / recipients
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [leadSearch, setLeadSearch] = useState("");
  const [leadFilter, setLeadFilter] = useState<string>("all");

  // Compose
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>(loadLocalTemplates());
  const [templateName, setTemplateName] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  // Send state
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

  // Preview
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadConfigs();
    loadLeads();
  }, []);

  const loadConfigs = async () => {
    try {
      const result = await apiClient.getEmailConfigs();
      const data = (result?.data || result || []) as EmailConfig[];
      setConfigs(data);
      const verified = data.find(c => c.isVerified) || data[0];
      if (verified) setSelectedConfigId(verified.id);
    } catch {
      console.error("Erro ao carregar configs de email");
    } finally {
      setLoadingConfigs(false);
    }
  };

  const loadLeads = async () => {
    try {
      const result = await apiClient.getLeads();
      const data = (result?.data || result || []) as Lead[];
      setAllLeads(data.filter(l => l.email));
    } catch {
      console.error("Erro ao carregar leads");
    } finally {
      setLoadingLeads(false);
    }
  };

  const filteredLeads = allLeads.filter(lead => {
    const matchesSearch = !leadSearch ||
      lead.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      (lead.email && lead.email.toLowerCase().includes(leadSearch.toLowerCase()));
    const matchesFilter = leadFilter === "all" || lead.status === leadFilter;
    return matchesSearch && matchesFilter;
  });

  const toggleLead = (id: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const insertVariable = (variable: string) => {
    setHtmlBody(prev => prev + variable);
  };

  // Templates
  const saveTemplate = () => {
    if (!templateName.trim() || !subject.trim()) {
      toast.error("Preencha o nome do template e o assunto");
      return;
    }
    const newTemplate: EmailTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      subject,
      html: htmlBody,
      createdAt: new Date().toISOString(),
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    saveLocalTemplates(updated);
    setTemplateName("");
    toast.success("Template salvo");
  };

  const loadTemplate = (t: EmailTemplate) => {
    setSubject(t.subject);
    setHtmlBody(t.html);
    setShowTemplates(false);
    toast.success(`Template "${t.name}" carregado`);
  };

  const deleteTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    saveLocalTemplates(updated);
    toast.success("Template removido");
  };

  // Send campaign
  const handleSend = useCallback(async () => {
    if (!selectedConfigId) { toast.error("Selecione uma configuração de email"); return; }
    if (selectedLeadIds.size === 0) { toast.error("Selecione pelo menos um destinatário"); return; }
    if (!subject.trim()) { toast.error("Preencha o assunto"); return; }
    if (!htmlBody.trim()) { toast.error("Preencha o corpo do email"); return; }

    const selectedLeads = allLeads.filter(l => selectedLeadIds.has(l.id));

    setSending(true);
    setSendResult(null);

    try {
      const recipients = selectedLeads.map(lead => ({
        email: lead.email!,
        leadId: lead.id,
        variables: {
          name: lead.name || "",
          email: lead.email || "",
          company: "",
          phone: "",
        },
      }));

      const result = await apiClient.sendBulkEmail({
        configId: selectedConfigId,
        recipients,
        subject,
        html: htmlBody,
      });

      const data = result?.data || result;
      setSendResult({ sent: data?.sent || selectedLeads.length, failed: data?.failed || 0 });
      toast.success(`Campanha enviada: ${data?.sent || selectedLeads.length} emails`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar campanha");
    } finally {
      setSending(false);
    }
  }, [selectedConfigId, selectedLeadIds, subject, htmlBody, allLeads]);

  // Preview with variable substitution
  const getPreviewHtml = () => {
    let preview = htmlBody;
    preview = preview.replace(/\{\{name\}\}/g, "João Silva");
    preview = preview.replace(/\{\{email\}\}/g, "joao@exemplo.com");
    preview = preview.replace(/\{\{company\}\}/g, "Empresa XYZ");
    preview = preview.replace(/\{\{phone\}\}/g, "(11) 99999-0000");
    return preview;
  };

  if (loadingConfigs || loadingLeads) {
    return (
      <div className="min-h-screen">
        <Header title="Campanhas de Email" subtitle="Envie emails em massa para seus leads" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Campanhas de Email" subtitle="Envie emails em massa para seus leads" />

      <div className="p-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={() => navigate("/app/settings")} className="gap-2">
            <ArrowLeft size={16} /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowTemplates(!showTemplates)} className="gap-2">
              <FileText size={16} /> Templates ({templates.length})
            </Button>
          </div>
        </div>

        {configs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-300">
            <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma configuração de email</h3>
            <p className="text-gray-500 mb-4">Configure um provedor de email nas Configurações para enviar campanhas</p>
            <Button onClick={() => navigate("/app/settings")}>Ir para Configurações</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Recipients */}
            <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Users size={16} /> Destinatários
                  </h3>
                  <span className="text-xs text-gray-500">
                    {selectedLeadIds.size} de {filteredLeads.length}
                  </span>
                </div>
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Buscar..."
                      value={leadSearch}
                      onChange={e => setLeadSearch(e.target.value)}
                      className="pl-7 h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={leadFilter} onValueChange={setLeadFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="NEW">Novos</SelectItem>
                      <SelectItem value="CONTACTED">Contatados</SelectItem>
                      <SelectItem value="QUALIFIED">Qualificados</SelectItem>
                      <SelectItem value="WON">Ganhos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={selectAll} className="text-xs h-8">
                    {selectedLeadIds.size === filteredLeads.length ? "Desmarcar" : "Todos"}
                  </Button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {filteredLeads.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">Nenhum lead com email encontrado</p>
                ) : (
                  filteredLeads.map(lead => (
                    <label
                      key={lead.id}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.has(lead.id)}
                        onChange={() => toggleLead(lead.id)}
                        className="rounded border-gray-300"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{lead.name}</p>
                        <p className="text-xs text-gray-500 truncate">{lead.email}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Center + Right: Compose */}
            <div className="lg:col-span-2 space-y-4">
              {/* Config selector */}
              <div className="bg-white rounded-lg border border-gray-300 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Configuração de Email</label>
                <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma configuração" />
                  </SelectTrigger>
                  <SelectContent>
                    {configs.map(config => (
                      <SelectItem key={config.id} value={config.id}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${config.isVerified ? "bg-green-500" : "bg-gray-400"}`} />
                          {config.name} ({config.fromEmail})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div className="bg-white rounded-lg border border-gray-300 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Assunto</label>
                <Input
                  placeholder="Assunto do email... Use {{name}} para personalizar"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>

              {/* Body editor */}
              <div className="bg-white rounded-lg border border-gray-300 p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Corpo do Email (HTML)</label>
                  <div className="flex items-center gap-1">
                    {VARIABLE_OPTIONS.map(v => (
                      <button
                        key={v.value}
                        onClick={() => insertVariable(v.value)}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                        title={`Inserir ${v.label}`}
                      >
                        {v.value}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  className="w-full h-48 border border-gray-300 rounded-md p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder={`<h1>Olá {{name}},</h1>\n<p>Temos uma novidade especial para você...</p>`}
                  value={htmlBody}
                  onChange={e => setHtmlBody(e.target.value)}
                />
              </div>

              {/* Template save */}
              <div className="bg-white rounded-lg border border-gray-300 p-4">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Nome do template..."
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={saveTemplate} className="gap-2">
                    <Save size={16} /> Salvar Template
                  </Button>
                  <Button variant="outline" onClick={() => setShowPreview(!showPreview)} className="gap-2">
                    <Eye size={16} /> Preview
                  </Button>
                </div>
              </div>

              {/* Preview */}
              {showPreview && (
                <div className="bg-white rounded-lg border border-gray-300 p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Preview (com dados de exemplo)</h4>
                  <div className="border border-gray-200 rounded p-4 bg-gray-50">
                    <p className="text-sm font-medium mb-2">Assunto: {subject.replace(/\{\{name\}\}/g, "João Silva")}</p>
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                    />
                  </div>
                </div>
              )}

              {/* Send result */}
              {sendResult && (
                <div className={`rounded-lg p-4 border ${sendResult.failed > 0 ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
                  <div className="flex items-center gap-2">
                    {sendResult.failed > 0 ? (
                      <AlertTriangle size={16} className="text-yellow-600" />
                    ) : (
                      <CheckCircle size={16} className="text-green-600" />
                    )}
                    <span className="text-sm font-medium">
                      {sendResult.sent} email{sendResult.sent !== 1 ? "s" : ""} enviado{sendResult.sent !== 1 ? "s" : ""}
                      {sendResult.failed > 0 && `, ${sendResult.failed} falha${sendResult.failed !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Send button */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {selectedLeadIds.size > 0
                    ? `${selectedLeadIds.size} destinatário${selectedLeadIds.size !== 1 ? "s" : ""} selecionado${selectedLeadIds.size !== 1 ? "s" : ""}`
                    : "Nenhum destinatário selecionado"}
                </p>
                <Button
                  onClick={handleSend}
                  disabled={sending || selectedLeadIds.size === 0 || !subject.trim() || !htmlBody.trim()}
                  className="gap-2"
                >
                  {sending ? (
                    <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                  ) : (
                    <><Send size={16} /> Enviar Campanha</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Templates sidebar */}
        {showTemplates && (
          <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={() => setShowTemplates(false)}>
            <div className="w-96 bg-white h-full shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Templates Salvos</h3>
                  <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-gray-600">
                    <XCircle size={20} />
                  </button>
                </div>
              </div>
              {templates.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Nenhum template salvo</p>
              ) : (
                templates.map(t => (
                  <div key={t.id} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-medium text-sm text-gray-900">{t.name}</h4>
                      <button
                        onClick={() => deleteTemplate(t.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-2 truncate">{t.subject}</p>
                    <p className="text-xs text-gray-400 mb-2">
                      {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => loadTemplate(t)} className="text-xs">
                      Usar Template
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
