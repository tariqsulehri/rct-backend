import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { RoleCode } from '../types/rbac';

/**
 * Role-based authorization middleware
 * Usage: requireRole('ADMIN', 'MANAGER') - allows only ADMIN and MANAGER
 */
export const requireRole = (...roles: RoleCode[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'User not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user.id} (${req.user.role}) on ${req.path}`);
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: roles,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
};

/**
 * Row-level access control (RLAC) for managers
 * Ensures managers can only access their own team members
 * Usage: scopeGuard() on routes that deal with specific employees
 */
export const scopeGuard = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED',
        });
      }

      // ADMINs bypass scope checks
      if (req.user.role === 'ADMIN') {
        return next();
      }

      // Get employee ID from params
      const employeeId = parseInt(req.params.id);

      if (isNaN(employeeId)) {
        return res.status(400).json({
          error: 'Invalid employee ID',
          code: 'INVALID_EMPLOYEE_ID',
        });
      }

      // Only allow if:
      // 1. Manager accessing their own data
      // 2. Engineer accessing their own data
      if (req.user.role === 'MANAGER') {
        // TODO: Check if employeeId is in manager's direct reports
        // This will be implemented when we add the database check
        // For now, we'll implement it in Phase 2
        return next();
      }

      if (req.user.role === 'ENGINEER') {
        // Engineers can only access their own profile
        if (req.user.employeeId !== employeeId) {
          logger.warn(
            `Engineer ${req.user.id} attempted to access employee ${employeeId}`
          );
          return res.status(403).json({
            error: 'Cannot access other engineer profiles',
            code: 'SCOPE_VIOLATION',
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Scope guard error', error);
      return res.status(500).json({
        error: 'Access control check failed',
        code: 'SCOPE_CHECK_ERROR',
      });
    }
  };
};
