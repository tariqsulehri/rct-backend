import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import env from '../config/env';
import logger from '../config/logger';
import { RoleCode } from '../types/rbac';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;           // User table id (internal)
        employeeId: number;   // Employee table id (internal, used for DB FKs)
        empCode: string;      // Real employee code e.g. "1818" (used in all public APIs)
        role: RoleCode;
        username: string;
      };
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or invalid authorization header',
        code: 'MISSING_TOKEN',
      });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: number;
      employeeId: number;
      empCode: string;
      role: RoleCode;
      username: string;
      iat: number;
      exp: number;
    };

    req.user = {
      id: decoded.id,
      employeeId: decoded.employeeId,
      empCode: decoded.empCode,
      role: decoded.role,
      username: decoded.username,
    };

    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
    }

    logger.error('Authentication error', error);
    return res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
};

export const generateAccessToken = (user: {
  id: number;
  employeeId: number;
  empCode: string;
  role: string;
  username: string;
}): string => {
  const payload = {
    id: user.id,
    employeeId: user.employeeId,
    empCode: user.empCode,
    role: user.role,
    username: user.username,
  };
  const options: SignOptions = { expiresIn: env.JWT_EXPIRY as never };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const generateRefreshToken = (userId: number): string => {
  const options: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRY as never };
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, options);
};
