import { Router } from 'express';
import { z, ZodError } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import {
  lostReasonService,
  dealSourceService,
  originCampaignService,
} from '../services/dealConfigService.js';

type ConfigService = {
  findAll: (tenantId: string, activeOnly?: boolean) => Promise<unknown>;
  create: (tenantId: string, value: string) => Promise<unknown>;
  update: (
    tenantId: string,
    id: string,
    data: { value?: string; active?: boolean; order?: number }
  ) => Promise<unknown>;
  delete: (tenantId: string, id: string) => Promise<unknown>;
};

function zodError(res: import('express').Response, error: ZodError) {
  return res
    .status(400)
    .json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: error.errors });
}

/**
 * Constrói um router CRUD tenant-scoped para uma lista de configuração.
 * `labelField` é o nome do campo de rótulo ('label' p/ motivos de perda, 'name' p/ os demais).
 */
function configRouter(service: ConfigService, labelField: 'name' | 'label') {
  const router = Router();
  router.use(authenticate);
  router.use(tenantScope);

  const createSchema = z.object({ [labelField]: z.string().min(1).max(120) });
  const updateSchema = z.object({
    [labelField]: z.string().min(1).max(120).optional(),
    active: z.boolean().optional(),
    order: z.number().int().optional(),
  });

  router.get('/', async (req, res, next) => {
    try {
      if (!req.user) return next(createError('Authentication required', 401));
      const data = await service.findAll(req.user.tenantId, req.query.active === 'true');
      res.json({ status: 200, data });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      if (!req.user) return next(createError('Authentication required', 401));
      const body = createSchema.parse(req.body) as Record<string, string>;
      const data = await service.create(req.user.tenantId, body[labelField]);
      res.status(201).json({ status: 201, data });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      if (!req.user) return next(createError('Authentication required', 401));
      const body = updateSchema.parse(req.body) as Record<string, unknown>;
      const data = await service.update(req.user.tenantId, req.params.id, {
        value: body[labelField] as string | undefined,
        active: body.active as boolean | undefined,
        order: body.order as number | undefined,
      });
      res.json({ status: 200, data });
    } catch (error) {
      if (error instanceof ZodError) return zodError(res, error);
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      if (!req.user) return next(createError('Authentication required', 401));
      const data = await service.delete(req.user.tenantId, req.params.id);
      res.json({ status: 200, data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const lostReasonRoutes = configRouter(lostReasonService, 'label');
export const dealSourceRoutes = configRouter(dealSourceService, 'name');
export const originCampaignRoutes = configRouter(originCampaignService, 'name');
