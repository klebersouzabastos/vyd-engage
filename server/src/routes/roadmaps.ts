import { Router } from 'express';
import { z } from 'zod';
import {
  CommercialRoadmapStatus,
  StakeholderRole,
  StakeholderPosture,
  CommercialFunction,
} from '@prisma/client';
import { roadmapService, IMPORT_MAX_ROWS } from '../services/roadmapService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getEffective } from '../services/permissionService.js';
import { emitToTenant } from '../services/socketService.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { approvalService } from '../services/approvalService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);
// "Desdobramento comercial" é painel de nível-time (req 11): só GESTOR/ADMIN,
// imposto no backend (a UI apenas esconde a aba).
router.use(requireRole('ADMIN', 'GESTOR'));

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
  // Mapeamento função→pessoa escolhido ao aplicar um playbook com funções.
  roleAssignments: z
    .array(z.object({ function: z.nativeEnum(CommercialFunction), userId: z.string().uuid() }))
    .optional(),
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

    // Gate de exclusão (req 16): sem permissão OU perfil exige aprovação → 202.
    const gate = await approvalService.deleteGate(
      {
        userId: req.user.userId,
        tenantId: req.user.tenantId,
        role: req.user.role,
        isPlatformAdmin: req.user.isPlatformAdmin,
      },
      'roadmaps',
      req.params.id,
      'desdobramento'
    );
    if (gate.queued) {
      return res.status(202).json({ status: 202, data: { approvalId: gate.approvalId, pending: true } });
    }

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

// ── Decisores a partir da pesquisa de Empresa (cap. 7) ────────────────────────
const importPreviewQuery = z.object({ deepResearchId: z.string().uuid().optional() });
const importRowSchema = z.object({
  name: z.string().min(1).max(200),
  position: z.string().max(200).optional(),
  email: z.string().email().optional(),
  classification: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  roleInDecision: z.nativeEnum(StakeholderRole),
  posture: z.nativeEnum(StakeholderPosture).optional(),
  existingLeadId: z.string().uuid().optional(),
});
const importSchema = z.object({
  deepResearchId: z.string().uuid(),
  rows: z.array(importRowSchema).min(1).max(IMPORT_MAX_ROWS),
});

router.get('/:id/stakeholders/import-preview', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { deepResearchId } = importPreviewQuery.parse(req.query);
    const out = await roadmapService.previewStakeholdersFromResearch(
      req.user.tenantId,
      req.params.id,
      deepResearchId
    );
    res.json(out);
  } catch (error) {
    zodNext(error, next);
  }
});

router.post('/:id/stakeholders/import', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = importSchema.parse(req.body);

    // Linhas novas viram Leads: mesma guarda de permissão e de limite do plano
    // do POST /leads/contacts (contato conta como Lead no plano).
    if (data.rows.some((r) => !r.existingLeadId)) {
      const eff = await getEffective({
        userId: req.user.userId,
        tenantId: req.user.tenantId,
        role: req.user.role,
        isPlatformAdmin: req.user.isPlatformAdmin,
      });
      if (!eff.entities.leads.create) {
        return next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
      }
      const { planLimitsService } = await import('../services/planLimitsService.js');
      await planLimitsService.enforceLimit(req.user.tenantId, 'leads');
    }

    const out = await roadmapService.importStakeholdersFromResearch(
      req.user.tenantId,
      req.params.id,
      data
    );
    if (out.created > 0) {
      const { planLimitsService } = await import('../services/planLimitsService.js');
      planLimitsService.invalidateUsage(req.user.tenantId).catch(() => {});
      for (const lead of out.createdLeads) emitToTenant(req.user.tenantId, 'lead:created', { lead });
    }
    res.status(201).json(out);
  } catch (error) {
    zodNext(error, next);
  }
});

export default router;
