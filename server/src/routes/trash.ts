/**
 * /trash — Lixeira (soft-delete) por entidade (Upgrade RD P1, req 16).
 *
 *   - GET    /?entity=leads|deals|tasks|companies|empreendimentos|roadmaps&page=
 *            (ADMIN/GESTOR) — lista registros na lixeira (com quem/quando).
 *   - POST   /:entity/:id/restore (ADMIN/GESTOR) — deletedAt=null (400 se pai excluído).
 *   - DELETE /:entity/:id/purge   (ADMIN)        — hard-delete de item já na lixeira.
 *
 * Tenant-scoped (auth + tenantScope). CSRF já whitelistado em index.ts.
 */
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { trashService, isTrashEntity } from '../services/trashService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

// GET /trash?entity=&page= — lista a lixeira de uma entidade (ADMIN/GESTOR).
router.get('/', requireRole('ADMIN', 'GESTOR'), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const entity = req.query.entity;
    if (!isTrashEntity(entity)) {
      return next(
        createError(
          `Entidade inválida. Use uma de: ${trashService.TRASH_ENTITIES.join(', ')}.`,
          400,
          'TRASH_BAD_ENTITY'
        )
      );
    }
    const pageRaw = Number(req.query.page);
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1;
    const result = await trashService.listTrash(req.user.tenantId, entity, page);
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /trash/:entity/:id/restore — restaura da lixeira (ADMIN/GESTOR).
router.post('/:entity/:id/restore', requireRole('ADMIN', 'GESTOR'), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { entity, id } = req.params;
    if (!isTrashEntity(entity)) {
      return next(createError('Entidade inválida', 400, 'TRASH_BAD_ENTITY'));
    }
    await trashService.restoreItem(req.user.tenantId, entity, id);
    res.json({ status: 200, data: { restored: true, entity, id } });
  } catch (error) {
    next(error);
  }
});

// DELETE /trash/:entity/:id/purge — expurgo definitivo (ADMIN).
router.delete('/:entity/:id/purge', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { entity, id } = req.params;
    if (!isTrashEntity(entity)) {
      return next(createError('Entidade inválida', 400, 'TRASH_BAD_ENTITY'));
    }
    await trashService.purgeItem(req.user.tenantId, entity, id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
