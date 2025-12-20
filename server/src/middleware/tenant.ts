import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler.js';
import prisma from '../config/database.js';

/**
 * Middleware to ensure user has access to the tenant
 * Must be used after authenticate middleware
 */
export async function requireTenantAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw createError('Authentication required', 401, 'NOT_AUTHENTICATED');
    }

    // Get tenantId from params, body, or query
    const tenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId || req.user.tenantId;

    // Verify user belongs to this tenant
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
      },
      select: {
        tenantId: true,
      },
    });

    if (!user || user.tenantId !== tenantId) {
      throw createError('Access denied to this tenant', 403, 'TENANT_ACCESS_DENIED');
    }

    // Attach tenantId to request for use in routes
    req.user.tenantId = tenantId;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to automatically filter queries by tenantId
 * Must be used after authenticate middleware
 */
export function tenantScope(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(createError('Authentication required', 401, 'NOT_AUTHENTICATED'));
  }

  // Add tenantId to query params for automatic filtering
  req.query.tenantId = req.user.tenantId;
  req.body.tenantId = req.user.tenantId;

  next();
}








