import { Request, Response, NextFunction } from 'express';
import { communicationService } from './communication.service';
import { accessScopeService } from '../access/access-scope.service';
import logger from '../../config/logger';

async function canAccessEmployee(req: Request, employeeId: number): Promise<boolean> {
  if (!req.user) return false;
  return accessScopeService.canAccessEmployee(req.user, employeeId, { forAssessment: true });
}

export const communicationController = {
  async getConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = communicationService.getCommConfig();
      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error({ error }, 'Error fetching CEFR config');
      next(error);
    }
  },

  async updateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = communicationService.updateCommConfig(req.body);
      res.json({
        success: true,
        data: updated,
        message: 'CEFR benchmark configuration updated successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error updating CEFR config');
      next(error);
    }
  },

  async createAssessment(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body;
      const employee = await communicationService.resolveEmployee(body.employee_id);
      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found' });
        return;
      }

      if (!(await canAccessEmployee(req, employee.id))) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const isEngineer = req.user?.role === 'ENGINEER';
      const result = await communicationService.createAssessment(
        body,
        req.user?.id ?? null,
        isEngineer,
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error({ error }, 'Error creating communication assessment');
      res.status(400).json({ success: false, error: error.message });
    }
  },

  async getAssessmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await communicationService.getAssessmentById(id);

      if (!(await canAccessEmployee(req, result.subject_id))) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error({ error }, 'Error fetching communication assessment by id');
      res.status(404).json({ success: false, error: error.message });
    }
  },

  async getLatestSubjectAssessment(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.params;
      const employee = await communicationService.resolveEmployee(employeeId);
      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found' });
        return;
      }

      if (!(await canAccessEmployee(req, employee.id))) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const isSelf = req.user?.employeeId === employee.id;
      const result = await communicationService.getLatestSubjectAssessment(
        employee.id,
        !isSelf, // if not self, only approved; if self, show latest even if pending
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error({ error }, 'Error fetching latest communication assessment');
      res.status(400).json({ success: false, error: error.message });
    }
  },

  async getSubjectHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.params;
      const employee = await communicationService.resolveEmployee(employeeId);
      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found' });
        return;
      }

      if (!(await canAccessEmployee(req, employee.id))) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const history = await communicationService.getSubjectHistory(employee.id);

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      logger.error({ error }, 'Error fetching communication history');
      res.status(400).json({ success: false, error: error.message });
    }
  },

  async updateAssessmentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (req.user?.role === 'ENGINEER') {
        res.status(403).json({ success: false, error: 'Only managers or admins can approve assessments' });
        return;
      }

      const result = await communicationService.updateAssessmentStatus(
        id,
        req.body,
        req.user!.id,
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error({ error }, 'Error updating communication assessment status');
      res.status(400).json({ success: false, error: error.message });
    }
  },
};
