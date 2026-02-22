import { Router } from 'express';
import { z } from 'zod';
import { funnelService } from '../services/funnelService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { LeadStatus } from '@prisma/client';

const router = Router();

// All routes require authentication and tenant scope
router.use(authenticate);
router.use(tenantScope);

// Validation schemas
const createFunnelSchema = z.object({
  name: z.string().min(1).max(100),
  columns: z.array(z.object({
    title: z.string().min(1).max(100),
    color: z.string().optional(),
    mappedStatus: z.nativeEnum(LeadStatus).optional(),
  })).optional(),
});

const updateFunnelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  order: z.number().int().min(0).optional(),
});

const createColumnSchema = z.object({
  title: z.string().min(1).max(100),
  color: z.string().optional(),
  mappedStatus: z.nativeEnum(LeadStatus).optional(),
});

const updateColumnSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

const reorderColumnsSchema = z.object({
  columnIds: z.array(z.string().uuid()),
});

const moveLeadSchema = z.object({
  leadId: z.string().uuid(),
  targetColumnId: z.string().uuid(),
  position: z.number().int().min(0).default(0),
});

// ========================
// Funnel CRUD
// ========================

// GET /api/funnels - List all funnels
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const funnels = await funnelService.findAll(req.user.tenantId);
    res.json({ status: 200, data: funnels });
  } catch (error) {
    next(error);
  }
});

// GET /api/funnels/default - Ensure default funnel exists and return it
router.get('/default', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const funnel = await funnelService.ensureDefaultFunnel(req.user.tenantId);
    res.json({ status: 200, data: funnel });
  } catch (error) {
    next(error);
  }
});

// GET /api/funnels/:id - Get funnel with columns and leads
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const funnel = await funnelService.findById(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: funnel });
  } catch (error) {
    next(error);
  }
});

// POST /api/funnels - Create new funnel
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = createFunnelSchema.parse(req.body);
    const funnel = await funnelService.create(req.user.tenantId, data);
    res.status(201).json({ status: 201, data: funnel });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /api/funnels/:id - Update funnel
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = updateFunnelSchema.parse(req.body);
    const funnel = await funnelService.update(req.user.tenantId, req.params.id, data);
    res.json({ status: 200, data: funnel });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/funnels/:id - Delete funnel
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const result = await funnelService.delete(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

// ========================
// Column operations
// ========================

// POST /api/funnels/:id/columns - Add column to funnel
router.post('/:id/columns', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = createColumnSchema.parse(req.body);
    const column = await funnelService.addColumn(req.user.tenantId, req.params.id, data);
    res.status(201).json({ status: 201, data: column });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /api/funnels/:funnelId/columns/:columnId - Update column
router.put('/:funnelId/columns/:columnId', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = updateColumnSchema.parse(req.body);
    const column = await funnelService.updateColumn(req.user.tenantId, req.params.columnId, data);
    res.json({ status: 200, data: column });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /api/funnels/:id/columns/reorder - Reorder columns
router.put('/:id/columns/reorder', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = reorderColumnsSchema.parse(req.body);
    const funnel = await funnelService.reorderColumns(req.user.tenantId, req.params.id, data.columnIds);
    res.json({ status: 200, data: funnel });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/funnels/:funnelId/columns/:columnId - Delete column
router.delete('/:funnelId/columns/:columnId', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const result = await funnelService.deleteColumn(req.user.tenantId, req.params.columnId);
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

// ========================
// Lead movement
// ========================

// POST /api/funnels/move-lead - Move lead between columns
router.post('/move-lead', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = moveLeadSchema.parse(req.body);
    const lead = await funnelService.moveLead(
      req.user.tenantId,
      data.leadId,
      data.targetColumnId,
      data.position
    );
    res.json({ status: 200, data: lead });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

export default router;
