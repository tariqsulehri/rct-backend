import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Global error handler middleware
 * Must be applied last in the middleware chain
 */
export const errorHandler = (
  error: ApiError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = (error as ApiError).statusCode || 500;
  const code = (error as ApiError).code || 'INTERNAL_ERROR';
  const message = error.message || 'An unexpected error occurred';

  // Log error
  if (statusCode >= 500) {
    logger.error('Server error', { error, path: req.path, method: req.method });
  } else {
    logger.warn('Client error', { error: message, path: req.path, code });
  }

  // Response
  res.status(statusCode).json({
    error: message,
    code,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
};
