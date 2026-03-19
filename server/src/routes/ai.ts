import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { aiDraftService } from '../services/aiDraftService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

// ========================
// Email Draft Generation
// ========================

const generateDraftSchema = z.object({
  leadId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  templateType: z.enum(['initial_outreach', 'follow_up', 'proposal', 'thank_you']),
  customInstructions: z.string().max(500).optional(),
});

// POST /api/ai/email-draft — Generate an email draft
router.post('/email-draft', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const data = generateDraftSchema.parse(req.body);

    if (!data.leadId && !data.dealId) {
      return next(createError('leadId ou dealId é obrigatório', 400, 'VALIDATION_ERROR'));
    }

    const draft = await aiDraftService.generateEmailDraft(
      req.user.tenantId,
      req.user.userId,
      data.templateType,
      data.leadId,
      data.dealId,
      data.customInstructions,
    );

    res.json({ status: 200, data: draft });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// GET /api/ai/templates — List available templates
router.get('/templates', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const templates = aiDraftService.getTemplates();
    res.json({ status: 200, data: templates });
  } catch (error) {
    next(error);
  }
});

// GET /api/ai/config — Get AI configuration status
router.get('/config', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const config = aiDraftService.getAIConfig();
    res.json({ status: 200, data: config });
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/test-connection — Test AI provider connection
router.post('/test-connection', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const result = await aiDraftService.testConnection();
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
