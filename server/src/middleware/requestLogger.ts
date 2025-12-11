import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { addBreadcrumb } from '../utils/sentry.js';

/**
 * Middleware to log all requests with structured logging
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log request
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Add breadcrumb to Sentry
  addBreadcrumb({
    category: 'http',
    message: `${req.method} ${req.path}`,
    level: 'info',
    data: {
      method: req.method,
      path: req.path,
      query: req.query,
    },
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    };

    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else {
      logger.debug('Request completed', logData);
    }

    // Add response breadcrumb
    addBreadcrumb({
      category: 'http',
      message: `${req.method} ${req.path} - ${res.statusCode}`,
      level: res.statusCode >= 400 ? 'warning' : 'info',
      data: {
        statusCode: res.statusCode,
        duration,
      },
    });
  });

  next();
}







