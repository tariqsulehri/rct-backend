import { Request, Response, NextFunction } from 'express';
import { configService } from './config.service';
import logger from '../../config/logger';

export const configController = {
  // ── Roles ────────────────────────────────────────────────────────────────
  async listRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listRoles();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List roles error');
      next(error);
    }
  },

  async updateRole(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.updateRole(parseInt(req.params.id), req.body, req.user?.id);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update role error');
      next(error);
    }
  },

  // ── Access Management ────────────────────────────────────────────────────
  async listDepartmentAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listDepartmentAssignments();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List department assignments error');
      next(error);
    }
  },

  async createDepartmentAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.createDepartmentAssignment(req.body, req.user?.id);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Create department assignment error');
      next(error);
    }
  },

  async updateDepartmentAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.updateDepartmentAssignment(parseInt(req.params.id), req.body, req.user?.id);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update department assignment error');
      next(error);
    }
  },

  async deleteDepartmentAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.deleteDepartmentAssignment(parseInt(req.params.id), req.user?.id);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Delete department assignment error');
      next(error);
    }
  },

  async listLineManagerAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listLineManagerAssignments();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List line manager assignments error');
      next(error);
    }
  },

  async createLineManagerAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.createLineManagerAssignment(req.body, req.user?.id);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Create line manager assignment error');
      next(error);
    }
  },

  async updateLineManagerAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.updateLineManagerAssignment(parseInt(req.params.id), req.body, req.user?.id);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update line manager assignment error');
      next(error);
    }
  },

  async deleteLineManagerAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.deleteLineManagerAssignment(parseInt(req.params.id), req.user?.id);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Delete line manager assignment error');
      next(error);
    }
  },

  async listAccessAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listAccessAuditLogs();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List access audit logs error');
      next(error);
    }
  },

  // ── Scoring Config ────────────────────────────────────────────────────────
  async listAssessmentTypeConfigs(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listAssessmentTypeConfigs();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List assessment type configs error');
      next(error);
    }
  },

  async updateAssessmentTypeConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.updateAssessmentTypeConfig(parseInt(req.params.id), req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update assessment type config error');
      next(error);
    }
  },

  async listAssessmentLevelConfigs(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listAssessmentLevelConfigs();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List assessment level configs error');
      next(error);
    }
  },

  async updateAssessmentLevelConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.updateAssessmentLevelConfig(parseInt(req.params.id), req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update assessment level config error');
      next(error);
    }
  },

  async listAssessmentStatusConfigs(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listAssessmentStatusConfigs();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List assessment status configs error');
      next(error);
    }
  },

  async updateAssessmentStatusConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.updateAssessmentStatusConfig(parseInt(req.params.id), req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update assessment status config error');
      next(error);
    }
  },

  async listAssessmentProjectConfigs(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listAssessmentProjectConfigs();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List assessment project configs error');
      next(error);
    }
  },

  async updateAssessmentProjectConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.updateAssessmentProjectConfig(parseInt(req.params.id), req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update assessment project config error');
      next(error);
    }
  },

  // ── Users ──────────────────────────────────────────────────────────────────
  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listUsers();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List users error');
      next(error);
    }
  },

  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.createUser(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Create user error');
      next(error);
    }
  },

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const result = await configService.updateUser(id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update user error');
      next(error);
    }
  },

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await configService.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Delete user error');
      next(error);
    }
  },

  // ── Competency Categories ──────────────────────────────────────────────────
  async listCompetencyCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listCompetencyCategories();
      res.json({ success: true, data: result });
    } catch (error) { logger.error({ error }, 'List categories error'); next(error); }
  },
  async createCompetencyCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.createCompetencyCategory(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) { logger.error({ error }, 'Create category error'); next(error); }
  },
  async updateCompetencyCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.updateCompetencyCategory(parseInt(req.params.id), req.body);
      res.json({ success: true, data: result });
    } catch (error) { logger.error({ error }, 'Update category error'); next(error); }
  },
  async deleteCompetencyCategory(req: Request, res: Response, next: NextFunction) {
    try {
      await configService.deleteCompetencyCategory(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) { logger.error({ error }, 'Delete category error'); next(error); }
  },

  // ── Departments ────────────────────────────────────────────────────────────
  async listDepartments(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listDepartments();
      res.json({ success: true, data: result });
    } catch (error) { logger.error({ error }, 'List departments error'); next(error); }
  },
  async createDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.createDepartment(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) { logger.error({ error }, 'Create department error'); next(error); }
  },
  async updateDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.updateDepartment(parseInt(req.params.id), req.body);
      res.json({ success: true, data: result });
    } catch (error) { logger.error({ error }, 'Update department error'); next(error); }
  },
  async deleteDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      await configService.deleteDepartment(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) { logger.error({ error }, 'Delete department error'); next(error); }
  },

  async getDepartmentConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const deptId = parseInt(req.params.id);
      const [cfg, weights, dept] = await Promise.all([
        configService.getDepartmentConfig(deptId),
        configService.getDepartmentDomainWeights(deptId),
        configService.getDepartment(deptId),
      ]);
      res.json({ success: true, data: { config: cfg, domain_weights: weights, department: dept } });
    } catch (error) { logger.error({ error }, 'Get dept config error'); next(error); }
  },

  async upsertDepartmentConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.upsertDepartmentConfig(parseInt(req.params.id), req.body);
      res.json({ success: true, data: result });
    } catch (error) { logger.error({ error }, 'Upsert dept config error'); next(error); }
  },

  async upsertDepartmentDomainWeights(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.upsertDepartmentDomainWeights(parseInt(req.params.id), req.body);
      res.json({ success: true, data: result });
    } catch (error) { logger.error({ error }, 'Upsert dept domain weights error'); next(error); }
  },

  // ── Employees ──────────────────────────────────────────────────────────────
  async listEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listEmployees();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List employees error');
      next(error);
    }
  },

  async createEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.createEmployee(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Create employee error');
      next(error);
    }
  },

  async updateEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const result = await configService.updateEmployee(id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update employee error');
      next(error);
    }
  },

  async deleteEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await configService.deleteEmployee(id);
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Delete employee error');
      next(error);
    }
  },

  // ── Grades ─────────────────────────────────────────────────────────────────
  async listGrades(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listGrades();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List grades error');
      next(error);
    }
  },

  async createGrade(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.createGrade(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Create grade error');
      next(error);
    }
  },

  async updateGrade(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const result = await configService.updateGrade(id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update grade error');
      next(error);
    }
  },

  async deleteGrade(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await configService.deleteGrade(id);
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Delete grade error');
      next(error);
    }
  },

  // ── Skill Domains ──────────────────────────────────────────────────────────
  async listSkillDomains(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listSkillDomains();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List skill domains error');
      next(error);
    }
  },

  async createSkillDomain(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.createSkillDomain(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Create skill domain error');
      next(error);
    }
  },

  async updateSkillDomain(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const result = await configService.updateSkillDomain(id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update skill domain error');
      next(error);
    }
  },

  async deleteSkillDomain(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await configService.deleteSkillDomain(id);
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Delete skill domain error');
      next(error);
    }
  },

  // ── Domain Grade Weights ───────────────────────────────────────────────────
  async listDomainGradeWeights(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listDomainGradeWeights();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List domain grade weights error');
      next(error);
    }
  },

  async upsertDomainGradeWeight(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.upsertDomainGradeWeight(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Upsert domain grade weight error');
      next(error);
    }
  },

  async deleteDomainGradeWeight(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await configService.deleteDomainGradeWeight(id);
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Delete domain grade weight error');
      next(error);
    }
  },

  // ── Competency Grade Thresholds ───────────────────────────────────────────
  async listCompetencyGradeThresholds(req: Request, res: Response, next: NextFunction) {
    try {
      const departmentId = req.query.department_id ? parseInt(String(req.query.department_id)) : undefined;
      const result = await configService.listCompetencyGradeThresholds(departmentId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List competency grade thresholds error');
      next(error);
    }
  },

  async upsertCompetencyGradeThreshold(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.upsertCompetencyGradeThreshold(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Upsert competency grade threshold error');
      next(error);
    }
  },

  async bulkUpsertCompetencyGradeThresholds(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.bulkUpsertCompetencyGradeThresholds(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Bulk upsert competency grade thresholds error');
      next(error);
    }
  },

  // ── Competencies ───────────────────────────────────────────────────────────
  async listCompetencies(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listCompetencies();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List competencies error');
      next(error);
    }
  },

  async createCompetency(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.createCompetency(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Create competency error');
      next(error);
    }
  },

  async updateCompetency(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const result = await configService.updateCompetency(id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update competency error');
      next(error);
    }
  },

  async deleteCompetency(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await configService.deleteCompetency(id);
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Delete competency error');
      next(error);
    }
  },

  // ── Technologies ───────────────────────────────────────────────────────────
  async listTechnologies(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.listTechnologies();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'List technologies error');
      next(error);
    }
  },

  async createTechnology(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await configService.createTechnology(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Create technology error');
      next(error);
    }
  },

  async updateTechnology(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const result = await configService.updateTechnology(id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Update technology error');
      next(error);
    }
  },

  async deleteTechnology(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      await configService.deleteTechnology(id);
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Delete technology error');
      next(error);
    }
  },
};
