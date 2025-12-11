import { Router } from 'express';
import { z } from 'zod';
import { notificationService } from '../services/notificationService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { NotificationStatus, NotificationType } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const querySchema = z.object({
  status: z.nativeEnum(NotificationStatus).optional(),
  type: z.nativeEnum(NotificationType).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const filters = querySchema.parse(req.query);
    const result = await notificationService.findAll(req.user.tenantId, req.user.userId, filters);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.get('/unread/count', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const count = await notificationService.getUnreadCount(req.user.tenantId, req.user.userId);
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/read', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const notification = await notificationService.markAsRead(
      req.user.tenantId,
      req.user.userId,
      req.params.id
    );
    res.json(notification);
  } catch (error) {
    next(error);
  }
});

router.put('/read-all', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    await notificationService.markAllAsRead(req.user.tenantId, req.user.userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    await notificationService.delete(req.user.tenantId, req.user.userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;







