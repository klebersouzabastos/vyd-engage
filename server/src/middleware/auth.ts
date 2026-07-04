import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';
import { createError } from './errorHandler.js';
import prisma from '../config/database.js';
import { can, type Capability } from '../services/permissionService.js';

// Extend Express Request to include user (+ flag de super-admin da plataforma)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- augmentação de tipos do Express exige namespace
  namespace Express {
    interface Request {
      user?: TokenPayload & { isPlatformAdmin?: boolean };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Read token from httpOnly cookie (primary) or Authorization header (fallback)
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.accessToken;
    const token =
      cookieToken || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!token) {
      throw createError('No token provided', 401, 'NO_TOKEN');
    }

    const payload = verifyAccessToken(token);

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        status: true,
        tenantId: true,
        role: true,
        isPlatformAdmin: true,
      },
    });

    if (!user) {
      throw createError('User not found', 401, 'USER_NOT_FOUND');
    }

    if (user.status !== 'ACTIVE') {
      throw createError('User account is not active', 403, 'USER_INACTIVE');
    }

    // Attach user to request
    req.user = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      isPlatformAdmin: user.isPlatformAdmin,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('Authentication required', 401, 'NOT_AUTHENTICATED'));
    }

    if (!roles.includes(req.user.role)) {
      return next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
    }

    next();
  };
}

/**
 * Configuração do processo comercial (funis/etapas/campos/motivos/fontes/produtos):
 * leitura (GET/HEAD/OPTIONS) é livre para qualquer autenticado (necessária para
 * preencher formulários), mas escrita exige GESTOR ou ADMIN (spec papeis-comerciais,
 * reqs 9 e 10).
 */
export function requireManagerForWrites(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  return requireRole('ADMIN', 'GESTOR')(req, res, next);
}

/**
 * Exige uma capability do perfil de permissão efetivo do usuário (Upgrade RD P1).
 * FAIL-CLOSED: 401 sem usuário; 403 quando `can(cap)` é falso. Sem perfil custom,
 * `can` recai nos defaults do baseRole (== comportamento de hoje) — logo esta
 * guarda só NEGA quando um admin configurou explicitamente a restrição.
 */
export function requirePermission(cap: Capability) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(createError('Authentication required', 401, 'NOT_AUTHENTICATED'));
    }
    try {
      const allowed = await can(
        {
          userId: req.user.userId,
          tenantId: req.user.tenantId,
          role: req.user.role,
          isPlatformAdmin: req.user.isPlatformAdmin,
        },
        cap
      );
      if (!allowed) {
        return next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Exige que o usuário autenticado seja super-admin da plataforma (cross-tenant).
 * Usa a flag já carregada por `authenticate` (sem query extra).
 */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(createError('Authentication required', 401, 'NOT_AUTHENTICATED'));
  }
  if (!req.user.isPlatformAdmin) {
    return next(createError('Platform admin access required', 403, 'NOT_PLATFORM_ADMIN'));
  }
  next();
}
