/**
 * storageService — abstração de armazenamento de anexos (Upgrade RD P2, req 22).
 *
 * Provider "db" (AttachmentBlob bytea) é o ÚNICO ativo neste ambiente. O provider
 * "s3" fica como interface GATED por env STORAGE_S3_* (endpoint/bucket/chaves) e só
 * é usado quando o SDK `@aws-sdk/client-s3` estiver instalado — que HOJE não está.
 * Nesse caso o serviço loga um aviso e faz fallback para "db" (nunca quebra).
 *
 * Limite por tenant: `put` soma o tamanho dos anexos vivos (deletedAt null) e
 * recusa (422 STORAGE_LIMIT) quando o novo arquivo estouraria `maxStorageMB` do
 * plano (planLimitsService.resolveStorageLimitMB).
 *
 * Multi-tenant: todo acesso é escopado por tenantId; `get`/`remove` recebem o
 * Attachment já validado pelo caller (rota valida tenant antes de ler bytes).
 */
import type { Attachment } from '@prisma/client';
import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { planLimitsService } from './planLimitsService.js';
import { logger } from '../utils/logger.js';

const BYTES_PER_MB = 1024 * 1024;

export interface PutAttachmentInput {
  name: string;
  mimeType: string;
  buffer: Buffer;
  dealId?: string | null;
  companyId?: string | null;
  source?: 'UPLOAD' | 'PROPOSAL';
  uploadedById?: string | null;
}

export interface StorageUsage {
  usedMB: number;
  limitMB: number; // 0 = ilimitado (Infinity), coerente com o resto de planLimits
}

/** True quando o provider "s3" está configurado por env (endpoint/bucket/chaves). */
function isS3Configured(): boolean {
  return Boolean(
    process.env.STORAGE_S3_BUCKET &&
      process.env.STORAGE_S3_ACCESS_KEY_ID &&
      process.env.STORAGE_S3_SECRET_ACCESS_KEY
  );
}

// Especificador do provider S3 mantido como string em runtime para que o `tsc`
// NÃO tente resolver o módulo em build (ele é opcional/gated — só existe quando
// alguém adiciona `s3StorageProvider.ts` + instala `@aws-sdk/client-s3`). Sem
// isso, o provider "db" é o único ATIVO. Ver design P2 (gating de storage).
const S3_PROVIDER_MODULE = './s3StorageProvider.js';

interface S3Provider {
  putObject?: (
    tenantId: string,
    name: string,
    mimeType: string,
    buffer: Buffer
  ) => Promise<string>;
  getObject?: (key: string) => Promise<Buffer>;
}

async function loadS3Provider(): Promise<S3Provider | null> {
  try {
    // Import indireto (especificador em variável) — não resolvido em build.
    return (await import(/* @vite-ignore */ S3_PROVIDER_MODULE)) as S3Provider;
  } catch {
    return null;
  }
}

/** Soma dos bytes dos anexos vivos (não deletados) do tenant. */
async function usedBytes(tenantId: string): Promise<number> {
  const agg = await prisma.attachment.aggregate({
    where: { tenantId, deletedAt: null },
    _sum: { size: true },
  });
  return agg._sum.size ?? 0;
}

export const storageService = {
  /**
   * Persiste um novo anexo respeitando o limite de armazenamento do tenant.
   * Cria o metadado (Attachment) e, no provider "db", o blob (AttachmentBlob).
   */
  async put(tenantId: string, input: PutAttachmentInput): Promise<Attachment> {
    const size = input.buffer.length;

    // Checagem de limite: uso atual + novo arquivo ≤ maxStorageMB (a menos de ilimitado).
    const limitMB = await planLimitsService.resolveStorageLimitMB(tenantId);
    if (Number.isFinite(limitMB)) {
      const current = await usedBytes(tenantId);
      const limitBytes = limitMB * BYTES_PER_MB;
      if (current + size > limitBytes) {
        throw createError(
          `Limite de armazenamento atingido (${limitMB}MB). Exclua arquivos ou faça upgrade do plano.`,
          422,
          'STORAGE_LIMIT',
          { usedMB: Math.round((current / BYTES_PER_MB) * 100) / 100, limitMB }
        );
      }
    }

    // Provider: "s3" só se configurado E o SDK disponível; senão "db".
    let storageProvider = 'db';
    let storageKey: string;

    if (isS3Configured()) {
      // O SDK/adapter S3 pode não estar instalado (gated). Se ausente ou falho,
      // caímos em "db" sem quebrar o upload.
      const s3 = await loadS3Provider();
      if (s3 && typeof s3.putObject === 'function') {
        try {
          storageKey = await s3.putObject(tenantId, input.name, input.mimeType, input.buffer);
          storageProvider = 's3';
        } catch (err) {
          logger.warn('Falha no provider S3 — fallback para "db".', err);
          storageKey = await this.putDbBlob(input.buffer);
          storageProvider = 'db';
        }
      } else {
        logger.warn(
          'STORAGE_S3_* configurado mas provider S3 indisponível — usando provider "db".'
        );
        storageKey = await this.putDbBlob(input.buffer);
      }
    } else {
      storageKey = await this.putDbBlob(input.buffer);
    }

    return prisma.attachment.create({
      data: {
        tenantId,
        name: input.name,
        mimeType: input.mimeType,
        size,
        storageProvider,
        storageKey,
        dealId: input.dealId ?? null,
        companyId: input.companyId ?? null,
        source: input.source ?? 'UPLOAD',
        uploadedById: input.uploadedById ?? null,
      },
    });
  },

  /** Cria um AttachmentBlob e retorna seu id (usado como storageKey do provider "db"). */
  async putDbBlob(buffer: Buffer): Promise<string> {
    const blob = await prisma.attachmentBlob.create({ data: { data: buffer } });
    return blob.id;
  },

  /** Lê os bytes de um anexo. Assume que o caller já validou tenant/visibilidade. */
  async get(attachment: Pick<Attachment, 'storageProvider' | 'storageKey'>): Promise<Buffer> {
    if (attachment.storageProvider === 's3') {
      const s3 = await loadS3Provider();
      if (!s3 || typeof s3.getObject !== 'function') {
        throw createError('Provider S3 indisponível para leitura do anexo.', 500, 'S3_UNAVAILABLE');
      }
      return s3.getObject(attachment.storageKey);
    }
    const blob = await prisma.attachmentBlob.findUnique({ where: { id: attachment.storageKey } });
    if (!blob) throw createError('Arquivo não encontrado.', 404, 'ATTACHMENT_BLOB_NOT_FOUND');
    return Buffer.from(blob.data);
  },

  /**
   * Soft-delete do anexo (marca deletedAt). Os bytes do blob são purgados pelo
   * job de Lixeira (P1) no expurgo — mantemos o blob para permitir restauração.
   */
  async remove(tenantId: string, attachmentId: string): Promise<void> {
    await prisma.attachment.updateMany({
      where: { id: attachmentId, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  },

  /** Uso de armazenamento do tenant em MB + limite (0 = ilimitado). */
  async usage(tenantId: string): Promise<StorageUsage> {
    const [bytes, limitMB] = await Promise.all([
      usedBytes(tenantId),
      planLimitsService.resolveStorageLimitMB(tenantId),
    ]);
    return {
      usedMB: Math.round((bytes / BYTES_PER_MB) * 100) / 100,
      limitMB: Number.isFinite(limitMB) ? limitMB : 0,
    };
  },
};
