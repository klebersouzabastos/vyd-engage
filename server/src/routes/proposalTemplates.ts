/**
 * /proposal-templates — Modelos de proposta (Upgrade RD P2, req 17).
 *
 * CRUD real (dono B2) sobre `proposalService`: corpo rico com variáveis
 * ({{nome}}, {{empresa}}, ...) sanitizado no persist, `isDefault` único por
 * tenant, status DRAFT/PUBLISHED. Escrita restrita a ADMIN/GESTOR
 * (requireManagerForWrites). A geração da proposta a partir do deal
 * (POST /deals/:id/proposals) vive em routes/deals.ts.
 */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireManagerForWrites } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { proposalService } from '../services/proposalService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);
router.use(requireManagerForWrites);

const createSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  bodyHtml: z.string().min(1, 'Corpo é obrigatório'),
  isDefault: z.boolean().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

const updateSchema = createSchema.partial();

// ─── GET / — Lista de modelos ────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const templates = await proposalService.listTemplates(req.user.tenantId);
    res.json({ status: 200, data: templates });
  } catch (error) {
    next(error);
  }
});

// ─── GET /:id — Modelo por ID ────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const template = await proposalService.getTemplate(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: template });
  } catch (error) {
    next(error);
  }
});

// ─── POST / — Criar modelo ───────────────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = createSchema.parse(req.body);
    const template = await proposalService.createTemplate(req.user.tenantId, {
      ...data,
      createdById: req.user.userId,
    });
    res.status(201).json({ status: 201, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── PUT /:id — Atualizar modelo ─────────────────────────────────────────────

router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = updateSchema.parse(req.body);
    const template = await proposalService.updateTemplate(req.user.tenantId, req.params.id, data);
    res.json({ status: 200, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── DELETE /:id — Remover modelo ────────────────────────────────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    await proposalService.deleteTemplate(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

export default router;
