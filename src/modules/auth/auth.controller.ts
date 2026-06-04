import { Request, Response } from 'express';
import { authService } from './auth.service';
import logger from '../../config/logger';

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  return header
    .split(';')
    .map((part) => part.trim())
    .map((part) => {
      const separator = part.indexOf('=');
      return separator === -1
        ? [part, '']
        : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
    })
    .find(([key]) => key === name)?.[1];
}

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const result = await authService.login(req.body);

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      const { refreshToken, ...responseBody } = result;
      res.status(200).json(responseBody);
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      const code = error.code || 'LOGIN_ERROR';
      const message = error.message || 'Login failed';

      logger.warn(`Login failed: ${code}`);
      res.status(statusCode).json({
        error: message,
        code,
      });
    }
  },

  async refresh(req: Request, res: Response) {
    try {
      const refreshToken = getCookie(req, 'refreshToken');
      if (!refreshToken) {
        res.status(401).json({
          error: 'Missing refresh token',
          code: 'MISSING_REFRESH_TOKEN',
        });
        return;
      }

      const result = await authService.refresh(refreshToken);

      res.status(200).json(result);
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      const code = error.code || 'REFRESH_ERROR';
      const message = error.message || 'Token refresh failed';

      logger.warn(`Token refresh failed: ${code}`);
      res.status(statusCode).json({
        error: message,
        code,
      });
    }
  },

  async logout(req: Request, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED',
        });
        return;
      }

      await authService.logout(req.user.id);

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.status(204).send();
    } catch (error) {
      logger.error('Logout error', error);
      res.status(500).json({
        error: 'Logout failed',
        code: 'LOGOUT_ERROR',
      });
    }
  },
};
