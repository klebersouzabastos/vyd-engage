import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import {
  exportLeads,
  exportDeals,
  exportTasks,
  ExportFormat,
} from '../services/exportService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const VALID_FORMATS: ExportFormat[] = ['json', 'csv', 'xlsx'];

function parseFormat(raw: unknown): ExportFormat {
  const fmt = String(raw || 'json').toLowerCase() as ExportFormat;
  return VALID_FORMATS.includes(fmt) ? fmt : 'json';
}

// GET /api/exports/leads?format=csv|xlsx|json&status=...&search=...
router.get('/leads', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const format = parseFormat(req.query.format);
    const filters = {
      status: req.query.status as string | undefined,
      source: req.query.source as string | undefined,
      search: req.query.search as string | undefined,
      tagId: req.query.tagId as string | undefined,
      assignedTo: req.query.assignedTo as string | undefined,
    };
    await exportLeads(req.user.tenantId, filters, format, res);
  } catch (error) {
    next(error);
  }
});

// GET /api/exports/deals?format=csv|xlsx|json&stage=...&search=...
router.get('/deals', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const format = parseFormat(req.query.format);
    const filters = {
      stage: req.query.stage as string | undefined,
      search: req.query.search as string | undefined,
      assignedTo: req.query.assignedTo as string | undefined,
      leadId: req.query.leadId as string | undefined,
      minValue: req.query.minValue ? Number(req.query.minValue) : undefined,
      maxValue: req.query.maxValue ? Number(req.query.maxValue) : undefined,
    };
    await exportDeals(req.user.tenantId, filters, format, res);
  } catch (error) {
    next(error);
  }
});

// GET /api/exports/tasks?format=csv|xlsx|json&status=...&priority=...
router.get('/tasks', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const format = parseFormat(req.query.format);
    const filters = {
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      search: req.query.search as string | undefined,
      assignedTo: req.query.assignedTo as string | undefined,
      leadId: req.query.leadId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };
    await exportTasks(req.user.tenantId, filters, format, res);
  } catch (error) {
    next(error);
  }
});

export default router;
