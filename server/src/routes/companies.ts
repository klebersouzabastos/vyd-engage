import { Router } from 'express';
import { z } from 'zod';
import { companyService } from '../services/companyService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { CompanySize } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createCompanySchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  size: z.nativeEnum(CompanySize).optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateCompanySchema = createCompanySchema.partial().extend({
  id: z.string().uuid(),
});

const querySchema = z.object({
  search: z.string().optional(),
  industry: z.string().optional(),
  size: z.nativeEnum(CompanySize).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'name', 'domain', 'industry']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// GET /api/companies/stats/count - Company count (MUST be before /:id)
router.get('/stats/count', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const count = await companyService.count(req.user.tenantId);
    res.json({ status: 200, data: { count } });
  } catch (error) {
    next(error);
  }
});

// GET /api/companies - List companies with filters/pagination
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const filters = querySchema.parse(req.query);
    const result = await companyService.findAll(req.user.tenantId, filters);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// GET /api/companies/:id - Get company by ID with leads and deals
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const company = await companyService.findById(req.user.tenantId, req.params.id);
    res.json(company);
  } catch (error) {
    next(error);
  }
});

// POST /api/companies - Create company
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = createCompanySchema.parse(req.body);
    const company = await companyService.create(req.user.tenantId, data);
    res.status(201).json(company);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /api/companies/:id - Update company
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = updateCompanySchema.parse({
      ...req.body,
      id: req.params.id,
    });
    const company = await companyService.update(req.user.tenantId, data);
    res.json(company);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/companies/:id - Delete company
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    await companyService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
