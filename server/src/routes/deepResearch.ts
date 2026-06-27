import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DeepResearchStatus } from '@prisma/client';
import { deepResearchService } from '../services/deepResearchService.js';
import { deepResearchTemplateService } from '../services/deepResearch/templateService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

/** Gerência de prompts (IP da plataforma) é exclusiva do platform admin. */
function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.isPlatformAdmin) {
    return next(
      createError(
        'Apenas administradores da plataforma podem gerenciar modelos.',
        403,
        'PLATFORM_ADMIN_REQUIRED'
      )
    );
  }
  next();
}

// ============================================
// Schemas
// ============================================

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  promptBody: z.string().min(1),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  promptBody: z.string().min(1).optional(),
});

const createResearchSchema = z.object({
  title: z.string().min(1),
  templateId: z.string().uuid().optional(),
  variables: z.record(z.string()).optional(),
  status: z.nativeEnum(DeepResearchStatus).optional(),
});

const updateResearchSchema = z.object({
  title: z.string().min(1).optional(),
  variables: z.record(z.string()).optional(),
  status: z.nativeEnum(DeepResearchStatus).optional(),
  reportMarkdown: z.string().max(500_000).optional(),
});

const querySchema = z.object({
  status: z.nativeEnum(DeepResearchStatus).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// ============================================
// Templates (registrado ANTES de /:id)
// ============================================

router.get('/templates', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const result = await deepResearchTemplateService.findAll(
      req.user.tenantId,
      !!req.user.isPlatformAdmin
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/templates', requirePlatformAdmin, async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = createTemplateSchema.parse(req.body);
    const tpl = await deepResearchTemplateService.create(req.user.tenantId, req.user.userId, data);
    res.status(201).json(tpl);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.get('/templates/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const tpl = await deepResearchTemplateService.findById(
      req.user.tenantId,
      req.params.id,
      !!req.user.isPlatformAdmin
    );
    res.json(tpl);
  } catch (error) {
    next(error);
  }
});

router.put('/templates/:id', requirePlatformAdmin, async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = updateTemplateSchema.parse(req.body);
    const tpl = await deepResearchTemplateService.update(req.user.tenantId, req.params.id, data);
    res.json(tpl);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.delete('/templates/:id', requirePlatformAdmin, async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    await deepResearchTemplateService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================
// Pesquisas
// ============================================

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const filters = querySchema.parse(req.query);
    const result = await deepResearchService.findAll(req.user.tenantId, filters);
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
    const data = createResearchSchema.parse(req.body);
    const research = await deepResearchService.create(
      req.user.tenantId,
      req.user.userId,
      data,
      !!req.user.isPlatformAdmin
    );
    res.status(201).json(research);
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
    const research = await deepResearchService.findById(
      req.user.tenantId,
      req.params.id,
      !!req.user.isPlatformAdmin
    );
    res.json(research);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = updateResearchSchema.parse(req.body);

    // Colar/receber o resultado é exclusivo do platform admin (processamento).
    if (data.reportMarkdown !== undefined && !req.user.isPlatformAdmin) {
      return next(
        createError(
          'Apenas administradores da plataforma podem registrar o resultado.',
          403,
          'PLATFORM_ADMIN_REQUIRED'
        )
      );
    }

    const research = await deepResearchService.update(
      req.user.tenantId,
      req.params.id,
      data,
      !!req.user.isPlatformAdmin
    );
    res.json(research);
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
    await deepResearchService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
