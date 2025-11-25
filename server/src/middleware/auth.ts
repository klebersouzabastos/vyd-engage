import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';
import { createError } from './errorHandler.js';
import prisma from '../config/database.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError('No token provided', 401, 'NO_TOKEN');
    }

    const token = authHeader.substring(7);
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


