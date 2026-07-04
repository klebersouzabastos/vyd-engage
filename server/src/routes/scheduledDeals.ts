import { Router } from 'express';
import { z } from 'zod';
import { ScheduledDealStatus, ScheduledDealType } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { ownerScope, isAnalyst } from '../utils/roleScope.js';
import { scheduledDealService } from '../services/scheduledDealService.js';

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
    // Analista (USER) só agenda para si mesmo (mesmo escopo de deals).
    if (isAnalyst(req.user)) data.assignedTo = req.user.userId;
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
    // Escopo por papel igual deals: analista só vê os seus (ownerScope).
    filters.assignedTo = ownerScope(req.user, filters.assignedTo);
    const items = await scheduledDealService.findAll(req.user.tenantId, filters);
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
    const restrictTo = isAnalyst(req.user) ? req.user.userId : undefined;
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
