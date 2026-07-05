// Aba "Arquivos" do deal e da empresa (Upgrade RD P2, req 22 — contrato em
// specs/upgrade-rd-parity.md). Consolida os anexos vinculados à superfície
// (deal ou empresa): lista com nome/tipo/tamanho/autor/data, upload por
// drag-drop simples (SEM lib nova — só a Drag & Drop API do navegador),
// download via blob, exclusão (soft-delete) e barra de uso do tenant.
// Arquivo novo → nasce 100% tokenizado (STRICT_SCOPE do check:colors).
import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Download,
  FileText,
  FileSignature,
  HardDrive,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiClient, ApiError } from '../../services/api/client';
import type { Attachment, StorageUsage } from '../../types/documents';

// ── Limite de upload (espelha o backend: multer memory ≤ 25MB) ──
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Formata bytes em unidade legível (B/KB/MB/GB) em pt-BR. */
function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  const formatted = i === 0 ? String(bytes) : value.toFixed(value >= 10 || i === 1 ? 0 : 1);
  return `${formatted} ${units[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Ícone por origem do anexo: proposta gerada vs. upload manual. */
function attachmentIcon(source: Attachment['source']) {
  return source === 'PROPOSAL' ? (
    <FileSignature size={16} className="text-primary" aria-hidden="true" />
  ) : (
    <FileText size={16} className="text-muted-foreground" aria-hidden="true" />
  );
}

interface AttachmentsTabProps {
  /** Vincula à negociação. Informe dealId OU companyId (não ambos). */
  dealId?: string;
  companyId?: string;
}

export function AttachmentsTab({ dealId, companyId }: AttachmentsTabProps) {
  const queryClient = useQueryClient();
  const link = { dealId, companyId };
  const linkKey = dealId ? ['attachments', 'deal', dealId] : ['attachments', 'company', companyId];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // ── Lista de anexos (metadados, sem bytes) ──
  const {
    data: attachments = [],
    isLoading,
    isError,
  } = useQuery<Attachment[]>({
    queryKey: linkKey,
    queryFn: () => apiClient.getAttachments(link).then((r) => r.data || []),
    enabled: !!(dealId || companyId),
  });

  // ── Uso de armazenamento do tenant (barra) ──
  const { data: usage } = useQuery<StorageUsage>({
    queryKey: ['storage-usage'],
    queryFn: () => apiClient.getStorageUsage().then((r) => r.data),
    staleTime: 30 * 1000,
  });

  const refetchAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: linkKey });
    queryClient.invalidateQueries({ queryKey: ['storage-usage'] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, dealId, companyId]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(
          `Arquivo muito grande (${formatBytes(file.size)}). O limite por arquivo é ${formatBytes(
            MAX_UPLOAD_BYTES
          )}.`
        );
        return;
      }
      setUploading(true);
      try {
        await apiClient.uploadAttachment(file, link);
        toast.success('Arquivo enviado');
        refetchAll();
      } catch (err) {
        // Mensagem clara para o limite de storage do tenant (413/422 STORAGE_LIMIT).
        if (err instanceof ApiError && (err.statusCode === 413 || err.statusCode === 422)) {
          toast.error(
            err.message ||
              'Armazenamento do tenant esgotado. Exclua arquivos ou aumente o limite do plano.'
          );
        } else {
          toast.error(err instanceof Error ? err.message : 'Falha no upload');
        }
      } finally {
        setUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dealId, companyId, refetchAll]
  );

  const handleFilesSelected = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      // Envia sequencialmente (um POST por arquivo) — respeita o limite do tenant a cada passo.
      Array.from(files).reduce<Promise<void>>(
        (chain, file) => chain.then(() => handleUpload(file)),
        Promise.resolve()
      );
    },
    [handleUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      handleFilesSelected(e.dataTransfer.files);
    },
    [handleFilesSelected]
  );

  const handleDownload = useCallback(async (att: Attachment) => {
    setDownloadingId(att.id);
    try {
      const blob = await apiClient.downloadAttachment(att.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao baixar arquivo');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const handleDelete = useCallback(
    async (att: Attachment) => {
      setDeletingId(att.id);
      try {
        await apiClient.deleteAttachment(att.id);
        toast.success('Arquivo excluído');
        refetchAll();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Falha ao excluir');
      } finally {
        setDeletingId(null);
      }
    },
    [refetchAll]
  );

  const unlimited = !usage || usage.limitMB === 0;
  const usagePct =
    usage && usage.limitMB > 0 ? Math.min(100, (usage.usedMB / usage.limitMB) * 100) : 0;
  const nearLimit = usagePct >= 90;

  return (
    <div className="space-y-4">
      {/* Barra de uso do tenant */}
      {usage && (
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive size={12} aria-hidden="true" />
              Armazenamento do tenant
            </span>
            <span className="text-xs text-muted-foreground">
              {usage.usedMB.toFixed(1)} MB
              {unlimited ? ' usados' : ` de ${usage.limitMB} MB`}
            </span>
          </div>
          {!unlimited && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  nearLimit ? 'bg-destructive' : 'bg-primary'
                }`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          )}
          {nearLimit && !unlimited && (
            <p className="text-xs text-destructive mt-1.5">
              Armazenamento quase cheio. Exclua arquivos ou aumente o limite do plano.
            </p>
          )}
        </div>
      )}

      {/* Zona de upload (drag-drop simples, sem lib) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card hover:border-primary/50'
        }`}
      >
        {uploading ? (
          <Loader2 size={28} className="animate-spin text-primary" aria-hidden="true" />
        ) : (
          <Upload size={28} className="text-muted-foreground" aria-hidden="true" />
        )}
        <p className="text-sm text-foreground font-medium">
          {uploading ? 'Enviando…' : 'Arraste arquivos aqui ou clique para selecionar'}
        </p>
        <p className="text-xs text-muted-foreground">
          Até {formatBytes(MAX_UPLOAD_BYTES)} por arquivo (PDF, imagens, Office, texto, CSV)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFilesSelected(e.target.files);
            // Permite reenviar o mesmo arquivo em sequência.
            e.target.value = '';
          }}
        />
      </div>

      {/* Lista de anexos */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : isError ? (
          <div className="text-center py-12">
            <FileText size={40} className="mx-auto text-muted-foreground mb-3" aria-hidden="true" />
            <p className="text-sm text-destructive">Erro ao carregar arquivos.</p>
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={40} className="mx-auto text-muted-foreground mb-3" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Nenhum arquivo anexado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Envie um arquivo acima ou gere uma proposta.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {attachments.map((att) => (
              <li key={att.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-shrink-0">{attachmentIcon(att.source)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{att.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(att.size)}
                    {att.uploadedBy?.name ? ` — ${att.uploadedBy.name}` : ''}
                    {' — '}
                    {formatDate(att.createdAt)}
                    {att.source === 'PROPOSAL' ? ' — Proposta gerada' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownload(att)}
                    disabled={downloadingId === att.id}
                    aria-label={`Baixar ${att.name}`}
                    title="Baixar"
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {downloadingId === att.id ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Download size={16} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(att)}
                    disabled={deletingId === att.id}
                    aria-label={`Excluir ${att.name}`}
                    title="Excluir"
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    {deletingId === att.id ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 size={16} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
