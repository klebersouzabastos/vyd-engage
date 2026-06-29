import { Router } from 'express';
import { z } from 'zod';
import { dealService } from '../services/dealService.js';
import { forecastService } from '../services/forecastService.js';
import { getDealNextAction, getActionSummary } from '../services/nextActionService.js';
import { dealScoringService } from '../services/dealScoringService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { createError } from '../middleware/errorHandler.js';
import { DealStage } from '@prisma/client';
import prisma from '../config/database.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { dispatchTrigger } from '../jobs/automationEngine.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createDealSchema = z.object({
  name: z.string().min(1),
  value: z.number().min(0),
  stage: z.nativeEnum(DealStage).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional(),
  leadId: z.string().uuid().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  customFields: z.record(z.any()).optional(),
  lostReason: z.string().optional(),
  funnelId: z.string().uuid().optional().nullable(),
  funnelColumnId: z.string().uuid().optional().nullable(),
  // Gestão de Negócios (RD parity) — P0
  qualification: z.number().int().min(1).max(5).optional().nullable(),
  sourceId: z.string().uuid().optional().nullable(),
  originCampaignId: z.string().uuid().optional().nullable(),
  oneTimeValue: z.number().min(0).optional().nullable(),
  recurringValue: z.number().min(0).optional().nullable(),
});

const updateDealSchema = createDealSchema.partial().extend({
  id: z.string().uuid(),
});

const querySchema = z.object({
  stage: z.nativeEnum(DealStage).optional(),
  assignedTo: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  funnelId: z.string().uuid().optional(),
  search: z.string().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z
    .enum(['createdAt', 'updatedAt', 'name', 'value', 'stage', 'expectedCloseDate'])
    .optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// GET /api/deals/forecast - Monthly revenue forecast (MUST be before /:id)
router.get('/forecast', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const months = req.query.months ? Number(req.query.months) : 6;
    const assignedTo = req.query.assignedTo as string | undefined;
    const stage = req.query.stage as DealStage | undefined;

    if (stage && !Object.values(DealStage).includes(stage)) {
      return next(createError('Invalid stage', 400, 'VALIDATION_ERROR'));
    }

    const forecast = await forecastService.getForecast(req.user.tenantId, {
      months,
      assignedTo,
      stage,
    });
    res.json({ status: 200, data: forecast });
  } catch (error) {
    next(error);
  }
});

// GET /api/deals/trend - Won vs Lost trend (MUST be before /:id)
router.get('/trend', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const months = req.query.months ? Number(req.query.months) : 6;
    const trend = await forecastService.getTrend(req.user.tenantId, months);
    res.json({ status: 200, data: trend });
  } catch (error) {
    next(error);
  }
});

// GET /api/deals/stats - Aggregated metrics (MUST be before /:id)
router.get('/stats', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const stats = await dealService.getStats(req.user.tenantId);
    res.json({ status: 200, data: stats });
  } catch (error) {
    next(error);
  }
});

// GET /api/deals/action-summary - Top urgent actions across leads and deals
router.get('/action-summary', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const limit = req.query.limit ? Number(req.query.limit) : 5;
    const actions = await getActionSummary(req.user.tenantId, limit);
    res.json({ status: 200, data: actions });
  } catch (error) {
    next(error);
  }
});

// GET /api/deals/:id/next-action - Get suggested next action for a deal
// NOTE: This must be registered before /:id to avoid conflict, but Express
// handles sub-paths like /:id/next-action correctly since they have more segments.

// GET /api/deals - List deals with filters/pagination
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const filters = querySchema.parse(req.query);
    const result = await dealService.findAll(req.user.tenantId, filters);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// GET /api/deals/:id/audit - Get audit trail for a deal
router.get('/:id/audit', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const { id } = req.params;
    const { tenantId } = req.user;
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'deal', entityId: id, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { name: true, email: true } } },
    });
    res.json({ status: 200, data: { logs } });
  } catch (err) {
    next(err);
  }
});

// GET /api/deals/:id - Get deal by ID
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const deal = await dealService.findById(req.user.tenantId, req.params.id);
    res.json(deal);
  } catch (error) {
    next(error);
  }
});

// GET /api/deals/:id/proposal.pdf - Export deal as PDF proposal
router.get('/:id/proposal.pdf', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const { generateProposalPDF } = await import('../services/pdfService.js');
    const pdf = await generateProposalPDF(req.params.id, req.user.tenantId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proposta-${req.params.id}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

// GET /api/deals/:id/next-action - Get suggested next action for a deal
router.get('/:id/next-action', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const action = await getDealNextAction(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: action });
  } catch (error) {
    next(error);
  }
});

// GET /api/deals/:id/ai-score - AI close-propensity score + top-3 factors (req 22).
// Pass ?recalc=true to force an on-demand recalculation (req 21).
router.get('/:id/ai-score', aiLimiter, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const forceRecalc = req.query.recalc === 'true' || req.query.recalc === '1';
    const result = forceRecalc
      ? await dealScoringService.computeAndStore(req.user.tenantId, req.params.id)
      : await dealScoringService.getOrCompute(req.user.tenantId, req.params.id);

    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /api/deals - Create deal
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = createDealSchema.parse(req.body);
    const deal = await dealService.create(req.user.tenantId, data);

    dispatchTrigger(
      req.user.tenantId,
      'deal_created',
      deal.leadId ?? undefined,
      { dealId: deal.id, dealName: deal.name, stage: deal.stage },
      deal.id
    ).catch(() => {});

    res.status(201).json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /api/deals/:id - Update deal
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const body = req.body;
    if (body.stage === 'LOST' && !body.lostReason) {
      return res
        .status(400)
        .json({ error: 'Informe o motivo da perda (lostReason) ao marcar um deal como perdido.' });
    }

    const data = updateDealSchema.parse({
      ...body,
      id: req.params.id,
    });

    // Fetch existing deal for audit diff
    const existing = await prisma.deal.findUnique({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });

    const deal = await dealService.update(req.user.tenantId, data);

    // Fire audit log asynchronously — must not block the response
    if (existing) {
      createAuditLog({
        tenantId: req.user.tenantId,
        entityType: 'deal',
        entityId: req.params.id,
        userId: req.user.userId,
        action: 'update',
        oldData: existing as Record<string, unknown>,
        newData: deal as Record<string, unknown>,
      }).catch(() => {});

      if (existing.stage !== deal.stage) {
        dispatchTrigger(
          req.user.tenantId,
          'deal_stage_changed',
          deal.leadId ?? undefined,
          { dealId: deal.id, dealName: deal.name, fromStage: existing.stage, toStage: deal.stage },
          deal.id
        ).catch(() => {});
      }
    }

    res.json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// POST /api/deals/:id/win - Marcar venda (ganho) — req 20
router.post('/:id/win', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const deal = await dealService.markWon(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: deal });
  } catch (error) {
    next(error);
  }
});

// POST /api/deals/:id/lose - Marcar perda (exige motivo da lista configurável) — reqs 21/22
const loseSchema = z.object({ lostReasonId: z.string().uuid() });
router.post('/:id/lose', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { lostReasonId } = loseSchema.parse(req.body);
    const deal = await dealService.markLost(req.user.tenantId, req.params.id, lostReasonId);
    res.json({ status: 200, data: deal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(
        createError(
          'Informe o motivo da perda (lostReasonId).',
          400,
          'VALIDATION_ERROR',
          error.errors
        )
      );
    }
    next(error);
  }
});

// POST /api/deals/:id/pause - Pausar negociação — req 23
router.post('/:id/pause', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const deal = await dealService.pause(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: deal });
  } catch (error) {
    next(error);
  }
});

// POST /api/deals/:id/resume - Retomar negociação — req 23
router.post('/:id/resume', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const deal = await dealService.resume(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: deal });
  } catch (error) {
    next(error);
  }
});

// ── Múltiplos contatos da negociação (req 16) ──
// GET /api/deals/:id/contacts
router.get('/:id/contacts', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = await dealService.listContacts(req.user.tenantId, req.params.id);
    res.json({ status: 200, data });
  } catch (error) {
    next(error);
  }
});

const addContactSchema = z.object({
  leadId: z.string().uuid(),
  roleInDeal: z.string().max(120).optional().nullable(),
});

// POST /api/deals/:id/contacts
router.post('/:id/contacts', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const body = addContactSchema.parse(req.body);
    const data = await dealService.addContact(
      req.user.tenantId,
      req.params.id,
      body.leadId,
      body.roleInDeal
    );
    res.status(201).json({ status: 201, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/deals/:id/contacts/:contactId
router.delete('/:id/contacts/:contactId', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = await dealService.removeContact(
      req.user.tenantId,
      req.params.id,
      req.params.contactId
    );
    res.json({ status: 200, data });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/deals/:id - Delete deal
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    // Cancel any pending automation steps waiting for this deal's lead
    const deal = await prisma.deal.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId, deletedAt: null },
      select: { leadId: true },
    });
    if (deal?.leadId) {
      await prisma.automationLog.updateMany({
        where: { leadId: deal.leadId, status: 'WAITING' },
        data: { status: 'CANCELLED' },
      });
    }

    await dealService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/deals/:id/products - List deal line items with product info
router.get('/:id/products', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const { id: dealId } = req.params;
    const { tenantId } = req.user;

    // Verify deal belongs to tenant
    const deal = await prisma.deal.findFirst({ where: { id: dealId, tenantId, deletedAt: null } });
    if (!deal) return next(createError('Deal not found', 404));

    const items = await prisma.dealProduct.findMany({
      where: { dealId },
      include: { product: true },
    });
    res.json({ status: 200, data: items });
  } catch (error) {
    next(error);
  }
});

// POST /api/deals/:id/products - Add a product to deal
router.post('/:id/products', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const { id: dealId } = req.params;
    const { tenantId } = req.user;

    const schema = z.object({
      productId: z.string().uuid(),
      quantity: z.number().min(0),
      unitPrice: z.number().min(0),
      discount: z.number().min(0).max(100).default(0),
    });
    const body = schema.parse(req.body);

    // Verify deal belongs to tenant
    const deal = await prisma.deal.findFirst({ where: { id: dealId, tenantId, deletedAt: null } });
    if (!deal) return next(createError('Deal not found', 404));

    const item = await prisma.dealProduct.create({
      data: {
        dealId,
        productId: body.productId,
        quantity: body.quantity,
        unitPrice: body.unitPrice,
        discount: body.discount,
      },
      include: { product: true },
    });

    // Recalculate deal.value as sum of all line items
    const allItems = await prisma.dealProduct.findMany({ where: { dealId } });
    const newValue = allItems.reduce((sum, i) => {
      return sum + Number(i.quantity) * Number(i.unitPrice) * (1 - Number(i.discount) / 100);
    }, 0);
    await prisma.deal.update({
      where: { id: dealId },
      data: { value: Math.round(newValue * 100) / 100 },
    });

    res.status(201).json({ status: 201, data: item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/deals/:id/products/:dealProductId - Remove a line item and recalculate deal value
router.delete('/:id/products/:dealProductId', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const { id: dealId, dealProductId } = req.params;
    const { tenantId } = req.user;

    // Verify deal belongs to tenant
    const deal = await prisma.deal.findFirst({ where: { id: dealId, tenantId, deletedAt: null } });
    if (!deal) return next(createError('Deal not found', 404));

    const existing = await prisma.dealProduct.findFirst({ where: { id: dealProductId, dealId } });
    if (!existing) return next(createError('Line item not found', 404));

    await prisma.dealProduct.delete({ where: { id: dealProductId } });

    // Recalculate deal.value
    const remaining = await prisma.dealProduct.findMany({ where: { dealId } });
    const newValue = remaining.reduce((sum, i) => {
      return sum + Number(i.quantity) * Number(i.unitPrice) * (1 - Number(i.discount) / 100);
    }, 0);
    await prisma.deal.update({
      where: { id: dealId },
      data: { value: Math.round(newValue * 100) / 100 },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
