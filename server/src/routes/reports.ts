import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const reportSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.string().default('custom'),
  config: z.any().default({}),
});

// GET /api/reports - List all reports for tenant
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const reports = await prisma.report.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        config: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(reports);
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/:id - Get single report
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const report = await prisma.report.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!report) {
      return next(createError('Report not found', 404));
    }

    res.json(report);
  } catch (error) {
    next(error);
  }
});

// POST /api/reports - Create report
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const data = reportSchema.parse(req.body);

    const report = await prisma.report.create({
      data: {
        name: data.name,
        description: data.description || null,
        type: data.type,
        config: data.config,
        tenantId: req.user.tenantId,
        createdById: req.user.userId,
      },
    });

    res.status(201).json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /api/reports/:id - Update report
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const existing = await prisma.report.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId,
      },
    });

    if (!existing) {
      return next(createError('Report not found', 404));
    }

    const data = reportSchema.partial().parse(req.body);

    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        config: data.config,
      },
    });

    res.json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/reports/:id - Delete report
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const existing = await prisma.report.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId,
      },
    });

    if (!existing) {
      return next(createError('Report not found', 404));
    }

    await prisma.report.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Report deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
