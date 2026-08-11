import { Request, Response, NextFunction } from 'express';
import { behavioralService } from './behavioral.service';

export const behavioralController = {
  /**
   * GET /api/v1/behav/config
   * Returns behavioral framework reference configuration
   */
  async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await behavioralService.getConfig();
      res.json({
        success: true,
        data: config,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/behav/assessments
   * Creates a new behavioral assessment and returns evaluated results
   */
  async createAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assessorId = req.user ? String(req.user.id) : undefined;
      const result = await behavioralService.createAssessment(req.body, assessorId);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/behav/assessments/:id/result
   * GET /api/v1/behav/assessments/:id
   * Returns assessment details and engine evaluation by ID
   */
  async getAssessmentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await behavioralService.getAssessmentById(id);

      if (!result) {
        res.status(404).json({
          success: false,
          error: 'Behavioral assessment not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/behav/subjects/:employeeId/latest
   * Returns the latest behavioral assessment result for an employee
   */
  async getLatestSubjectAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId } = req.params;
      const result = await behavioralService.getLatestAssessment(employeeId);

      if (!result) {
        res.status(404).json({
          success: false,
          error: `No behavioral assessment found for subject ${employeeId}`,
          code: 'NOT_FOUND',
        });
        return;
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/behav/subjects/:employeeId/history
   * Returns historical behavioral assessments for an employee
   */
  async getSubjectHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId } = req.params;
      const history = await behavioralService.getSubjectHistory(employeeId);

      res.json({
        success: true,
        data: history,
      });
    } catch (err) {
      next(err);
    }
  },
};
