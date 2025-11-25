import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log error
  logger.error('Request error', err, {
    path: req.path,
    method: req.method,
    statusCode,
  });

  // Capture in Sentry (only for server errors or important errors)
  if (statusCode >= 500 || !err.isOperational) {
    captureException(err, {
      path: req.path,
      method: req.method,
      statusCode,
      body: req.body,
      query: req.query,
      params: req.params,
    });
  }

  // Don't leak error details in production
  const errorResponse: any = {
    error: message,
    statusCode,
  };

  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err;
  }

  res.status(statusCode).json(errorResponse);
}

export function createError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  if (details) {
    (error as any).details = details;
  }
  return error;
}

