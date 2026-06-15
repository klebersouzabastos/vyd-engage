import { Request, Response, NextFunction } from 'express';
import { addBreadcrumb } from '../utils/sentry.js';

/**
 * Adds Sentry breadcrumbs for each request/response.
 *
 * HTTP access logging is owned by pino-http (see index.ts); this middleware no
 * longer logs to the app logger to avoid double-logging every request.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

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

  res.on('finish', () => {
    const duration = Date.now() - startTime;
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
