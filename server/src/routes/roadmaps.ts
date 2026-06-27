import { Router } from 'express';
import { z } from 'zod';
import { CommercialRoadmapStatus, StakeholderRole, StakeholderPosture } from '@prisma/client';
import { roadmapService } from '../services/roadmapService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createSchema = z.object({
  title: z.string().min(1),
  companyId: z.string().uuid(),
  empreendimentoId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  deepResearchId: z.string().uuid().optional(),
  playbookTemplateId: z.string().uuid().optional(),
  status: z.nativeEnum(CommercialRoadmapStatus).optional(),
  targetProposalDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  empreendimentoId: z.string().uuid().nullable().optional(),
  dealId: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(CommercialRoadmapStatus).optional(),
  targetProposalDate: z.string().datetime().nullable().optional(),
  notes: z.string().optional(),
});

const querySchema = z.object({
  companyId: z.string().uuid().optional(),
  empreendimentoId: z.string().uuid().optional(),
  status: z.nativeEnum(CommercialRoadmapStatus).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const stakeholderSchema = z.object({
  leadId: z.string().uuid(),
  roleInDecision: z.nativeEnum(StakeholderRole).optional(),
  posture: z.nativeEnum(StakeholderPosture).optional(),
  notes: z.string().optional(),
});

const panelQuerySchema = z.object({
  assignedTo: z.string().uuid().optional(),
  riskDays: z.coerce.number().int().min(1).max(90).optional(),
});

function zodNext(error: unknown, next: (e: unknown) => void) {
  if (error instanceof z.ZodError) {
    return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
  }
  next(error);
}

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    res.json(await roadmapService.findAll(req.user.tenantId, querySchema.parse(req.query)));
  } catch (error) {
    zodNext(error, next);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = createSchema.parse(req.body);
    const item = await roadmapService.create(req.user.tenantId, req.user.userId, data);
    res.status(201).json(item);
  } catch (error) {
    zodNext(error, next);
  }
});

// Painel "não deixar passar" — registrado antes de /:id para não colidir.
router.get('/panel', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    res.json(await roadmapService.getPanel(req.user.tenantId, panelQuerySchema.parse(req.query)));
  } catch (error) {
    zodNext(error, next);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    res.json(await roadmapService.findById(req.user.tenantId, req.params.id));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = updateSchema.parse(req.body);
    res.json(await roadmapService.update(req.user.tenantId, req.params.id, data));
  } catch (error) {
    zodNext(error, next);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    await roadmapService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/:id/advance-to-proposal', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const item = await roadmapService.advanceToProposal(
      req.user.tenantId,
      req.params.id,
      req.user.userId
    );
    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/stakeholders', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = stakeholderSchema.parse(req.body);
    const item = await roadmapService.upsertStakeholder(req.user.tenantId, req.params.id, data);
    res.status(201).json(item);
  } catch (error) {
    zodNext(error, next);
  }
});

router.delete('/:id/stakeholders/:leadId', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    await roadmapService.removeStakeholder(req.user.tenantId, req.params.id, req.params.leadId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
