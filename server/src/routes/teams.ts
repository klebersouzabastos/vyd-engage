/**
 * /teams — CRUD de equipes de vendas (Upgrade RD P1, req 12).
 *
 * Escrita restrita a ADMIN/GESTOR (requireManagerForWrites). Leitura livre a
 * qualquer autenticado (a UI de metas/performance precisa listar equipes).
 * Multi-tenant: todo acesso via tenantId de req.user.
 */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireManagerForWrites } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { teamService } from '../services/teamService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);
router.use(requireManagerForWrites);

const teamBodySchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(120),
  leaderId: z.string().uuid().nullable().optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});

const updateBodySchema = teamBodySchema.partial();

// GET / — lista equipes com líder e membros
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const teams = await teamService.listTeams(req.user.tenantId);
    res.json({ status: 200, data: teams });
  } catch (error) {
    next(error);
  }
});

// GET /:id — equipe única
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const team = await teamService.getTeam(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: team });
  } catch (error) {
    next(error);
  }
});

// POST / — cria equipe
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = teamBodySchema.parse(req.body);
    const team = await teamService.createTeam(req.user.tenantId, data);
    res.status(201).json({ status: 201, data: team });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /:id — atualiza equipe
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = updateBodySchema.parse(req.body);
    const team = await teamService.updateTeam(req.user.tenantId, req.params.id, data);
    res.json({ status: 200, data: team });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /:id — exclui equipe (membros são desvinculados via FK SetNull)
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    await teamService.deleteTeam(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
