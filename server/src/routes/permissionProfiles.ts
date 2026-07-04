/**
 * /permission-profiles — CRUD de perfis de permissão (Upgrade RD P1, req 13/14).
 *
 * - GET /me: qualquer autenticado (a UI usa o perfil efetivo para esconder ações).
 * - GET / e GET /:id: ADMIN/GESTOR (leitura da configuração).
 * - POST/PUT/DELETE: ADMIN (configuração). Builtins são imutáveis (400 no service).
 *
 * FAIL-CLOSED: um perfil só EXPANDE escopo quando um admin o configura e o atribui
 * a um usuário. Semear os 4 builtins é idempotente.
 */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { UserRole } from '@prisma/client';
import { permissionProfileService } from '../services/permissionProfileService.js';
import { getEffective } from '../services/permissionService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

// ─── Zod ──────────────────────────────────────────────────────────────────────

const visibilityLevel = z.enum(['PROPRIA', 'EQUIPE', 'GERAL']);
const capabilitiesSchema = z.record(z.boolean());
const visibilitySchema = z
  .object({
    deals: visibilityLevel.optional(),
    companies: visibilityLevel.optional(),
    contacts: visibilityLevel.optional(),
  })
  .partial();
const requireApprovalSchema = z
  .object({
    export: z.boolean().optional(),
    bulk: z.boolean().optional(),
    delete: z.boolean().optional(),
  })
  .partial();

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(120),
  description: z.string().max(500).nullable().optional(),
  baseRole: z.nativeEnum(UserRole),
  capabilities: capabilitiesSchema.optional(),
  visibility: visibilitySchema.optional(),
  requireApprovalFor: requireApprovalSchema.optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  capabilities: capabilitiesSchema.optional(),
  visibility: visibilitySchema.optional(),
  requireApprovalFor: requireApprovalSchema.optional(),
});

// ─── GET /me — perfil efetivo do usuário logado (qualquer autenticado) ──────────
// Registrado antes de /:id para não colidir com o parâmetro.

router.get('/me', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const effective = await getEffective({
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      role: req.user.role,
      isPlatformAdmin: req.user.isPlatformAdmin,
    });
    res.json({ status: 200, data: effective });
  } catch (error) {
    next(error);
  }
});

// ─── GET / — lista (ADMIN/GESTOR) ───────────────────────────────────────────────

router.get('/', requireRole('ADMIN', 'GESTOR'), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const profiles = await permissionProfileService.listProfiles(req.user.tenantId);
    res.json({ status: 200, data: profiles });
  } catch (error) {
    next(error);
  }
});

// ─── GET /:id — perfil único (ADMIN/GESTOR) ─────────────────────────────────────

router.get('/:id', requireRole('ADMIN', 'GESTOR'), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const profile = await permissionProfileService.getProfile(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: profile });
  } catch (error) {
    next(error);
  }
});

// ─── POST / — cria perfil custom (ADMIN) ────────────────────────────────────────

router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = createSchema.parse(req.body);
    const profile = await permissionProfileService.createProfile(req.user.tenantId, data);
    res.status(201).json({ status: 201, data: profile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── PUT /:id — edita perfil custom (ADMIN); builtins → 400 no service ───────────

router.put('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = updateSchema.parse(req.body);
    const profile = await permissionProfileService.updateProfile(
      req.user.tenantId,
      req.params.id,
      data
    );
    res.json({ status: 200, data: profile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── DELETE /:id — exclui perfil custom (ADMIN); builtins → 400 no service ───────

router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    await permissionProfileService.deleteProfile(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
