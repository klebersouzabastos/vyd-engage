import { Router } from 'express';
import { z } from 'zod';
import { leadService } from '../services/leadService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { LeadStatus, LeadSource } from '@prisma/client';

const router = Router();

// All routes require authentication and tenant scope
router.use(authenticate);
router.use(tenantScope);

const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  score: z.number().int().min(0).max(100).optional(),
  customFields: z.record(z.any()).optional(),
  notes: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

const updateLeadSchema = createLeadSchema.extend({
  id: z.string().uuid(),
});

const querySchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  search: z.string().optional(),
  tagId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'name', 'status', 'score']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// GET /api/leads - List all leads
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const filters = querySchema.parse(req.query);
    const result = await leadService.findAll(req.user.tenantId, filters);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// GET /api/leads/:id - Get lead by ID
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const lead = await leadService.findById(req.user.tenantId, req.params.id);
    res.json(lead);
  } catch (error) {
    next(error);
  }
});

// POST /api/leads - Create new lead
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    // Check plan limits
    const { planLimitsService } = await import('../services/planLimitsService.js');
    await planLimitsService.enforceLimit(req.user.tenantId, 'leads');

    const data = createLeadSchema.parse(req.body);
    const lead = await leadService.create(req.user.tenantId, data);
    res.status(201).json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /api/leads/:id - Update lead
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = updateLeadSchema.parse({
      ...req.body,
      id: req.params.id,
    });
    const lead = await leadService.update(req.user.tenantId, data);
    res.json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/leads/:id - Delete lead
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    await leadService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/leads/stats/count - Get lead count
router.get('/stats/count', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const count = await leadService.count(req.user.tenantId);
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

// POST /api/leads/import - Bulk import leads from CSV data
const importLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
  phone: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  company: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  position: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  notes: z.string().optional().or(z.literal('')).transform(v => v || undefined),
});

const importSchema = z.object({
  leads: z.array(importLeadSchema).min(1).max(1000),
  skipDuplicateEmails: z.boolean().optional().default(true),
});

router.post('/import', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { leads, skipDuplicateEmails } = importSchema.parse(req.body);
    const tenantId = req.user.tenantId;

    // Check plan limits
    const { planLimitsService } = await import('../services/planLimitsService.js');

    let imported = 0;
    let skipped = 0;
    const errors: Array<{ row: number; error: string }> = [];

    // Get existing emails for dedup
    let existingEmails = new Set<string>();
    if (skipDuplicateEmails) {
      const prismaModule = await import('../config/database.js');
      const prisma = prismaModule.default;
      const existing = await prisma.lead.findMany({
        where: { tenantId, email: { not: null } },
        select: { email: true },
      });
      existingEmails = new Set(existing.map((l: { email: string | null }) => l.email!.toLowerCase()));
    }

    for (let i = 0; i < leads.length; i++) {
      const leadData = leads[i];
      try {
        // Skip duplicate emails
        if (skipDuplicateEmails && leadData.email && existingEmails.has(leadData.email.toLowerCase())) {
          skipped++;
          continue;
        }

        await planLimitsService.enforceLimit(tenantId, 'leads');
        await leadService.create(tenantId, {
          name: leadData.name,
          email: leadData.email,
          phone: leadData.phone,
          company: leadData.company,
          position: leadData.position,
          status: leadData.status,
          source: leadData.source,
          notes: leadData.notes,
        });

        if (leadData.email) existingEmails.add(leadData.email.toLowerCase());
        imported++;
      } catch (error: any) {
        if (error.message?.includes('limit')) {
          errors.push({ row: i + 1, error: 'Limite do plano atingido' });
          break;
        }
        errors.push({ row: i + 1, error: error.message || 'Erro desconhecido' });
      }
    }

    res.json({
      status: 200,
      data: { imported, skipped, failed: errors.length, errors: errors.slice(0, 20) },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

export default router;

