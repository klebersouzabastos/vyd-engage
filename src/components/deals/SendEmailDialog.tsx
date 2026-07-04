// Ação "Enviar e-mail" (Upgrade RD P0, reqs 10 e 11): dialog com seleção de
// modelo (EmailTemplate) OU assunto/corpo livres, preview com as variáveis
// {{nome}} {{empresa}} {{negociacao}} {{valor}} {{responsavel}} resolvidas
// (mesma semântica do backend emailOneToOneService, incl. escape de HTML dos
// valores) e envio via POST /deals/:id/send-email OU /leads/:id/send-email —
// que registra Interaction EMAIL na timeline. Parametrizado por deal OU lead.
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';
import { apiClient, DealContact } from '../../services/api/client';
import type { Deal } from '../../types';
import { sanitizeRichHtml } from '../../lib/richText';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RichTextEditor } from '../ui/RichTextEditor';

/** Contato mínimo (lead) para o modo lead do dialog. */
export interface SendEmailLead {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
}

interface SendEmailDialogProps {
  open: boolean;
  onClose: () => void;
  /** Modo deal (req 10) — mutuamente exclusivo com `lead`. */
  deal?: Deal;
  /** Modo lead (req 11) — mutuamente exclusivo com `deal`. */
  lead?: SendEmailLead;
  /** Contatos vinculados (DealContact) — permite escolher o destinatário (modo deal). */
  contacts?: DealContact[];
  /** Chamado após envio com sucesso (ex.: recarregar a timeline). */
  onSent?: () => void;
}

interface RecipientOption {
  leadId: string;
  name: string;
  email: string;
}

/** Escapa HTML nos valores das variáveis — espelho do escapeHtml do backend (req 13). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Resolve as variáveis do contrato — espelho do backend (regex tolerante a
 * espaços). `escape` aplica o mesmo escape de HTML do backend antes de
 * interpolar (usado no corpo HTML); o assunto (texto puro) não escapa.
 */
function resolveVariables(
  input: string,
  vars: Record<string, string>,
  escape = false
): string {
  let result = input;
  for (const [key, value] of Object.entries(vars)) {
    const replacement = escape ? escapeHtml(value) : value;
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), replacement);
  }
  return result;
}

export function SendEmailDialog({
  open,
  onClose,
  deal,
  lead,
  contacts,
  onSent,
}: SendEmailDialogProps) {
  const isLeadMode = !deal && !!lead;
  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [recipientLeadId, setRecipientLeadId] = useState('');
  const [sending, setSending] = useState(false);

  // Modo deal: destinatários são o lead principal + contatos vinculados.
  // Modo lead: o próprio lead é o destinatário fixo (o backend resolve o e-mail).
  const recipients = useMemo<RecipientOption[]>(() => {
    if (isLeadMode) {
      return lead && lead.email
        ? [{ leadId: lead.id, name: lead.name, email: lead.email }]
        : [];
    }
    const map = new Map<string, RecipientOption>();
    if (deal?.lead?.id && deal.lead.email) {
      map.set(deal.lead.id, {
        leadId: deal.lead.id,
        name: deal.lead.name,
        email: deal.lead.email,
      });
    }
    (contacts || []).forEach((c) => {
      if (c.lead && c.lead.email && !map.has(c.leadId)) {
        map.set(c.leadId, { leadId: c.leadId, name: c.lead.name, email: c.lead.email });
      }
    });
    return Array.from(map.values());
  }, [isLeadMode, lead, deal?.lead, contacts]);

  // Reset ao abrir + destinatário padrão (contato principal).
  useEffect(() => {
    if (open) {
      setMode('template');
      setTemplateId('');
      setSubject('');
      setHtml('');
      setSending(false);
      setRecipientLeadId(recipients[0]?.leadId || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset intencional apenas na abertura
  }, [open]);

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => apiClient.getEmailTemplates(),
    enabled: open,
    staleTime: 60 * 1000,
  });

  const { data: templateDetail, isFetching: loadingTemplate } = useQuery({
    queryKey: ['email-template', templateId],
    queryFn: () => apiClient.getEmailTemplate(templateId),
    enabled: open && mode === 'template' && !!templateId,
  });

  const recipient = recipients.find((r) => r.leadId === recipientLeadId) || null;

  // Variáveis do preview: modo lead deixa negociacao/valor vazios (espelha o backend).
  const variables = useMemo<Record<string, string>>(() => {
    if (isLeadMode) {
      return {
        nome: recipient?.name || lead?.name || '',
        empresa: lead?.company || '',
        negociacao: '',
        valor: '',
        responsavel: '',
      };
    }
    return {
      nome: recipient?.name || deal?.lead?.name || '',
      empresa: deal?.company?.name || deal?.lead?.company || '',
      negociacao: deal?.name || '',
      valor: Number(deal?.value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
      responsavel: deal?.assignedUser?.name || '',
    };
  }, [isLeadMode, recipient, lead, deal]);

  const previewSubject = useMemo(() => {
    // Assunto é texto puro (não HTML) — não aplica escape.
    const raw = mode === 'template' ? templateDetail?.subject || '' : subject;
    return resolveVariables(raw, variables);
  }, [mode, templateDetail, subject, variables]);

  const previewHtml = useMemo(() => {
    // Corpo HTML: escapa os valores das variáveis (req 13) antes de sanitizar.
    const raw = mode === 'template' ? templateDetail?.html || '' : html;
    return sanitizeRichHtml(resolveVariables(raw, variables, true));
  }, [mode, templateDetail, html, variables]);

  const canSend =
    !sending &&
    recipients.length > 0 &&
    !!recipientLeadId &&
    (mode === 'template' ? !!templateId : subject.trim().length > 0 && html.trim().length > 0);

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const payload =
        mode === 'template' ? { templateId } : { subject: subject.trim(), html };
      if (isLeadMode && lead) {
        await apiClient.sendLeadEmail(lead.id, payload);
      } else if (deal) {
        await apiClient.sendDealEmail(deal.id, {
          ...payload,
          ...(recipientLeadId && recipientLeadId !== deal.lead?.id
            ? { leadId: recipientLeadId }
            : {}),
        });
      }
      toast.success('E-mail enviado');
      onSent?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar e-mail');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail size={16} aria-hidden="true" />
            Enviar e-mail
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Destinatário */}
          {recipients.length === 0 ? (
            <p className="text-sm rounded-md border border-border bg-muted px-3 py-2 text-muted-foreground">
              {isLeadMode
                ? 'Este contato não tem e-mail cadastrado. Adicione um e-mail para enviar.'
                : 'Esta negociação não tem contato com e-mail cadastrado. Vincule um contato com e-mail para enviar.'}
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label>Destinatário</Label>
              <Select value={recipientLeadId} onValueChange={setRecipientLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o destinatário" />
                </SelectTrigger>
                <SelectContent>
                  {recipients.map((r) => (
                    <SelectItem key={r.leadId} value={r.leadId}>
                      {r.name} — {r.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Modelo ou conteúdo livre */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'template' ? 'default' : 'outline'}
              onClick={() => setMode('template')}
            >
              Usar modelo
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'custom' ? 'default' : 'outline'}
              onClick={() => setMode('custom')}
            >
              Escrever e-mail
            </Button>
          </div>

          {mode === 'template' ? (
            <div className="space-y-1.5">
              <Label>Modelo de e-mail</Label>
              {loadingTemplates ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  Carregando modelos...
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum modelo cadastrado. Crie modelos em Configurações de Negociações →
                  Modelos de e-mail, ou escreva o e-mail livremente.
                </p>
              ) : (
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="send-email-subject">Assunto</Label>
                <Input
                  id="send-email-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Assunto do e-mail (aceita {{nome}}, {{empresa}}, ...)"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Corpo</Label>
                <RichTextEditor
                  value={html}
                  onChange={setHtml}
                  placeholder="Escreva o e-mail... Variáveis: {{nome}} {{empresa}} {{negociacao}} {{valor}} {{responsavel}}"
                />
              </div>
            </>
          )}

          {/* Preview com variáveis resolvidas */}
          {(previewSubject || previewHtml) && (
            <div className="space-y-1.5">
              <Label>Pré-visualização</Label>
              <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
                {loadingTemplate ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    Carregando modelo...
                  </div>
                ) : (
                  <>
                    {previewSubject && (
                      <p className="text-sm font-semibold text-foreground border-b border-border pb-2">
                        {previewSubject}
                      </p>
                    )}
                    {previewHtml && (
                      // HTML sanitizado via sanitizeRichHtml (DOMPurify)
                      <div
                        className="text-sm text-foreground [&_a]:underline max-h-64 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={!canSend}>
              {sending && <Loader2 size={14} className="mr-2 animate-spin" aria-hidden="true" />}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
