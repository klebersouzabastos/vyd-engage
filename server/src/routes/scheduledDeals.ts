import { Router } from 'express';
import { z } from 'zod';
import { ScheduledDealStatus, ScheduledDealType } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { scheduledDealService } from '../services/scheduledDealService.js';
import { visibilityScope, getEffective } from '../services/permissionService.js';

/**
 * Multi-vendas — negociações agendadas (Upgrade RD P0, spec req 4).
 * /api/v1/scheduled-deals
 *
 *   POST /            — agenda a próxima negociação a partir de um deal do tenant
 *   GET  /?status=&originDealId= — lista (escopo por papel igual deals)
 *   POST /:id/cancel  — cancela agendamento PENDING
 *
 * Datas no passado são aceitas no POST: o job salesOps cria o deal na
 * próxima varredura (caso extremo documentado na spec).
 */
const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createSchema = z.object({
  originDealId: z.string().uuid(),
  type: z.nativeEnum(ScheduledDealType),
  scheduledFor: z.string().min(1),
  funnelId: z.string().uuid().optional(),
  funnelColumnId: z.string().uuid().optional(),
  estimatedValue: z.number().min(0).optional(),
  assignedTo: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

const listSchema = z.object({
  status: z.nativeEnum(ScheduledDealStatus).optional(),
  originDealId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
});

// POST /api/v1/scheduled-deals — agendar próxima negociação
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = createSchema.parse(req.body);
    // transferOwner (req 13): agendar para OUTRA pessoa exige a capability (perfil).
    // Sem ela, o responsável é forçado a si mesmo — o piso do analista de hoje.
    // BYTE-A-BYTE == HOJE: USER builtin transferOwner=false → forçado; ADMIN/GESTOR livre.
    const eff = await getEffective({
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      role: req.user.role,
      isPlatformAdmin: req.user.isPlatformAdmin,
    });
    if (eff.capabilities.transferOwner !== true) data.assignedTo = req.user.userId;
    const scheduled = await scheduledDealService.create(req.user.tenantId, req.user.userId, data);
    res.status(201).json({ status: 201, data: scheduled });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// GET /api/v1/scheduled-deals?status=PENDING&originDealId= — listar agendamentos
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const filters = listSchema.parse(req.query);
    // Visibilidade viva (req 14): agendamentos seguem 'deals'. BYTE-A-BYTE == HOJE:
    // USER builtin PROPRIA→userId; GESTOR/ADMIN GERAL→requested. Custom EQUIPE→{in}.
    const scopedFilters = {
      ...filters,
      assignedTo: await visibilityScope(req.user, 'deals', filters.assignedTo),
    };
    const items = await scheduledDealService.findAll(req.user.tenantId, scopedFilters);
    res.json({ status: 200, data: items });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// POST /api/v1/scheduled-deals/:id/cancel — cancelar agendamento PENDING
router.post('/:id/cancel', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    // Visibilidade viva (req 14): cancelar limita-se ao escopo de 'deals'. == HOJE:
    // USER builtin PROPRIA→userId; GESTOR/ADMIN GERAL→undefined (irrestrito).
    const restrictTo = await visibilityScope(req.user, 'deals');
    const cancelled = await scheduledDealService.cancel(
      req.user.tenantId,
      req.params.id,
      restrictTo
    );
    res.json({ status: 200, data: cancelled });
  } catch (error) {
    next(error);
  }
});

export default router;
