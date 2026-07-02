import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { tenantScope, requireTenantAccess } from '../middleware/tenant.js';
import { requireRole } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import prisma from '../config/database.js';
import { UserRole, UserStatus, CommercialFunction } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

// GET /api/users - List all users in tenant
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const users = await prisma.user.findMany({
      where: { tenantId: req.user.tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        commercialFunction: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const user = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        commercialFunction: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      return next(createError('User not found', 404));
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:id - Update user (Admin only)
router.put('/:id', requireRole('ADMIN', 'GESTOR'), async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { role, status, commercialFunction } = z
      .object({
        role: z.nativeEnum(UserRole).optional(),
        status: z.nativeEnum(UserStatus).optional(),
        commercialFunction: z.nativeEnum(CommercialFunction).nullable().optional(),
      })
      .parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId,
      },
    });

    if (!user) {
      return next(createError('User not found', 404));
    }

    // role/status seguem restritos a ADMIN; GESTOR só pode definir a função
    // comercial (spec: commercialFunction restrito a ADMIN/GESTOR).
    const isAdmin = req.user.role === 'ADMIN';

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(isAdmin && role ? { role } : {}),
        ...(isAdmin && status ? { status } : {}),
        ...(commercialFunction !== undefined ? { commercialFunction } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        commercialFunction: true,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

export default router;
