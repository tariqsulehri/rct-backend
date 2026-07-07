import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission, requireRole } from '../../middleware/authorize';
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
  syncDepartmentSkillMapSchema,
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
  syncLineManagerAssignmentsSchema,
  updateRolePermissionsSchema,
} from './config.schema';

const router = Router();

// All config routes require authentication
router.use(authenticate);

// ── Roles and permissions ────────────────────────────────────────────────────
router.get('/roles', requirePermission('roles.manage'), configController.listRoles);
router.patch('/roles/:id', requirePermission('roles.manage'), validate(updateRoleSchema), configController.updateRole);
router.get('/permissions', requirePermission('roles.manage'), configController.listPermissions);
router.put('/roles/:id/permissions', requirePermission('roles.manage'), validate(updateRolePermissionsSchema), configController.updateRolePermissions);

// ── Access Management ────────────────────────────────────────────────────────
router.get('/access/department-assignments', requirePermission('assignments.manage'), configController.listDepartmentAssignments);
router.post('/access/department-assignments', requirePermission('assignments.manage'), validate(createDepartmentAssignmentSchema), configController.createDepartmentAssignment);
router.patch('/access/department-assignments/:id', requirePermission('assignments.manage'), validate(updateDepartmentAssignmentSchema), configController.updateDepartmentAssignment);
router.delete('/access/department-assignments/:id', requirePermission('assignments.manage'), configController.deleteDepartmentAssignment);

router.get('/access/line-manager-assignments', requirePermission('assignments.manage'), configController.listLineManagerAssignments);
router.post('/access/line-manager-assignments', requirePermission('assignments.manage'), validate(createLineManagerAssignmentSchema), configController.createLineManagerAssignment);
router.post('/access/line-manager-assignments/sync', requirePermission('assignments.manage'), validate(syncLineManagerAssignmentsSchema), configController.syncLineManagerAssignments);
router.patch('/access/line-manager-assignments/:id', requirePermission('assignments.manage'), validate(updateLineManagerAssignmentSchema), configController.updateLineManagerAssignment);
router.delete('/access/line-manager-assignments/:id', requirePermission('assignments.manage'), configController.deleteLineManagerAssignment);

router.get('/access/audit-logs', requirePermission('assignments.manage'), configController.listAccessAuditLogs);

// ── Scoring Config ───────────────────────────────────────────────────────────
router.get('/assessment-types', requirePermission('config.manage'), configController.listAssessmentTypeConfigs);
router.patch('/assessment-types/:id', requirePermission('config.manage'), validate(updateAssessmentTypeConfigSchema), configController.updateAssessmentTypeConfig);

router.get('/assessment-levels', requirePermission('config.manage'), configController.listAssessmentLevelConfigs);
router.patch('/assessment-levels/:id', requirePermission('config.manage'), validate(updateAssessmentLevelConfigSchema), configController.updateAssessmentLevelConfig);

router.get('/assessment-statuses', requirePermission('config.manage'), configController.listAssessmentStatusConfigs);
router.patch('/assessment-statuses/:id', requirePermission('config.manage'), validate(updateAssessmentStatusConfigSchema), configController.updateAssessmentStatusConfig);

router.get('/assessment-projects', requirePermission('config.manage'), configController.listAssessmentProjectConfigs);
router.patch('/assessment-projects/:id', requirePermission('config.manage'), validate(updateAssessmentProjectConfigSchema), configController.updateAssessmentProjectConfig);

// ── Departments ──────────────────────────────────────────────────────────────
router.get('/departments', requirePermission('config.manage'), configController.listDepartments);
router.post('/departments', requirePermission('config.manage'), validate(createDepartmentSchema), configController.createDepartment);
router.patch('/departments/:id', requirePermission('config.manage'), validate(updateDepartmentSchema), configController.updateDepartment);
router.delete('/departments/:id', requirePermission('config.manage'), configController.deleteDepartment);

// Department config (formula weights + domain weights)
router.get('/departments/:id/config', requirePermission('config.manage'), configController.getDepartmentConfig);
router.put('/departments/:id/config', requirePermission('config.manage'), validate(upsertDepartmentConfigSchema), configController.upsertDepartmentConfig);
router.put('/departments/:id/domain-weights', requirePermission('config.manage'), validate(bulkUpsertDomainWeightsSchema), configController.upsertDepartmentDomainWeights);

// ── Users ────────────────────────────────────────────────────────────────────
router.get('/users', requirePermission('users.manage'), configController.listUsers);
router.post('/users', requirePermission('users.manage'), validate(createUserSchema), configController.createUser);
router.patch('/users/:id', requirePermission('users.manage'), validate(updateUserSchema), configController.updateUser);
router.delete('/users/:id', requirePermission('users.manage'), configController.deleteUser);

// ── Employees ────────────────────────────────────────────────────────────────
router.get('/employees', requirePermission('employees.view', 'employees.manage'), configController.listEmployees);
router.post('/employees', requirePermission('employees.manage'), validate(createEmployeeSchema), configController.createEmployee);
router.patch('/employees/:id', requirePermission('employees.manage'), validate(updateEmployeeSchema), configController.updateEmployee);
router.delete('/employees/:id', requirePermission('employees.manage'), configController.deleteEmployee);

// ── Grades ───────────────────────────────────────────────────────────────────
router.get('/grades', requirePermission('config.manage'), configController.listGrades);
router.post('/grades', requirePermission('config.manage'), validate(createGradeSchema), configController.createGrade);
router.patch('/grades/:id', requirePermission('config.manage'), validate(updateGradeSchema), configController.updateGrade);
router.delete('/grades/:id', requirePermission('config.manage'), configController.deleteGrade);

// ── Skill Domains ────────────────────────────────────────────────────────────
router.get('/skill-domains', requirePermission('config.manage'), configController.listSkillDomains);
router.post('/skill-domains', requirePermission('config.manage'), validate(createSkillDomainSchema), configController.createSkillDomain);
router.patch('/skill-domains/:id', requirePermission('config.manage'), validate(updateSkillDomainSchema), configController.updateSkillDomain);
router.delete('/skill-domains/:id', requirePermission('config.manage'), configController.deleteSkillDomain);

// ── Domain Grade Weights ─────────────────────────────────────────────────────
router.get('/domain-grade-weights', requirePermission('config.manage'), configController.listDomainGradeWeights);
router.post('/domain-grade-weights', requirePermission('config.manage'), validate(upsertDomainGradeWeightSchema), configController.upsertDomainGradeWeight);
router.delete('/domain-grade-weights/:id', requirePermission('config.manage'), configController.deleteDomainGradeWeight);

// ── Department Skill Thresholds ──────────────────────────────────────────────
router.get('/competency-grade-thresholds', requirePermission('config.manage'), configController.listCompetencyGradeThresholds);
router.post('/competency-grade-thresholds', requirePermission('config.manage'), validate(upsertCompetencyGradeThresholdSchema), configController.upsertCompetencyGradeThreshold);
router.put('/competency-grade-thresholds/bulk', requirePermission('config.manage'), validate(bulkUpsertCompetencyGradeThresholdsSchema), configController.bulkUpsertCompetencyGradeThresholds);

// ── Competencies ─────────────────────────────────────────────────────────────
router.get('/competencies', requirePermission('config.manage'), configController.listCompetencies);
router.post('/competencies', requirePermission('config.manage'), validate(createCompetencySchema), configController.createCompetency);
router.patch('/competencies/:id', requirePermission('config.manage'), validate(updateCompetencySchema), configController.updateCompetency);
router.delete('/competencies/:id', requirePermission('config.manage'), configController.deleteCompetency);
router.put('/department-skill-map', requirePermission('config.manage'), validate(syncDepartmentSkillMapSchema), configController.syncDepartmentSkillMap);

// ── Technologies ──────────────────────────────────────────────────────────────
// Read is open to all roles so MANAGER and ENGINEER can browse the skill catalog
router.get('/technologies', requireRole('ADMIN', 'TOP_MANAGEMENT', 'MANAGER', 'LINE_MANAGER', 'ENGINEER'), configController.listTechnologies);
router.post('/technologies', requirePermission('config.manage'), validate(createTechnologySchema), configController.createTechnology);
router.patch('/technologies/:id', requirePermission('config.manage'), validate(updateTechnologySchema), configController.updateTechnology);
router.delete('/technologies/:id', requirePermission('config.manage'), configController.deleteTechnology);

// ── Competency Categories ────────────────────────────────────────────────────
router.get('/competency-categories', requirePermission('config.manage'), configController.listCompetencyCategories);
router.post('/competency-categories', requirePermission('config.manage'), validate(createCompetencyCategorySchema), configController.createCompetencyCategory);
router.patch('/competency-categories/:id', requirePermission('config.manage'), validate(updateCompetencyCategorySchema), configController.updateCompetencyCategory);
router.delete('/competency-categories/:id', requirePermission('config.manage'), configController.deleteCompetencyCategory);

export default router;
