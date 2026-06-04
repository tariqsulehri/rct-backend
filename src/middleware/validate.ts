import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import logger from '../config/logger';

/**
 * Zod validation middleware factory
 * Usage: validate(loginSchema) on routes
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Try to parse request data
      const result = schema.safeParse({
        ...req.body,
        ...req.params,
        ...req.query,
      });

      if (!result.success) {
        const errors = result.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors,
        });
      }

      // Attach validated data to request
      req.body = result.data;

      return next();
    } catch (error) {
      logger.error('Validation middleware error', error);
      return res.status(500).json({
        error: 'Validation check failed',
        code: 'VALIDATION_CHECK_ERROR',
      });
    }
  };
};
