import { Request, Response, NextFunction } from 'express';
import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as reportsService from './reports.service';
import logger from '../../config/logger';

async function canAccessEmployee(req: Request, employee: { id: number; manager_id: number | null }): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === 'ADMIN') return true;
  if (req.user.role === 'ENGINEER') return req.user.employeeId === employee.id;
  return employee.id === req.user.employeeId || employee.manager_id === req.user.employeeId;
}

export const reportsController = {
  async getGapAnalysis(req: Request, res: Response, next: NextFunction) {
    try {
      // Resolve emp_code to internal Employee.id for the service
      const { db } = await import('../../config/database');
      const employee = await db.employee.findUnique({
        where: { emp_code: req.params.empCode },
        select: { id: true, manager_id: true },
      });
      if (!employee) { res.status(404).json({ success: false, error: 'Employee not found' }); return; }
      if (!(await canAccessEmployee(req, employee))) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
      const result = await reportsService.gapAnalysis(employee.id);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Get gap analysis error');
      next(error);
    }
  },

  async getPromotionReadiness(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await reportsService.promotionReadiness(req.user!.employeeId, req.user!.role);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Get promotion readiness error');
      next(error);
    }
  },

  async getCompetencyScores(req: Request, res: Response, next: NextFunction) {
    try {
      const empId = req.user!.role === 'ENGINEER' ? req.user!.employeeId : undefined;
      const result = await reportsService.competencyScores(req.user!.employeeId, req.user!.role, empId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Get competency scores error');
      next(error);
    }
  },

  async getCompetencyMatrix(req: Request, res: Response, next: NextFunction) {
    try {
      const empId = req.user!.role === 'ENGINEER' ? req.user!.employeeId : undefined;
      const result = await reportsService.competencyMatrix(req.user!.employeeId, req.user!.role, empId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Get competency matrix error');
      next(error);
    }
  },

  async downloadGapReport(req: Request, res: Response, next: NextFunction) {
    try {
      const script = path.resolve(process.cwd(), '../scripts/generate_gap_report.py');
      const outFile = path.resolve(process.cwd(), '../scripts/gap_report.xlsx');
      await new Promise<void>((resolve, reject) =>
        execFile('python3', [script], (err) => err ? reject(err) : resolve())
      );
      if (!fs.existsSync(outFile)) { res.status(500).json({ error: 'Report generation failed' }); return; }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="gap_report.xlsx"');
      fs.createReadStream(outFile).pipe(res);
    } catch (error) {
      logger.error({ error }, 'Download gap report error');
      next(error);
    }
  },

  async getGapMatrix(req: Request, res: Response, next: NextFunction) {
    try {
      const empId = req.user!.role === 'ENGINEER' ? req.user!.employeeId : undefined;
      const result = await reportsService.gapMatrix(req.user!.employeeId, req.user!.role, empId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Get gap matrix error');
      next(error);
    }
  },

  async getSkillsSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const empId = req.user!.role === 'ENGINEER' ? req.user!.employeeId : undefined;
      const result = await reportsService.skillsSummary(req.user!.employeeId, req.user!.role, empId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Get skills summary error');
      next(error);
    }
  },

  async getAssessmentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt((req.query.page as string) || '1');
      const limit = parseInt((req.query.limit as string) || '20');
      const result = await reportsService.assessmentHistory(
        req.user!.employeeId,
        req.user!.role,
        page,
        limit
      );
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Get assessment history error');
      next(error);
    }
  },
};
