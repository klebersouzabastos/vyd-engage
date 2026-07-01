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

const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  unitPrice: z.number().min(0, 'Unit price must be non-negative'),
  category: z.string().optional(),
  active: z.boolean().optional().default(true),
});

const updateProductSchema = createProductSchema.partial();

const querySchema = z.object({
  active: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  search: z.string().optional(),
});

// ─── GET / — List products ───────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { active, search } = querySchema.parse(req.query);
    const { tenantId } = req.user;

    const products = await prisma.product.findMany({
      where: {
        tenantId,
        ...(active !== undefined ? { active } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
    });

    res.json({ status: 200, data: products });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── GET /:id — Get product by ID ────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { id } = req.params;
    const { tenantId } = req.user;

    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { dealProducts: true } } },
    });

    if (!product) {
      return next(createError('Product not found', 404));
    }

    res.json({ status: 200, data: product });
  } catch (error) {
    next(error);
  }
});

// ─── POST / — Create product ─────────────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = createProductSchema.parse(req.body);
    const { tenantId } = req.user;

    const product = await prisma.product.create({
      data: { ...data, tenantId },
    });

    res.status(201).json({ status: 201, data: product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── PUT /:id — Update product ───────────────────────────────────────────────

router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { id } = req.params;
    const { tenantId } = req.user;

    const existing = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return next(createError('Product not found', 404));
    }

    const data = updateProductSchema.parse(req.body);

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    res.json({ status: 200, data: product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── DELETE /:id — Soft delete or hard delete ────────────────────────────────
// Soft delete (active=false) if the product has DealProduct references.
// Hard delete if no references exist.

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { id } = req.params;
    const { tenantId } = req.user;

    const existing = await prisma.product.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { dealProducts: true } } },
    });

    if (!existing) {
      return next(createError('Product not found', 404));
    }

    if (existing._count.dealProducts > 0) {
      // Product is referenced by deals — soft delete only
      await prisma.product.update({ where: { id }, data: { active: false } });
      return res.json({
        status: 200,
        data: { message: 'Product deactivated (referenced by existing deals)' },
      });
    }

    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
