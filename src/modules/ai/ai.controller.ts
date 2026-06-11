import { Request, Response, NextFunction } from 'express';
import logger from '../../config/logger';
import { askAiDashboard, getAiDashboard } from './ai.service';

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
  async askDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
      const focus = typeof req.body?.focus === 'string' ? req.body.focus : 'executive';

      if (!question) {
        return res.status(400).json({
          error: 'Question is required',
          code: 'QUESTION_REQUIRED',
        });
      }

      const result = await askAiDashboard(
        req.user!.id,
        req.user!.employeeId,
        req.user!.role,
        question,
        focus as any,
      );
      return res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Ask AI dashboard error');
      return next(error);
    }
  },
};
