import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { toast } from 'sonner';

interface WhatsAppSendPanelProps {
  leadId: string;
  leadPhone?: string;
  leadName?: string;
}

export function WhatsAppSendPanel({ leadId, leadPhone, leadName }: WhatsAppSendPanelProps) {
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
      const connected = (data || []).filter((c: any) => c.status === 'CONNECTED');
      setConnections(connected);
      if (connected.length > 0) {
        setSelectedConnection(connected[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async (connectionId: string) => {
    try {
      const result = await apiClient.getWhatsAppTemplates(connectionId);
      setTemplates(result?.data || []);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      setTemplates([]);
    }
  };

  const handleSend = async () => {
    if (!selectedConnection || !leadPhone) {
      toast.error('Selecione uma conexão e verifique o telefone do lead');
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
        to: leadPhone,
        type: messageType,
        content: content,
        templateName: messageType === 'template' ? selectedTemplate : undefined,
        templateParams: messageType === 'template' ? templateParams : undefined,
        leadId,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm text-gray-500">Carregando...</span>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p>Nenhuma conexão WhatsApp ativa.</p>
        <p className="text-xs mt-1">Configure em Configurações &gt; WhatsApp</p>
      </div>
    );
  }

  if (!leadPhone) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p>Lead não possui telefone cadastrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-green-600" />
        <h4 className="font-medium text-sm">Enviar WhatsApp</h4>
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
            placeholder={`Mensagem para ${leadName || leadPhone}...`}
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
        className="w-full bg-green-600 hover:bg-green-700"
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
