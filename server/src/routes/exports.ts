import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { exportLeads, exportDeals, exportTasks, ExportFormat } from '../services/exportService.js';
import { getEffective, visibilityScope } from '../services/permissionService.js';
import { approvalService } from '../services/approvalService.js';
import { ApprovalType } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

// Enforcement de capability (req 13): exportar exige `exportData`. FAIL-CLOSED —
// sem perfil custom, USER/GESTOR/ADMIN têm exportData=true (== hoje); só nega quando
// um admin restringiu explicitamente.
router.use(requirePermission('exportData'));

const VALID_FORMATS: ExportFormat[] = ['json', 'csv', 'xlsx'];

function parseFormat(raw: unknown): ExportFormat {
  const fmt = String(raw || 'json').toLowerCase() as ExportFormat;
  return VALID_FORMATS.includes(fmt) ? fmt : 'json';
}

/**
 * Decide entre exportar agora ou criar uma solicitação de aprovação (req 15).
 * Retorna true quando a solicitação foi criada (chamador NÃO deve exportar).
 * Sem perfil custom, requireApprovalFor.export=false → sempre exporta (== hoje).
 */
async function maybeQueueExport(
  req: import('express').Request,
  res: import('express').Response,
  entity: 'leads' | 'deals' | 'tasks',
  format: ExportFormat,
  filters: Record<string, unknown>
): Promise<boolean> {
  const user = req.user!;
  const effective = await getEffective({
    userId: user.userId,
    tenantId: user.tenantId,
    role: user.role,
    isPlatformAdmin: user.isPlatformAdmin,
  });
  if (!effective.requireApprovalFor.export) return false;

  const label = { leads: 'leads', deals: 'negociações', tasks: 'tarefas' }[entity];
  const { approvalId, pending } = await approvalService.createApproval({
    tenantId: user.tenantId,
    requestedById: user.userId,
    type: ApprovalType.EXPORT,
    payload: { entity, format, filters },
    summary: `Exportar ${label} (${format.toUpperCase()})`,
  });
  res.status(202).json({ status: 202, data: { approvalId, pending } });
  return true;
}

// GET /api/exports/leads?format=csv|xlsx|json&status=...&search=...
router.get('/leads', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const format = parseFormat(req.query.format);
    const filters = {
      status: req.query.status as string | undefined,
      source: req.query.source as string | undefined,
      search: req.query.search as string | undefined,
      tagId: req.query.tagId as string | undefined,
      // Visibilidade viva (req 14): exports seguem o escopo de 'deals' (dimensão de
      // responsável), preservando BYTE-A-BYTE o ownerScope de hoje — USER builtin
      // PROPRIA→userId; GESTOR/ADMIN GERAL→requested. Perfil custom EQUIPE→{in}.
      assignedTo: await visibilityScope(req.user, 'deals', req.query.assignedTo as string | undefined),
    };
    if (await maybeQueueExport(req, res, 'leads', format, filters)) return;
    await exportLeads(req.user.tenantId, filters, format, res);
  } catch (error) {
    next(error);
  }
});

// GET /api/exports/deals?format=csv|xlsx|json&stage=...&search=...
router.get('/deals', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const format = parseFormat(req.query.format);
    const filters = {
      stage: req.query.stage as string | undefined,
      search: req.query.search as string | undefined,
      // Visibilidade viva (req 14): escopo de 'deals'. == HOJE p/ builtins.
      assignedTo: await visibilityScope(req.user, 'deals', req.query.assignedTo as string | undefined),
      leadId: req.query.leadId as string | undefined,
      minValue: req.query.minValue ? Number(req.query.minValue) : undefined,
      maxValue: req.query.maxValue ? Number(req.query.maxValue) : undefined,
    };
    if (await maybeQueueExport(req, res, 'deals', format, filters)) return;
    await exportDeals(req.user.tenantId, filters, format, res);
  } catch (error) {
    next(error);
  }
});

// GET /api/exports/tasks?format=csv|xlsx|json&status=...&priority=...
router.get('/tasks', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const format = parseFormat(req.query.format);
    const filters = {
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      search: req.query.search as string | undefined,
      // Visibilidade viva (req 14): tarefas acompanham 'deals'. == HOJE p/ builtins.
      assignedTo: await visibilityScope(req.user, 'tasks', req.query.assignedTo as string | undefined),
      leadId: req.query.leadId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };
    if (await maybeQueueExport(req, res, 'tasks', format, filters)) return;
    await exportTasks(req.user.tenantId, filters, format, res);
  } catch (error) {
    next(error);
  }
});

export default router;
