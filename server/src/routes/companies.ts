import { Router } from 'express';
import { z } from 'zod';
import { companyService } from '../services/companyService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { ClientStatus, CompanySize, ContractHolder } from '@prisma/client';
import { approvalService } from '../services/approvalService.js';
import { visibilityScope, getEffective } from '../services/permissionService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

// Campos de contrato/segmentação: concorrente obrigatório quando o detentor é
// CONCORRENTE; datas coercidas; vencimento >= início quando ambas presentes (req 4).
const companyFieldsSchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  size: z.nativeEnum(CompanySize).optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  clientStatus: z.nativeEnum(ClientStatus).optional(),
  // Upgrade RD P0 (req 6) — segmento configurável (CompanySegment do tenant).
  segmentId: z.string().uuid().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  followUpIntervalDays: z.coerce.number().int().positive().optional().nullable(),
  contractHolder: z.nativeEnum(ContractHolder).optional(),
  contractCompetitor: z.string().optional().nullable(),
  contractStartDate: z.coerce.date().optional().nullable(),
  contractEndDate: z.coerce.date().optional().nullable(),
  contractValue: z.coerce.number().nonnegative().optional().nullable(),
  contractScope: z.string().optional().nullable(),
});

function refineContract<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine(
      (data: z.infer<typeof companyFieldsSchema>) =>
        data.contractHolder !== ContractHolder.CONCORRENTE ||
        (data.contractCompetitor && data.contractCompetitor.trim().length > 0),
      {
        message: 'Informe o nome do concorrente detentor do contrato',
        path: ['contractCompetitor'],
      }
    )
    .refine(
      (data: z.infer<typeof companyFieldsSchema>) =>
        !data.contractStartDate ||
        !data.contractEndDate ||
        data.contractEndDate >= data.contractStartDate,
      {
        message: 'O vencimento do contrato deve ser igual ou posterior ao início',
        path: ['contractEndDate'],
      }
    );
}

const createCompanySchema = refineContract(companyFieldsSchema);

const updateCompanySchema = refineContract(
  companyFieldsSchema.partial().extend({
    id: z.string().uuid(),
  })
);

const querySchema = z.object({
  search: z.string().optional(),
  industry: z.string().optional(),
  size: z.nativeEnum(CompanySize).optional(),
  clientStatus: z.nativeEnum(ClientStatus).optional(),
  segmentId: z.string().uuid().optional(),
  followUpPending: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  contract: z.enum(['expiring', 'expired', 'competitor', 'ours', 'none']).optional(),
  contractExpiringDays: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z
    .enum(['createdAt', 'updatedAt', 'name', 'domain', 'industry', 'contractEndDate'])
    .optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

/**
 * Verifica a capability por-entidade de empresas (req 13). FAIL-CLOSED via
 * getEffective: sem perfil custom, ADMIN/GESTOR/USER têm todas true (== hoje).
 */
async function entityAllowed(
  req: import('express').Request,
  action: 'create' | 'edit' | 'delete'
): Promise<boolean> {
  const u = req.user!;
  const eff = await getEffective({
    userId: u.userId,
    tenantId: u.tenantId,
    role: u.role,
    isPlatformAdmin: u.isPlatformAdmin,
  });
  return eff.entities.companies[action] === true;
}

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

// GET /api/companies/contracts/expiring - Widget "Contratos a vencer" (before /:id)
router.get('/contracts/expiring', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const result = await companyService.findExpiringContracts(req.user.tenantId);
    res.json({ status: 200, data: result });
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
    // Visibilidade viva (req 14): empresas. DEFAULT == HOJE: builtins têm
    // companies=GERAL → escopo undefined → SEM filtro por dono (idêntico a hoje).
    // Só com perfil custom PROPRIA/EQUIPE o filtro por `assignedTo` aparece.
    const scope = await visibilityScope(req.user, 'companies');
    const result = await companyService.findAll(req.user.tenantId, filters, scope);
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

    // Os registros-filho (leads/deals/interações) exibidos no detalhe seguem a
    // visibilidade de 'deals' (mesma dona) — para o USER builtin isso é o próprio
    // userId, IDÊNTICO ao ownerScope de hoje. Só perfil custom expande.
    const childScope = await visibilityScope(req.user, 'deals');
    const company = await companyService.findById(req.user.tenantId, req.params.id, childScope);
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

    // Capability por-entidade (req 13): criar empresas exige entities.companies.create.
    if (!(await entityAllowed(req, 'create'))) {
      return next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
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

    // Capability por-entidade (req 13): editar empresas exige entities.companies.edit.
    if (!(await entityAllowed(req, 'edit'))) {
      return next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
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

    // Gate de exclusão (req 16): sem permissão OU perfil exige aprovação → cria
    // solicitação (não deleta) + 202. A guarda COMPANY_HAS_RELATIONS permanece em
    // companyService.delete (aplicada aqui e na execução da aprovação).
    const gate = await approvalService.deleteGate(
      {
        userId: req.user.userId,
        tenantId: req.user.tenantId,
        role: req.user.role,
        isPlatformAdmin: req.user.isPlatformAdmin,
      },
      'companies',
      req.params.id,
      'empresa'
    );
    if (gate.queued) {
      return res.status(202).json({ status: 202, data: { approvalId: gate.approvalId, pending: true } });
    }

    await companyService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
