import { Router } from 'express';
import { z } from 'zod';
import { leadService } from '../services/leadService.js';
import { getLeadNextAction } from '../services/nextActionService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { LeadStatus, LeadSource, NotificationType } from '@prisma/client';
import { notificationService } from '../services/notificationService.js';
import prisma from '../config/database.js';

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
  isContact: z.coerce.boolean().optional(),
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

// PATCH /api/leads/bulk — Bulk operations on leads
router.patch('/bulk', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const bulkSchema = z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      action: z.enum(['change_status', 'add_tag', 'remove_tag', 'assign_user', 'delete']),
      payload: z.any().optional(),
    });

    const { ids, action, payload } = bulkSchema.parse(req.body);
    const tenantId = req.user.tenantId;

    // Verify all leads belong to tenant
    const count = await prisma.lead.count({ where: { id: { in: ids }, tenantId } });
    if (count !== ids.length) {
      return next(createError('Some leads not found', 404));
    }

    let affected = 0;

    switch (action) {
      case 'change_status': {
        const statusValue = z.nativeEnum(LeadStatus).parse(payload?.status);
        await prisma.lead.updateMany({
          where: { id: { in: ids }, tenantId },
          data: { status: statusValue },
        });
        affected = ids.length;
        break;
      }
      case 'add_tag': {
        const tagId = z.string().uuid().parse(payload?.tagId);
        for (const leadId of ids) {
          await prisma.leadTag.create({
            data: { leadId, tagId },
          }).catch(() => {}); // Skip if already connected (unique constraint)
        }
        affected = ids.length;
        break;
      }
      case 'remove_tag': {
        const tagId = z.string().uuid().parse(payload?.tagId);
        await prisma.leadTag.deleteMany({
          where: { leadId: { in: ids }, tagId },
        });
        affected = ids.length;
        break;
      }
      case 'assign_user': {
        const userId = payload?.userId ? z.string().uuid().parse(payload.userId) : null;
        await prisma.lead.updateMany({
          where: { id: { in: ids }, tenantId },
          data: { assignedTo: userId },
        });
        affected = ids.length;
        break;
      }
      case 'delete': {
        await prisma.lead.deleteMany({
          where: { id: { in: ids }, tenantId },
        });
        affected = ids.length;
        // Invalidate plan limits cache
        const { planLimitsService } = await import('../services/planLimitsService.js');
        planLimitsService.invalidateUsage(tenantId).catch(() => {});
        break;
      }
    }

    res.json({ status: 200, data: { affected, action } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// GET /api/leads/duplicates — Find duplicate lead groups
router.get('/duplicates', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const tenantId = req.user.tenantId;

    // Find duplicate emails
    const emailDupes = await prisma.$queryRaw`
      SELECT email, array_agg(id) as lead_ids, count(*) as cnt
      FROM "Lead"
      WHERE "tenantId" = ${tenantId} AND email IS NOT NULL AND email != ''
      GROUP BY email
      HAVING count(*) > 1
      ORDER BY count(*) DESC
      LIMIT 100
    ` as any[];

    // Find duplicate phones (only where email is null, to avoid double-counting)
    const phoneDupes = await prisma.$queryRaw`
      SELECT phone, array_agg(id) as lead_ids, count(*) as cnt
      FROM "Lead"
      WHERE "tenantId" = ${tenantId} AND phone IS NOT NULL AND phone != ''
      AND email IS NULL
      GROUP BY phone
      HAVING count(*) > 1
      ORDER BY count(*) DESC
      LIMIT 100
    ` as any[];

    // Collect all lead IDs
    const allIds = new Set<string>();
    for (const g of [...emailDupes, ...phoneDupes]) {
      for (const id of g.lead_ids) allIds.add(id);
    }

    // Fetch full lead data
    const leads = allIds.size > 0 ? await prisma.lead.findMany({
      where: { id: { in: Array.from(allIds) } },
      include: { tags: { include: { tag: true } } },
    }) : [];

    const leadMap = new Map(leads.map(l => [l.id, l]));

    const groups = [
      ...emailDupes.map(g => ({
        matchField: 'email' as const,
        matchValue: g.email,
        leads: (g.lead_ids as string[]).map(id => leadMap.get(id)).filter(Boolean),
      })),
      ...phoneDupes.map(g => ({
        matchField: 'phone' as const,
        matchValue: g.phone,
        leads: (g.lead_ids as string[]).map(id => leadMap.get(id)).filter(Boolean),
      })),
    ];

    res.json({ status: 200, data: { groups, totalGroups: groups.length } });
  } catch (error) {
    next(error);
  }
});

// POST /api/leads/merge — Merge duplicate leads into primary
router.post('/merge', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const tenantId = req.user.tenantId;

    const schema = z.object({
      primaryId: z.string().uuid(),
      duplicateIds: z.array(z.string().uuid()).min(1).max(50),
    });
    const { primaryId, duplicateIds } = schema.parse(req.body);

    // Verify all leads belong to tenant
    const allIds = [primaryId, ...duplicateIds];
    const count = await prisma.lead.count({ where: { id: { in: allIds }, tenantId } });
    if (count !== allIds.length) return next(createError('Some leads not found', 404));

    // Use transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Move interactions to primary
      await tx.interaction.updateMany({
        where: { leadId: { in: duplicateIds } },
        data: { leadId: primaryId },
      });

      // Move tasks to primary
      await tx.task.updateMany({
        where: { leadId: { in: duplicateIds } },
        data: { leadId: primaryId },
      });

      // Move automation logs to primary
      await tx.automationLog.updateMany({
        where: { leadId: { in: duplicateIds } },
        data: { leadId: primaryId },
      });

      // Delete duplicates (cascade will remove LeadTag entries)
      await tx.lead.deleteMany({
        where: { id: { in: duplicateIds } },
      });
    });

    const primary = await prisma.lead.findUnique({
      where: { id: primaryId },
      include: { tags: { include: { tag: true } } },
    });

    res.json({ status: 200, data: { primary, mergedCount: duplicateIds.length } });
  } catch (error) {
    if (error instanceof z.ZodError) return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    next(error);
  }
});

// GET /api/leads/export — Export leads (supports format=json|csv|xlsx)
router.get('/export', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const { exportLeads } = await import('../services/exportService.js');
    const format = (['csv', 'xlsx', 'json'].includes(String(req.query.format || '').toLowerCase())
      ? String(req.query.format).toLowerCase()
      : 'json') as 'json' | 'csv' | 'xlsx';

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

// GET /api/leads/stats/count - Get lead count (MUST be before /:id)
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

// GET /api/leads/:id/next-action - Get suggested next action for a lead
router.get('/:id/next-action', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const action = await getLeadNextAction(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: action });
  } catch (error) {
    next(error);
  }
});

// POST /api/leads/:id/convert - Convert lead to contact
router.post('/:id/convert', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const lead = await leadService.convertToContact(req.params.id, req.user.tenantId);
    res.json({ status: 200, data: lead });
  } catch (error) {
    next(error);
  }
});

// POST /api/leads/:id/revert - Revert contact to lead
router.post('/:id/revert', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const lead = await leadService.revertToLead(req.params.id, req.user.tenantId);
    res.json({ status: 200, data: lead });
  } catch (error) {
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

    // Notify the creator that the lead was created
    notificationService.create(req.user.tenantId, {
      userId: req.user.userId,
      type: NotificationType.LEAD_ASSIGNED,
      title: 'Novo lead criado',
      message: `Lead "${lead.name}" foi criado com sucesso.`,
      link: `/app/leads/${lead.id}`,
      metadata: { leadId: lead.id, leadName: lead.name },
    }).catch(() => {});

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

