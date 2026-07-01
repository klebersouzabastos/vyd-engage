import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireManagerForWrites } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import prisma from '../config/database.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);
router.use(requireManagerForWrites);

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const createTemplateSchema = z.object({
  funnelColumnId: z.string().uuid('funnelColumnId must be a valid UUID'),
  taskTitle: z.string().min(1, 'Task title is required'),
  dueDaysFromNow: z.number().int().min(0).optional().default(3),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  assignToOwner: z.boolean().optional().default(true),
});

const updateTemplateSchema = createTemplateSchema.partial();

// ─── GET / — List all templates for tenant ───────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { tenantId } = req.user;

    const templates = await prisma.stageTaskTemplate.findMany({
      where: { tenantId },
      include: {
        funnelColumn: { select: { id: true, title: true, order: true } },
      },
      orderBy: [{ funnelColumn: { order: 'asc' } }, { createdAt: 'asc' }],
    });

    res.json({ status: 200, data: templates });
  } catch (error) {
    next(error);
  }
});

// ─── POST / — Create template ────────────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = createTemplateSchema.parse(req.body);
    const { tenantId } = req.user;

    // Verify funnelColumn belongs to this tenant
    const funnelColumn = await prisma.funnelColumn.findFirst({
      where: { id: data.funnelColumnId },
      include: { funnel: { select: { tenantId: true } } },
    });

    if (!funnelColumn || funnelColumn.funnel.tenantId !== tenantId) {
      return next(createError('Funnel column not found', 404));
    }

    const template = await prisma.stageTaskTemplate.create({
      data: { ...data, tenantId },
      include: {
        funnelColumn: { select: { id: true, title: true, order: true } },
      },
    });

    res.status(201).json({ status: 201, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── PUT /:id — Update template ──────────────────────────────────────────────

router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { id } = req.params;
    const { tenantId } = req.user;

    const existing = await prisma.stageTaskTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return next(createError('Template not found', 404));
    }

    const data = updateTemplateSchema.parse(req.body);

    // If funnelColumnId is being updated, verify it belongs to this tenant
    if (data.funnelColumnId) {
      const funnelColumn = await prisma.funnelColumn.findFirst({
        where: { id: data.funnelColumnId },
        include: { funnel: { select: { tenantId: true } } },
      });

      if (!funnelColumn || funnelColumn.funnel.tenantId !== tenantId) {
        return next(createError('Funnel column not found', 404));
      }
    }

    const template = await prisma.stageTaskTemplate.update({
      where: { id },
      data,
      include: {
        funnelColumn: { select: { id: true, title: true, order: true } },
      },
    });

    res.json({ status: 200, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── DELETE /:id — Delete template ───────────────────────────────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { id } = req.params;
    const { tenantId } = req.user;

    const existing = await prisma.stageTaskTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return next(createError('Template not found', 404));
    }

    await prisma.stageTaskTemplate.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
