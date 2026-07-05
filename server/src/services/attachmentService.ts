/**
 * attachmentService — regras de anexo compartilhadas (Upgrade RD P2, req 22).
 *
 * Concentra allowlist de mimeType, sanitização de nome e o DTO público (nunca
 * expõe storageKey/bytes), reusados pela rota `/attachments` e pelo
 * `proposalService` (PDF gerado = Attachment source=PROPOSAL). A persistência
 * dos bytes fica no `storageService` (provider "db" | "s3" gated).
 */
import type { Attachment } from '@prisma/client';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

// Allowlist de mimeTypes (PDF / imagem / office / texto / csv). Qualquer tipo
// fora da lista é recusado (415) no upload de usuário.
export const ALLOWED_MIME_TYPES = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/csv',
]);

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

/**
 * Sanitiza o nome do arquivo: remove componentes de caminho, caracteres de
 * controle e os proibidos em nomes de arquivo; normaliza espaços. Mantém acentos
 * (pt-BR). Limita a 255 chars. Fallback "arquivo".
 */
export function sanitizeFileName(raw: string | undefined | null): string {
  const base =
    String(raw ?? '')
      .replace(/\\/g, '/')
      .split('/')
      .pop() ?? '';
  const cleaned = base
    // Remove caracteres de controle (0x00-0x1F) e proibidos (<>:"/\|?*).
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255);
  return cleaned || 'arquivo';
}

/** Campos do Attachment expostos ao cliente (metadados; nunca storageKey/bytes). */
export const attachmentSelect = {
  id: true,
  tenantId: true,
  name: true,
  mimeType: true,
  size: true,
  storageProvider: true,
  dealId: true,
  companyId: true,
  source: true,
  uploadedById: true,
  createdAt: true,
} as const;

export interface AttachmentDto {
  id: string;
  tenantId: string;
  name: string;
  mimeType: string;
  size: number;
  storageProvider: string;
  dealId: string | null;
  companyId: string | null;
  source: string;
  uploadedById: string | null;
  createdAt: Date;
}

/** Metadados públicos do anexo (nunca expõe storageKey/bytes). */
export function toAttachmentDto(a: Pick<Attachment, keyof AttachmentDto>): AttachmentDto {
  return {
    id: a.id,
    tenantId: a.tenantId,
    name: a.name,
    mimeType: a.mimeType,
    size: a.size,
    storageProvider: a.storageProvider,
    dealId: a.dealId,
    companyId: a.companyId,
    source: a.source,
    uploadedById: a.uploadedById,
    createdAt: a.createdAt,
  };
}
