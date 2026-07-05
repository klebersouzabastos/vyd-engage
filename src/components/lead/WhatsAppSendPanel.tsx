import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { MessageSquare, Send, Loader2, ExternalLink } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { toast } from 'sonner';

/**
 * Painel de envio de WhatsApp genérico por contexto (Upgrade RD P3, req 23).
 *
 * Aceita exatamente UM contexto: lead, deal ou empresa. O telefone é resolvido
 * pelo chamador a partir do contexto (deal → telefone do lead/empresa vinculados;
 * empresa → phone da empresa) e passado em `phone`. Os props legados
 * `leadId`/`leadPhone`/`leadName` continuam funcionando (uso atual em LeadForm).
 *
 * Sem conexão CONNECTED → mostra link wa.me + registra a interação (register-only),
 * vinculada ao contexto (lead/deal/empresa), como no Inbox.
 */
interface WhatsAppSendPanelProps {
  /** Contexto do envio. Passe exatamente um destes. */
  leadId?: string;
  dealId?: string;
  companyId?: string;
  /** Telefone do destinatário resolvido do contexto. */
  phone?: string;
  /** Nome exibido no placeholder da mensagem. */
  name?: string;

  // --- Compat: props legados usados por LeadForm (leadId/leadPhone/leadName). ---
  /** @deprecated Use `phone`. */
  leadPhone?: string;
  /** @deprecated Use `name`. */
  leadName?: string;
}

function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function WhatsAppSendPanel({
  leadId,
  dealId,
  companyId,
  phone,
  name,
  leadPhone,
  leadName,
}: WhatsAppSendPanelProps) {
  // Resolve contexto/valores considerando os props legados.
  const targetPhone = phone ?? leadPhone;
  const targetName = name ?? leadName;

  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnection, setSelectedConnection] = useState('');
  const [messageType, setMessageType] = useState<'text' | 'template'>('text');
  const [content, setContent] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (selectedConnection && messageType === 'template') {
      loadTemplates(selectedConnection);
    }
  }, [selectedConnection, messageType]);

  const loadConnections = async () => {
    try {
      const data = await apiClient.getWhatsAppConnections();
      const connected = ((data as any[]) || []).filter((c: any) => c.status === 'CONNECTED');
      setConnections(connected);
      if (connected.length > 0) {
        setSelectedConnection(String(connected[0].id));
      }
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async (connectionId: string) => {
    try {
      const result = (await apiClient.getWhatsAppTemplates(connectionId)) as {
        data?: any[];
      } | null;
      setTemplates(result?.data || []);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      setTemplates([]);
    }
  };

  // Campos de contexto enviados ao backend (vincula a interação à timeline correta).
  const contextIds = { leadId, dealId, companyId };

  const handleSend = async () => {
    if (!selectedConnection || !targetPhone) {
      toast.error('Selecione uma conexão e verifique o telefone do contato');
      return;
    }

    if (messageType === 'text' && !content.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }

    setSending(true);
    try {
      await apiClient.sendWhatsAppMessage({
        connectionId: selectedConnection,
        to: targetPhone,
        type: messageType,
        content: content,
        templateName: messageType === 'template' ? selectedTemplate : undefined,
        templateParams: messageType === 'template' ? templateParams : undefined,
        ...contextIds,
      });
      toast.success('Mensagem WhatsApp enviada!');
      setContent('');
      setTemplateParams([]);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  // Fallback sem conexão CONNECTED: abre wa.me e registra a interação (register-only).
  const handleRegisterOnly = async () => {
    if (!targetPhone) {
      toast.error('Contato não possui telefone cadastrado');
      return;
    }
    if (!content.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }

    setSending(true);
    try {
      await apiClient.createInteraction({
        ...contextIds,
        type: 'WHATSAPP',
        direction: 'OUTBOUND',
        content: content,
      });
      const waUrl = `https://wa.me/${sanitizePhone(targetPhone)}?text=${encodeURIComponent(content)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      toast.success('Mensagem registrada (sem conexão WhatsApp ativa)');
      setContent('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar mensagem');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm text-secondary">Carregando...</span>
      </div>
    );
  }

  if (!targetPhone) {
    return (
      <div className="p-4 text-center text-sm text-secondary">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>Contato não possui telefone cadastrado.</p>
      </div>
    );
  }

  // Sem conexão CONNECTED → modo register-only + wa.me (fallback gracioso).
  if (connections.length === 0) {
    return (
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="h-4 w-4 text-action-primary" />
          <h4 className="font-medium text-sm text-primary">Enviar WhatsApp</h4>
        </div>
        <p className="text-xs text-secondary">
          Nenhuma conexão WhatsApp ativa. A mensagem será registrada na timeline e aberta no
          WhatsApp Web/App.
        </p>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Mensagem para ${targetName || targetPhone}...`}
          className="text-sm min-h-[80px]"
        />
        <Button
          onClick={handleRegisterOnly}
          disabled={sending}
          size="sm"
          className="w-full bg-action-primary text-on-accent hover:opacity-90"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <ExternalLink className="h-4 w-4 mr-1" />
          )}
          Abrir no WhatsApp e registrar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-action-primary" />
        <h4 className="font-medium text-sm text-primary">Enviar WhatsApp</h4>
      </div>

      {connections.length > 1 && (
        <div>
          <Label className="text-xs">Conexão</Label>
          <Select value={selectedConnection} onValueChange={setSelectedConnection}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {connections.map((conn) => (
                <SelectItem key={conn.id} value={conn.id} className="text-xs">
                  {conn.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label className="text-xs">Tipo</Label>
        <Select value={messageType} onValueChange={(v) => setMessageType(v as 'text' | 'template')}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text" className="text-xs">
              Texto Livre
            </SelectItem>
            <SelectItem value="template" className="text-xs">
              Template
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {messageType === 'text' ? (
        <div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Mensagem para ${targetName || targetPhone}...`}
            className="text-sm min-h-[80px]"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecione um template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((tmpl: any) => (
                <SelectItem key={tmpl.name} value={tmpl.name} className="text-xs">
                  {tmpl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {templateParams.map((param, idx) => (
            <Input
              key={idx}
              value={param}
              onChange={(e) => {
                const newParams = [...templateParams];
                newParams[idx] = e.target.value;
                setTemplateParams(newParams);
              }}
              placeholder={`Parâmetro ${idx + 1}`}
              className="h-8 text-xs"
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => setTemplateParams([...templateParams, ''])}
          >
            + Parâmetro
          </Button>
        </div>
      )}

      <Button
        onClick={handleSend}
        disabled={sending}
        size="sm"
        className="w-full bg-action-primary text-on-accent hover:opacity-90"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Send className="h-4 w-4 mr-1" />
        )}
        Enviar
      </Button>
    </div>
  );
}
