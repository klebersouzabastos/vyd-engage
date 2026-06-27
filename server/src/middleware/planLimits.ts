import { Request, Response, NextFunction } from 'express';
import { planLimitsService } from '../services/planLimitsService.js';
import { createError } from './errorHandler.js';

type ResourceType = 'leads' | 'users' | 'automations' | 'whatsappConnections' | 'emailConfigs';

/**
 * Middleware to enforce plan limits for a specific resource
 */
export function enforcePlanLimit(resource: ResourceType) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(createError('Authentication required', 401));
      }

      await planLimitsService.enforceLimit(req.user.tenantId, resource);
      next();
    } catch (error) {
      next(error);
    }
  };
}
