import { Request, Response, NextFunction } from 'express';
import { assessmentService } from './assessment.service';
import { db } from '../../config/database';
import logger from '../../config/logger';

async function canAccessEmployee(req: Request, employeeId: number): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === 'ADMIN') return true;
  if (req.user.role === 'ENGINEER') return req.user.employeeId === employeeId;

  const employee = await db.employee.findFirst({
    where: {
      id: employeeId,
      deleted_at: null,
      OR: [
        { id: req.user.employeeId },
        { manager_id: req.user.employeeId },
      ],
    },
    select: { id: true },
  });

  return Boolean(employee);
}

export const assessmentController = {
  async createAssessment(req: Request, res: Response, next: NextFunction) {
    try {
      const body = { ...req.body };
      const employee = await db.employee.findUnique({
        where: { emp_code: body.employee_id },
        select: { id: true },
      });
      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found' });
        return;
      }
      if (!(await canAccessEmployee(req, employee.id))) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      // Engineers cannot set the level — only managers/admins can evaluate proficiency
      if (req.user!.role === 'ENGINEER') {
        delete body.level;
      }
      const result = await assessmentService.createSkillAssessment(body, req.user!.employeeId, req.user!.role);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Create assessment error');
      next(error);
    }
  },

  async updateAssessment(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const body = { ...req.body };
      const existing = await assessmentService.findAssessmentById(id);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Assessment not found' });
        return;
      }
      if (!(await canAccessEmployee(req, existing.employee_id))) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      if (req.user!.role === 'ENGINEER') {
        // Strip level — engineers may not update their own proficiency level
        delete body.level;
      }

      const result = await assessmentService.updateSkillAssessment(id, body, req.user!.employeeId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update assessment error');
      next(error);
    }
  },

  async deleteAssessment(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const existing = await assessmentService.findAssessmentById(id);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Assessment not found' });
        return;
      }
      if (!(await canAccessEmployee(req, existing.employee_id))) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      await assessmentService.deleteSkillAssessment(id, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Delete assessment error');
      next(error);
    }
  },

  async approveAssessment(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const existing = await assessmentService.findAssessmentById(id);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Assessment not found' });
        return;
      }
      if (!(await canAccessEmployee(req, existing.employee_id))) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
      const result = await assessmentService.approveSkillAssessment(id, req.user!.employeeId, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Approve assessment error');
      next(error);
    }
  },

  async getEmployeeAssessments(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await db.employee.findUnique({
        where: { emp_code: req.params.empCode },
        select: { id: true },
      });
      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found' });
        return;
      }
      if (!(await canAccessEmployee(req, employee.id))) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
      const assessments = await assessmentService.getSkillAssessmentsByEmployee(req.params.empCode);
      res.json({ success: true, data: assessments });
    } catch (error) {
      logger.error({ error }, 'Get employee assessments error');
      next(error);
    }
  },

  async getTeamRoster(req: Request, res: Response, next: NextFunction) {
    try {
      const department = req.query.department as string | undefined;
      const roster = req.user!.role === 'ADMIN'
        ? await assessmentService.getAllEmployees(department)
        : await assessmentService.getTeamRoster(req.user!.employeeId, department);
      res.json({ success: true, data: roster });
    } catch (error) {
      logger.error({ error }, 'Get team roster error');
      next(error);
    }
  },

  async getAllEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const department = req.query.department as string | undefined;
      const employees = await assessmentService.getAllEmployees(department);
      res.json({ success: true, data: employees });
    } catch (error) {
      logger.error({ error }, 'Get all employees error');
      next(error);
    }
  },
};
