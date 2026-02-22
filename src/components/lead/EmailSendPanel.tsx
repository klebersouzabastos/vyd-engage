import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Mail, Send, Loader2 } from "lucide-react";
import { apiClient } from "../../services/api/client";
import { toast } from "sonner";

interface EmailSendPanelProps {
  leadId: string;
  leadEmail?: string;
  leadName?: string;
}

export function EmailSendPanel({ leadId, leadEmail, leadName }: EmailSendPanelProps) {
  const [configs, setConfigs] = useState<any[]>([]);
  const [selectedConfig, setSelectedConfig] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const data = await apiClient.getEmailConfigs();
      const verified = (data || []).filter((c: any) => c.verified);
      setConfigs(verified);
      if (verified.length > 0) {
        setSelectedConfig(verified[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar configs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!selectedConfig || !leadEmail) {
      toast.error("Selecione uma configuração e verifique o email do lead");
      return;
    }

    if (!subject.trim() || !content.trim()) {
      toast.error("Preencha o assunto e a mensagem");
      return;
    }

    setSending(true);
    try {
      await apiClient.sendEmail({
        configId: selectedConfig,
        to: leadEmail,
        subject,
        html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${content.replace(/\n/g, "<br/>")}</div>`,
        leadId,
      });
      toast.success("Email enviado!");
      setSubject("");
      setContent("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar email");
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

  if (configs.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        <Mail className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p>Nenhuma configuração de email verificada.</p>
        <p className="text-xs mt-1">Configure em Configurações &gt; Email</p>
      </div>
    );
  }

  if (!leadEmail) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        <Mail className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p>Lead não possui email cadastrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="h-4 w-4 text-blue-600" />
        <h4 className="font-medium text-sm">Enviar Email</h4>
      </div>

      {configs.length > 1 && (
        <div>
          <Label className="text-xs">Configuração</Label>
          <Select value={selectedConfig} onValueChange={setSelectedConfig}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {configs.map((cfg) => (
                <SelectItem key={cfg.id} value={cfg.id} className="text-xs">
                  {cfg.name} ({cfg.fromEmail})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label className="text-xs">Assunto</Label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Assunto do email..."
          className="h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs">Mensagem</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Mensagem para ${leadName || leadEmail}...`}
          className="text-sm min-h-[80px]"
        />
      </div>

      <Button
        onClick={handleSend}
        disabled={sending}
        size="sm"
        className="w-full"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
        Enviar Email
      </Button>
    </div>
  );
}
