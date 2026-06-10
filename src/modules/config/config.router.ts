import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { configController } from './config.controller';
import {
  createUserSchema,
  updateUserSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  createGradeSchema,
  updateGradeSchema,
  createSkillDomainSchema,
  updateSkillDomainSchema,
  createCompetencySchema,
  updateCompetencySchema,
  createTechnologySchema,
  updateTechnologySchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  upsertDepartmentConfigSchema,
  bulkUpsertDomainWeightsSchema,
  updateAssessmentTypeConfigSchema,
  updateAssessmentLevelConfigSchema,
  updateAssessmentStatusConfigSchema,
  updateAssessmentProjectConfigSchema,
  createCompetencyCategorySchema,
  updateCompetencyCategorySchema,
  upsertDomainGradeWeightSchema,
  upsertCompetencyGradeThresholdSchema,
  bulkUpsertCompetencyGradeThresholdsSchema,
  updateRoleSchema,
  createDepartmentAssignmentSchema,
  updateDepartmentAssignmentSchema,
  createLineManagerAssignmentSchema,
  updateLineManagerAssignmentSchema,
} from './config.schema';

const router = Router();

// All config routes require authentication
router.use(authenticate);

// ── Roles (ADMIN only) ───────────────────────────────────────────────────────
router.get('/roles', requireRole('ADMIN'), configController.listRoles);
router.patch('/roles/:id', requireRole('ADMIN'), validate(updateRoleSchema), configController.updateRole);

// ── Access Management (ADMIN only) ───────────────────────────────────────────
router.get('/access/department-assignments', requireRole('ADMIN'), configController.listDepartmentAssignments);
router.post('/access/department-assignments', requireRole('ADMIN'), validate(createDepartmentAssignmentSchema), configController.createDepartmentAssignment);
router.patch('/access/department-assignments/:id', requireRole('ADMIN'), validate(updateDepartmentAssignmentSchema), configController.updateDepartmentAssignment);
router.delete('/access/department-assignments/:id', requireRole('ADMIN'), configController.deleteDepartmentAssignment);

router.get('/access/line-manager-assignments', requireRole('ADMIN'), configController.listLineManagerAssignments);
router.post('/access/line-manager-assignments', requireRole('ADMIN'), validate(createLineManagerAssignmentSchema), configController.createLineManagerAssignment);
router.patch('/access/line-manager-assignments/:id', requireRole('ADMIN'), validate(updateLineManagerAssignmentSchema), configController.updateLineManagerAssignment);
router.delete('/access/line-manager-assignments/:id', requireRole('ADMIN'), configController.deleteLineManagerAssignment);

router.get('/access/audit-logs', requireRole('ADMIN'), configController.listAccessAuditLogs);

// ── Scoring Config (ADMIN only) ──────────────────────────────────────────────
router.get('/assessment-types', requireRole('ADMIN'), configController.listAssessmentTypeConfigs);
router.patch('/assessment-types/:id', requireRole('ADMIN'), validate(updateAssessmentTypeConfigSchema), configController.updateAssessmentTypeConfig);

router.get('/assessment-levels', requireRole('ADMIN'), configController.listAssessmentLevelConfigs);
router.patch('/assessment-levels/:id', requireRole('ADMIN'), validate(updateAssessmentLevelConfigSchema), configController.updateAssessmentLevelConfig);

router.get('/assessment-statuses', requireRole('ADMIN'), configController.listAssessmentStatusConfigs);
router.patch('/assessment-statuses/:id', requireRole('ADMIN'), validate(updateAssessmentStatusConfigSchema), configController.updateAssessmentStatusConfig);

router.get('/assessment-projects', requireRole('ADMIN'), configController.listAssessmentProjectConfigs);
router.patch('/assessment-projects/:id', requireRole('ADMIN'), validate(updateAssessmentProjectConfigSchema), configController.updateAssessmentProjectConfig);

// ── Departments (ADMIN only) ──────────────────────────────────────────────────
router.get('/departments', requireRole('ADMIN'), configController.listDepartments);
router.post('/departments', requireRole('ADMIN'), validate(createDepartmentSchema), configController.createDepartment);
router.patch('/departments/:id', requireRole('ADMIN'), validate(updateDepartmentSchema), configController.updateDepartment);
router.delete('/departments/:id', requireRole('ADMIN'), configController.deleteDepartment);

// Department config (formula weights + domain weights)
router.get('/departments/:id/config', requireRole('ADMIN'), configController.getDepartmentConfig);
router.put('/departments/:id/config', requireRole('ADMIN'), validate(upsertDepartmentConfigSchema), configController.upsertDepartmentConfig);
router.put('/departments/:id/domain-weights', requireRole('ADMIN'), validate(bulkUpsertDomainWeightsSchema), configController.upsertDepartmentDomainWeights);

// ── Users (ADMIN only) ────────────────────────────────────────────────────────
router.get('/users', requireRole('ADMIN'), configController.listUsers);
router.post('/users', requireRole('ADMIN'), validate(createUserSchema), configController.createUser);
router.patch('/users/:id', requireRole('ADMIN'), validate(updateUserSchema), configController.updateUser);
router.delete('/users/:id', requireRole('ADMIN'), configController.deleteUser);

// ── Employees (ADMIN only) ────────────────────────────────────────────────────
router.get('/employees', requireRole('ADMIN'), configController.listEmployees);
router.post('/employees', requireRole('ADMIN'), validate(createEmployeeSchema), configController.createEmployee);
router.patch('/employees/:id', requireRole('ADMIN'), validate(updateEmployeeSchema), configController.updateEmployee);
router.delete('/employees/:id', requireRole('ADMIN'), configController.deleteEmployee);

// ── Grades (ADMIN only) ───────────────────────────────────────────────────────
router.get('/grades', requireRole('ADMIN'), configController.listGrades);
router.post('/grades', requireRole('ADMIN'), validate(createGradeSchema), configController.createGrade);
router.patch('/grades/:id', requireRole('ADMIN'), validate(updateGradeSchema), configController.updateGrade);
router.delete('/grades/:id', requireRole('ADMIN'), configController.deleteGrade);

// ── Skill Domains (ADMIN only) ────────────────────────────────────────────────
router.get('/skill-domains', requireRole('ADMIN'), configController.listSkillDomains);
router.post('/skill-domains', requireRole('ADMIN'), validate(createSkillDomainSchema), configController.createSkillDomain);
router.patch('/skill-domains/:id', requireRole('ADMIN'), validate(updateSkillDomainSchema), configController.updateSkillDomain);
router.delete('/skill-domains/:id', requireRole('ADMIN'), configController.deleteSkillDomain);

// ── Domain Grade Weights (ADMIN only) ─────────────────────────────────────────
router.get('/domain-grade-weights', requireRole('ADMIN'), configController.listDomainGradeWeights);
router.post('/domain-grade-weights', requireRole('ADMIN'), validate(upsertDomainGradeWeightSchema), configController.upsertDomainGradeWeight);
router.delete('/domain-grade-weights/:id', requireRole('ADMIN'), configController.deleteDomainGradeWeight);

// ── Department Skill Thresholds (ADMIN only) ─────────────────────────────────
router.get('/competency-grade-thresholds', requireRole('ADMIN'), configController.listCompetencyGradeThresholds);
router.post('/competency-grade-thresholds', requireRole('ADMIN'), validate(upsertCompetencyGradeThresholdSchema), configController.upsertCompetencyGradeThreshold);
router.put('/competency-grade-thresholds/bulk', requireRole('ADMIN'), validate(bulkUpsertCompetencyGradeThresholdsSchema), configController.bulkUpsertCompetencyGradeThresholds);

// ── Competencies (ADMIN only) ─────────────────────────────────────────────────
router.get('/competencies', requireRole('ADMIN'), configController.listCompetencies);
router.post('/competencies', requireRole('ADMIN'), validate(createCompetencySchema), configController.createCompetency);
router.patch('/competencies/:id', requireRole('ADMIN'), validate(updateCompetencySchema), configController.updateCompetency);
router.delete('/competencies/:id', requireRole('ADMIN'), configController.deleteCompetency);

// ── Technologies ──────────────────────────────────────────────────────────────
// Read is open to all roles so MANAGER and ENGINEER can browse the skill catalog
router.get('/technologies', requireRole('ADMIN', 'TOP_MANAGEMENT', 'MANAGER', 'LINE_MANAGER', 'ENGINEER'), configController.listTechnologies);
router.post('/technologies', requireRole('ADMIN'), validate(createTechnologySchema), configController.createTechnology);
router.patch('/technologies/:id', requireRole('ADMIN'), validate(updateTechnologySchema), configController.updateTechnology);
router.delete('/technologies/:id', requireRole('ADMIN'), configController.deleteTechnology);

// ── Competency Categories (ADMIN only) ────────────────────────────────────────
router.get('/competency-categories', requireRole('ADMIN'), configController.listCompetencyCategories);
router.post('/competency-categories', requireRole('ADMIN'), validate(createCompetencyCategorySchema), configController.createCompetencyCategory);
router.patch('/competency-categories/:id', requireRole('ADMIN'), validate(updateCompetencyCategorySchema), configController.updateCompetencyCategory);
router.delete('/competency-categories/:id', requireRole('ADMIN'), configController.deleteCompetencyCategory);

export default router;
