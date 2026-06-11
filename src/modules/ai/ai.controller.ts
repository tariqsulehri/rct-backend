import { Request, Response, NextFunction } from 'express';
import logger from '../../config/logger';
import { getAiDashboard } from './ai.service';

export const aiController = {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const focus = typeof req.query.focus === 'string' ? req.query.focus : 'executive';
      const result = await getAiDashboard(
        req.user!.id,
        req.user!.employeeId,
        req.user!.role,
        focus as any,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Get AI dashboard error');
      next(error);
    }
  },
};
