/**
 * /approvals — fila de aprovações de export/bulk/delete (Upgrade RD P1, reqs 15/16).
 *
 * A CRIAÇÃO de ApprovalRequest nasce dentro dos gates de export/bulk/delete
 * (approvalService.createApproval), NÃO aqui. Estas rotas gerenciam a fila:
 *   - GET    /            (ADMIN/GESTOR) — lista, filtro por ?status=PENDING
 *   - POST   /:id/approve (ADMIN/GESTOR) — executa a ação embutida → EXECUTED
 *   - POST   /:id/reject  (ADMIN/GESTOR) — {reason} → REJECTED
 *   - GET    /:id/download (solicitante) — baixa um EXPORT já aprovado/executado
 *
 * Tenant-scoped (auth + tenantScope aplicados a todas). CSRF já whitelistado em
 * index.ts.
 */
import { Router } from 'express';
import { z } from 'zod';
import { ApprovalStatus, ApprovalType } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { approvalService } from '../services/approvalService.js';
import type { ExportPayload } from '../services/approvalService.js';
import { exportLeads, exportDeals, exportTasks } from '../services/exportService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const MANAGER_ROLES = ['ADMIN', 'GESTOR'] as const;

// GET /approvals?status=PENDING — fila (ADMIN/GESTOR).
router.get('/', requireRole(...MANAGER_ROLES), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const statusRaw = req.query.status as string | undefined;
    const status =
      statusRaw && (Object.values(ApprovalStatus) as string[]).includes(statusRaw)
        ? (statusRaw as ApprovalStatus)
        : undefined;
    const items = await approvalService.listApprovals(req.user.tenantId, status);
    res.json({ status: 200, data: items });
  } catch (error) {
    next(error);
  }
});

// GET /approvals/mine?status= — as solicitações do PRÓPRIO usuário (req 15).
// SEM requireRole: o USER restrito precisa de uma rota própria para acompanhar e
// baixar (via /:id/download) suas solicitações. Tenant-scoped + requestedById.
router.get('/mine', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const statusRaw = req.query.status as string | undefined;
    const status =
      statusRaw && (Object.values(ApprovalStatus) as string[]).includes(statusRaw)
        ? (statusRaw as ApprovalStatus)
        : undefined;
    const items = await approvalService.listMine(req.user.tenantId, req.user.userId, status);
    res.json({ status: 200, data: items });
  } catch (error) {
    next(error);
  }
});

// POST /approvals/:id/approve — executa a ação embutida (ADMIN/GESTOR).
router.post('/:id/approve', requireRole(...MANAGER_ROLES), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const result = await approvalService.approve(req.user.tenantId, req.params.id, req.user.userId);
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

const rejectSchema = z.object({ reason: z.string().min(1).max(1000) });

// POST /approvals/:id/reject {reason} — rejeita (ADMIN/GESTOR).
router.post('/:id/reject', requireRole(...MANAGER_ROLES), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { reason } = rejectSchema.parse(req.body);
    const result = await approvalService.reject(
      req.user.tenantId,
      req.params.id,
      req.user.userId,
      reason
    );
    res.json({ status: 200, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

/**
 * GET /approvals/:id/download — baixa um EXPORT aprovado. Apenas o SOLICITANTE
 * pode baixar sua própria exportação, e somente após aprovação (status EXECUTED).
 * Re-executa a exportação com o payload salvo, escopo do tenant.
 */
router.get('/:id/download', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const approval = await approvalService.getApproval(req.user.tenantId, req.params.id);
    if (!approval) return next(createError('Solicitação não encontrada', 404, 'APPROVAL_NOT_FOUND'));
    if (approval.type !== ApprovalType.EXPORT) {
      return next(createError('Solicitação não é uma exportação', 400, 'APPROVAL_NOT_EXPORT'));
    }
    if (approval.requestedById !== req.user.userId) {
      return next(createError('Apenas o solicitante pode baixar esta exportação', 403, 'NOT_REQUESTER'));
    }
    if (approval.status !== ApprovalStatus.EXECUTED) {
      return next(createError('Exportação ainda não aprovada', 403, 'APPROVAL_NOT_EXECUTED'));
    }

    const payload = approval.payload as unknown as ExportPayload;
    const filters = (payload.filters ?? {}) as never;
    if (payload.entity === 'leads') {
      await exportLeads(req.user.tenantId, filters, payload.format, res);
    } else if (payload.entity === 'deals') {
      await exportDeals(req.user.tenantId, filters, payload.format, res);
    } else if (payload.entity === 'tasks') {
      await exportTasks(req.user.tenantId, filters, payload.format, res);
    } else {
      return next(createError('Entidade de exportação inválida', 400, 'APPROVAL_BAD_ENTITY'));
    }
  } catch (error) {
    next(error);
  }
});

export default router;
