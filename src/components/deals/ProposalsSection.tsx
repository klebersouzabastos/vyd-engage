// Seção "Propostas" do DealDetail (Upgrade RD P2, reqs 17–19 — contrato em
// specs/upgrade-rd-parity.md). Escolhe um modelo PUBLICADO, gera a proposta
// (POST /deals/:id/proposals → PDF versionado anexado), lista as versões com
// baixar + badge de status de assinatura, e — SÓ quando a integração de
// assinatura está configurada (GET /integrations/signature/status) — oferece
// "Enviar para assinatura". Sem credencial, o botão fica oculto (gating
// gracioso). Arquivo novo → 100% tokenizado (STRICT_SCOPE do check:colors).
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileSignature, Loader2, Send } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import type { Proposal, ProposalTemplate, SignatureStatus } from '../../types/documents';
import { formatCurrency } from '../../utils/format';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

// ── Rótulo + cor (tokens do DS) por status de assinatura (req 19) ──
const SIGNATURE_BADGE: Record<SignatureStatus, { label: string; cls: string }> = {
  NONE: { label: 'Sem assinatura', cls: 'bg-muted text-muted-foreground' },
  SENT: { label: 'Enviada', cls: 'bg-primary/15 text-primary' },
  VIEWED: { label: 'Visualizada', cls: 'bg-warning/15 text-warning' },
  SIGNED: { label: 'Assinada', cls: 'bg-success/15 text-success' },
  REFUSED: { label: 'Recusada', cls: 'bg-destructive/15 text-destructive' },
  EXPIRED: { label: 'Expirada', cls: 'bg-destructive/15 text-destructive' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProposalsSection({ dealId }: { dealId: string }) {
  const queryClient = useQueryClient();
  const [templateId, setTemplateId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Envio para assinatura (dialog): coleta e-mail e nome do signatário.
  const [signProposal, setSignProposal] = useState<Proposal | null>(null);
  const [signerEmail, setSignerEmail] = useState('');
  const [signerName, setSignerName] = useState('');
  const [sending, setSending] = useState(false);

  // ── Modelos publicados (req 17) ──
  const { data: templates = [] } = useQuery<ProposalTemplate[]>({
    queryKey: ['proposal-templates', 'published'],
    queryFn: () => apiClient.getProposalTemplates().then((r) => r.data || []),
  });
  const publishedTemplates = useMemo(
    () => templates.filter((t) => t.status === 'PUBLISHED'),
    [templates]
  );

  // ── Versões de proposta do deal (req 18) ──
  const { data: proposals = [], isLoading: loadingProposals } = useQuery<Proposal[]>({
    queryKey: ['deal-proposals', dealId],
    queryFn: () => apiClient.getDealProposals(dealId).then((r) => r.data || []),
  });

  // ── Status da integração de assinatura (gating, req 19) ──
  const { data: signatureStatus } = useQuery({
    queryKey: ['signature-status'],
    queryFn: () => apiClient.getSignatureStatus().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const signatureConfigured = signatureStatus?.configured ?? false;

  const refetchProposals = () =>
    queryClient.invalidateQueries({ queryKey: ['deal-proposals', dealId] });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // templateId vazio → backend usa o modelo padrão do tenant.
      await apiClient.generateProposal(dealId, templateId ? { templateId } : undefined);
      toast.success('Proposta gerada');
      refetchProposals();
      // Novo anexo aparece também na aba Arquivos.
      queryClient.invalidateQueries({ queryKey: ['attachments', 'deal', dealId] });
      queryClient.invalidateQueries({ queryKey: ['storage-usage'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar proposta');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (p: Proposal) => {
    setDownloadingId(p.id);
    try {
      const blob = await apiClient.downloadAttachment(p.attachmentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = p.attachment?.name || `proposta-v${p.version}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao baixar proposta');
    } finally {
      setDownloadingId(null);
    }
  };

  const openSignDialog = (p: Proposal) => {
    setSignProposal(p);
    setSignerEmail('');
    setSignerName('');
  };

  const handleSendSignature = async () => {
    if (!signProposal || !signerEmail.trim() || !signerName.trim()) return;
    setSending(true);
    try {
      await apiClient.sendProposalForSignature(signProposal.id, {
        signerEmail: signerEmail.trim(),
        signerName: signerName.trim(),
      });
      toast.success('Proposta enviada para assinatura');
      setSignProposal(null);
      refetchProposals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar para assinatura');
    } finally {
      setSending(false);
    }
  };

  const hasTemplates = publishedTemplates.length > 0;

  return (
    <div className="space-y-4">
      {/* Gerar proposta */}
      <div className="bg-card rounded-lg border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileSignature size={16} aria-hidden="true" />
          Gerar proposta
        </h3>
        {hasTemplates ? (
          <>
            <p className="text-sm text-muted-foreground">
              Escolha um modelo publicado para gerar a proposta em PDF (com itens e totais do deal).
              Gerar novamente cria uma nova versão.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label>Modelo</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Modelo padrão do tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {publishedTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.isDefault ? ' (padrão)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                {generating ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <FileSignature size={14} aria-hidden="true" />
                )}
                Gerar proposta
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum modelo de proposta publicado. Crie um modelo em Configurações → Modelos de
            proposta para gerar propostas a partir do deal.
          </p>
        )}
      </div>

      {/* Histórico de versões */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {loadingProposals ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-12">
            <FileSignature
              size={40}
              className="mx-auto text-muted-foreground mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">Nenhuma proposta gerada ainda.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {proposals.map((p) => {
              const badge = SIGNATURE_BADGE[p.signatureStatus] ?? SIGNATURE_BADGE.NONE;
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">Versão {p.version}</span>
                      <span
                        className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.createdAt)}
                      {p.totalValue != null ? ` — ${formatCurrency(Number(p.totalValue))}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownload(p)}
                      disabled={downloadingId === p.id}
                      aria-label={`Baixar proposta versão ${p.version}`}
                      title="Baixar"
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {downloadingId === p.id ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Download size={16} aria-hidden="true" />
                      )}
                    </button>
                    {/* "Enviar para assinatura" só aparece com a integração configurada (gating) */}
                    {signatureConfigured && (
                      <button
                        type="button"
                        onClick={() => openSignDialog(p)}
                        aria-label={`Enviar proposta versão ${p.version} para assinatura`}
                        title="Enviar para assinatura"
                        className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Send size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Dialog: enviar para assinatura (req 19) */}
      <Dialog open={!!signProposal} onOpenChange={(open) => !open && setSignProposal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Enviar para assinatura
              {signProposal ? ` — Versão ${signProposal.version}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome do signatário</Label>
              <Input
                placeholder="Nome completo"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail do signatário</Label>
              <Input
                type="email"
                placeholder="email@empresa.com"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setSignProposal(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSendSignature}
                disabled={sending || !signerEmail.trim() || !signerName.trim()}
                className="gap-2"
              >
                {sending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
