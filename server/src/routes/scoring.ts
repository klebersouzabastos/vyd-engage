import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { scoringService } from '../services/scoringService.js';
import { authenticate, requireManagerForWrites } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { ScoreEvent } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);
router.use(requireManagerForWrites);

// Validation schemas
const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  eventType: z.nativeEnum(ScoreEvent),
  points: z.number().int(),
  description: z.string().max(500).optional(),
  conditions: z.record(z.any()).optional(),
});

const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  eventType: z.nativeEnum(ScoreEvent).optional(),
  points: z.number().int().optional(),
  description: z.string().max(500).optional().nullable(),
  active: z.boolean().optional(),
  conditions: z.record(z.any()).optional().nullable(),
});

// GET /api/scoring-rules - List all scoring rules
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const rules = await scoringService.findAll(req.user.tenantId);
    res.json({ status: 200, data: rules });
  } catch (error) {
    next(error);
  }
});

// GET /api/scoring-rules/default - Ensure default rules exist
router.get('/default', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const rules = await scoringService.ensureDefaultRules(req.user.tenantId);
    res.json({ status: 200, data: rules });
  } catch (error) {
    next(error);
  }
});

// GET /api/scoring-rules/breakdown/:leadId - Score breakdown for a lead
router.get('/breakdown/:leadId', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const tenantId = req.user.tenantId;
    const { leadId } = req.params;

    // Verify lead belongs to tenant
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      select: { id: true, score: true, name: true },
    });
    if (!lead) return next(createError('Lead not found', 404));

    // Get active scoring rules
    const rules = await prisma.scoreRule.findMany({ where: { tenantId, active: true } });

    // Count interactions by type for this lead
    const interactions = await prisma.interaction.groupBy({
      by: ['type'],
      where: { leadId, tenantId },
      _count: { id: true },
    });
    const interactionMap = new Map(interactions.map((i) => [i.type, i._count.id]));

    // Build breakdown
    const breakdown = rules
      .map((rule) => {
        // Map score event to interaction type or other source
        let count = 0;
        switch (rule.eventType) {
          case 'LEAD_CREATED':
            count = 1;
            break;
          case 'INTERACTION_CREATED':
            count = Array.from(interactionMap.values()).reduce((sum, v) => sum + v, 0);
            break;
          case 'EMAIL_OPENED':
            count = interactionMap.get('EMAIL') || 0;
            break;
          case 'EMAIL_CLICKED':
            count = 0;
            break; // No tracking yet
          case 'WHATSAPP_REPLIED':
            count = interactionMap.get('WHATSAPP') || 0;
            break;
          case 'STATUS_CHANGED':
            count = interactionMap.get('STATUS_CHANGE') || 0;
            break;
          case 'TAG_ADDED':
            count = 0;
            break; // Would need tag history
          case 'FORM_SUBMITTED':
            count = 0;
            break;
        }
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          event: rule.eventType,
          pointsPerEvent: rule.points,
          eventCount: count,
          totalPoints: count * rule.points,
        };
      })
      .filter((r) => r.totalPoints > 0);

    res.json({
      status: 200,
      data: {
        leadId,
        leadName: lead.name,
        totalScore: lead.score,
        breakdown,
        calculatedScore: breakdown.reduce((sum, r) => sum + r.totalPoints, 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/scoring-rules/:id - Get single rule
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const rule = await scoringService.findById(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: rule });
  } catch (error) {
    next(error);
  }
});

// POST /api/scoring-rules - Create rule
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = createRuleSchema.parse(req.body);
    const rule = await scoringService.create(req.user.tenantId, data);
    res.status(201).json({ status: 201, data: rule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /api/scoring-rules/:id - Update rule
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = updateRuleSchema.parse(req.body);
    const rule = await scoringService.update(req.user.tenantId, req.params.id, data);
    res.json({ status: 200, data: rule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/scoring-rules/:id - Delete rule
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const result = await scoringService.delete(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /api/scoring-rules/recalculate - Recalculate all lead scores
router.post('/recalculate', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const result = await scoringService.recalculateAllScores(req.user.tenantId);
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /api/scoring-rules/recalculate/:leadId - Recalculate single lead score
router.post('/recalculate/:leadId', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const score = await scoringService.recalculateLeadScore(req.user.tenantId, req.params.leadId);
    res.json({ status: 200, data: { score } });
  } catch (error) {
    next(error);
  }
});

export default router;
