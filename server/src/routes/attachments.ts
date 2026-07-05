/**
 * /attachments — Central de arquivos (Upgrade RD P2, req 22).
 *
 * Handlers reais (dono B2) sobre `storageService` + `attachmentService`:
 *   POST   /attachments               multipart (file ≤25MB) + dealId?/companyId?
 *   GET    /attachments?dealId=|companyId=   metadados (sem bytes)
 *   GET    /attachments/usage         { usedMB, limitMB }  (antes de /:id/download)
 *   GET    /attachments/:id/download  stream com mimeType/Content-Disposition
 *   DELETE /attachments/:id           soft-delete (integra Lixeira P1)
 *
 * Multi-tenant: toda query filtra por tenantId. Upload valida allowlist de
 * mimeType, tamanho ≤25MB e sanitiza o nome; download força
 * `Content-Disposition: attachment` (nunca inline) para tipos perigosos.
 */
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import prisma from '../config/database.js';
import { storageService } from '../services/storageService.js';
import {
  MAX_UPLOAD_BYTES,
  isAllowedMimeType,
  sanitizeFileName,
  attachmentSelect,
  toAttachmentDto,
} from '../services/attachmentService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

// Traduz erros do multer (ex.: arquivo grande demais) para o formato do projeto.
function handleUpload(field: string) {
  const mw = upload.single(field);
  return (req: any, res: any, next: any) => {
    mw(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return next(
            createError('Arquivo excede o tamanho máximo de 25 MB.', 413, 'FILE_TOO_LARGE')
          );
        }
        return next(createError('Falha no upload do arquivo.', 400, 'UPLOAD_FAILED'));
      }
      next();
    });
  };
}

const linkSchema = z.object({
  dealId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
});

const listQuerySchema = z.object({
  dealId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
});

// ─── POST / — Upload de anexo ────────────────────────────────────────────────

router.post('/', handleUpload('file'), async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const file = (req as any).file as
      | { originalname: string; mimetype: string; buffer: Buffer }
      | undefined;
    if (!file) {
      return next(createError('Nenhum arquivo enviado (campo "file").', 400, 'NO_FILE'));
    }

    const mimeType = file.mimetype || 'application/octet-stream';
    if (!isAllowedMimeType(mimeType)) {
      return next(
        createError(`Tipo de arquivo não permitido: ${mimeType}.`, 415, 'UNSUPPORTED_MEDIA_TYPE')
      );
    }

    const { dealId, companyId } = linkSchema.parse(req.body);
    const { tenantId } = req.user;

    // Valida que o vínculo (deal/empresa) pertence ao tenant, quando informado.
    if (dealId) {
      const deal = await prisma.deal.findFirst({
        where: { id: dealId, tenantId },
        select: { id: true },
      });
      if (!deal) return next(createError('Negócio não encontrado.', 404, 'DEAL_NOT_FOUND'));
    }
    if (companyId) {
      const company = await prisma.company.findFirst({
        where: { id: companyId, tenantId },
        select: { id: true },
      });
      if (!company) return next(createError('Empresa não encontrada.', 404, 'COMPANY_NOT_FOUND'));
    }

    const attachment = await storageService.put(tenantId, {
      name: sanitizeFileName(file.originalname),
      mimeType,
      buffer: file.buffer,
      dealId: dealId ?? null,
      companyId: companyId ?? null,
      source: 'UPLOAD',
      uploadedById: req.user.userId,
    });

    res.status(201).json({ status: 201, data: toAttachmentDto(attachment) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── GET / — Lista de anexos (metadados, sem bytes) ──────────────────────────

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const { dealId, companyId } = listQuerySchema.parse(req.query);
    const { tenantId } = req.user;

    const attachments = await prisma.attachment.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(dealId ? { dealId } : {}),
        ...(companyId ? { companyId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: attachmentSelect,
    });

    res.json({ status: 200, data: attachments.map(toAttachmentDto) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── GET /usage — Uso de armazenamento do tenant ─────────────────────────────
// DEVE vir antes de /:id/download para não ser capturado pelo param.

router.get('/usage', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const usage = await storageService.usage(req.user.tenantId);
    res.json({ status: 200, data: usage });
  } catch (error) {
    next(error);
  }
});

// ─── GET /:id/download — Stream dos bytes (tenant-scoped) ─────────────────────

router.get('/:id/download', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const { id } = req.params;
    const { tenantId } = req.user;

    const attachment = await prisma.attachment.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!attachment) {
      return next(createError('Arquivo não encontrado.', 404, 'ATTACHMENT_NOT_FOUND'));
    }

    const buffer = await storageService.get(attachment);

    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(buffer.length));
    // Sempre `attachment` (nunca inline) — defesa contra XSS via tipos perigosos.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachment.name)}"`
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /:id — Soft-delete ───────────────────────────────────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const { id } = req.params;
    const { tenantId } = req.user;

    const existing = await prisma.attachment.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      return next(createError('Arquivo não encontrado.', 404, 'ATTACHMENT_NOT_FOUND'));
    }

    await storageService.remove(tenantId, id);
    res.json({ status: 200, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

export default router;
