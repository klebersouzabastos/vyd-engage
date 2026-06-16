import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePlatformAdmin } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { platformService } from '../services/platformService.js';
import { PlanType } from '@prisma/client';

/**
 * Rotas de plataforma (super-admin / cross-tenant). NÃO usam tenantScope.
 * Protegidas por authenticate + requirePlatformAdmin.
 */
const router = Router();

router.use(authenticate);
router.use(requirePlatformAdmin);

router.get('/overview', async (_req, res, next) => {
  try {
    res.json({ status: 200, data: await platformService.getOverview() });
  } catch (error) {
    next(error);
  }
});

router.get('/tenants', async (_req, res, next) => {
  try {
    res.json({ status: 200, data: await platformService.listTenants() });
  } catch (error) {
    next(error);
  }
});

router.get('/tenants/:id', async (req, res, next) => {
  try {
    const tenant = await platformService.getTenant(req.params.id);
    if (!tenant) return next(createError('Tenant não encontrado', 404));
    res.json({ status: 200, data: tenant });
  } catch (error) {
    next(error);
  }
});

const createTenantSchema = z.object({
  tenantName: z.string().min(1),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'slug deve conter apenas minúsculas, números e hífens'),
  planType: z.nativeEnum(PlanType),
  subscriptionStatus: z.enum(['ACTIVE', 'TRIAL']).optional(),
  adminEmail: z.string().email(),
  adminName: z.string().min(1),
  adminPassword: z.string().min(8).optional(),
});

router.post('/tenants', async (req, res, next) => {
  try {
    const d = createTenantSchema.parse(req.body);

    if (await platformService.slugExists(d.slug)) {
      return next(createError('Slug já está em uso', 409, 'SLUG_TAKEN'));
    }

    const result = await platformService.provisionTenant({
      tenantName: d.tenantName,
      slug: d.slug,
      planType: d.planType,
      subscriptionStatus: d.subscriptionStatus,
      // Admin de um tenant criado pela API NUNCA recebe super-admin (anti-escalada).
      admin: { email: d.adminEmail, name: d.adminName, password: d.adminPassword, isPlatformAdmin: false },
    });

    res.status(201).json({
      status: 201,
      data: {
        tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug },
        admin: { id: result.user.id, email: result.user.email },
        // Presente apenas quando a senha foi gerada automaticamente.
        generatedPassword: result.generatedPassword,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    if (typeof error?.message === 'string' && error.message.includes('já pertence')) {
      return next(createError(error.message, 409, 'EMAIL_TAKEN'));
    }
    next(error);
  }
});

export default router;
