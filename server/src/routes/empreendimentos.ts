import { Router } from 'express';
import { z } from 'zod';
import { empreendimentoService } from '../services/empreendimentoService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { approvalService } from '../services/approvalService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  type: z.string().optional(),
  location: z.string().optional(),
  estimatedValue: z.number().nonnegative().optional(),
  phase: z.string().optional(),
  expectedDecisionDate: z.string().datetime().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
});

const updateSchema = createSchema.partial().omit({ companyId: true });

const querySchema = z.object({
  companyId: z.string().uuid().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const filters = querySchema.parse(req.query);
    const result = await empreendimentoService.findAll(req.user.tenantId, filters);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = createSchema.parse(req.body);
    const item = await empreendimentoService.create(req.user.tenantId, req.user.userId, data);
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const item = await empreendimentoService.findById(req.user.tenantId, req.params.id);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = updateSchema.parse(req.body);
    const item = await empreendimentoService.update(req.user.tenantId, req.params.id, data);
    res.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    // Gate de exclusão (req 16): sem permissão OU perfil exige aprovação → 202.
    const gate = await approvalService.deleteGate(
      {
        userId: req.user.userId,
        tenantId: req.user.tenantId,
        role: req.user.role,
        isPlatformAdmin: req.user.isPlatformAdmin,
      },
      'empreendimentos',
      req.params.id,
      'empreendimento'
    );
    if (gate.queued) {
      return res.status(202).json({ status: 202, data: { approvalId: gate.approvalId, pending: true } });
    }

    await empreendimentoService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
