import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Loader2, Sparkles, Copy, Send, FileText } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "../../services/api/client";
import type { DraftTemplateType, EmailDraft, DraftTemplate } from "../../types";

interface AIDraftDialogProps {
  open: boolean;
  onClose: () => void;
  leadId?: string;
  dealId?: string;
  /** Called when user clicks "Enviar" with the subject and body */
  onSend?: (subject: string, body: string) => void;
}

const TEMPLATE_OPTIONS: { value: DraftTemplateType; label: string; description: string }[] = [
  { value: "initial_outreach", label: "Primeiro Contato", description: "Email de apresentacao para novos leads" },
  { value: "follow_up", label: "Follow-up", description: "Acompanhamento apos periodo sem contato" },
  { value: "proposal", label: "Proposta Comercial", description: "Envio de proposta ou apresentacao comercial" },
  { value: "thank_you", label: "Agradecimento", description: "Agradecimento apos reuniao ou fechamento" },
];

export function AIDraftDialog({ open, onClose, leadId, dealId, onSend }: AIDraftDialogProps) {
  const [templateType, setTemplateType] = useState<DraftTemplateType>("initial_outreach");
  const [customInstructions, setCustomInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [editableSubject, setEditableSubject] = useState("");
  const [editableBody, setEditableBody] = useState("");

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setDraft(null);
      setEditableSubject("");
      setEditableBody("");
      setCustomInstructions("");
      setTemplateType("initial_outreach");
    }
  }, [open]);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const result = await apiClient.generateEmailDraft({
        leadId,
        dealId,
        templateType,
        customInstructions: customInstructions.trim() || undefined,
      });
      const data = result.data;
      setDraft(data);
      setEditableSubject(data.subject);
      setEditableBody(data.body);
    } catch (error: any) {
      console.error("Erro ao gerar rascunho:", error);
      toast.error(error.message || "Erro ao gerar rascunho de email");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const text = `Assunto: ${editableSubject}\n\n${editableBody}`;
    navigator.clipboard.writeText(text);
    toast.success("Email copiado para a area de transferencia!");
  };

  const handleSend = () => {
    if (onSend) {
      onSend(editableSubject, editableBody);
      onClose();
    } else {
      toast.info("Funcionalidade de envio direto sera implementada em breve.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={20} className="text-purple-500" />
            Gerar Email
          </DialogTitle>
          <DialogDescription>
            Selecione um template e gere um rascunho de email automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Template selection */}
          {!draft && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Tipo de Email
                </label>
                <Select
                  value={templateType}
                  onValueChange={(v) => setTemplateType(v as DraftTemplateType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div>
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-gray-500 text-xs ml-2">{opt.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Instrucoes adicionais (opcional)
                </label>
                <Textarea
                  placeholder="Ex: Mencione o desconto de 10% para fechamento neste mes..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {customInstructions.length}/500
                </p>
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Gerando rascunho...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Gerar Rascunho
                  </>
                )}
              </Button>
            </>
          )}

          {/* Draft preview / editor */}
          {draft && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant={draft.aiGenerated ? "default" : "secondary"}
                  className={draft.aiGenerated ? "bg-purple-100 text-purple-700 hover:bg-purple-100" : ""}
                >
                  {draft.aiGenerated ? (
                    <>
                      <Sparkles size={12} className="mr-1" />
                      Gerado por IA
                    </>
                  ) : (
                    <>
                      <FileText size={12} className="mr-1" />
                      Template
                    </>
                  )}
                </Badge>
                <span className="text-xs text-gray-500">
                  {TEMPLATE_OPTIONS.find((o) => o.value === draft.templateUsed)?.label}
                </span>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Assunto
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={editableSubject}
                  onChange={(e) => setEditableSubject(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Corpo do Email
                </label>
                <Textarea
                  value={editableBody}
                  onChange={(e) => setEditableBody(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setDraft(null)}
                >
                  Voltar
                </Button>
                <div className="flex-1" />
                <Button variant="outline" className="gap-2" onClick={handleCopy}>
                  <Copy size={14} />
                  Copiar
                </Button>
                {onSend && (
                  <Button className="gap-2" onClick={handleSend}>
                    <Send size={14} />
                    Enviar
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
