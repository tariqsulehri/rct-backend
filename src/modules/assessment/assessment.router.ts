import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { assessmentController } from './assessment.controller';
import { createSkillAssessmentSchema, updateSkillAssessmentSchema, approveSkillAssessmentSchema } from './assessment.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create skill assessment — ENGINEER may only create for themselves
router.post(
  '/skill-assessments',
  requireRole('MANAGER', 'ADMIN', 'ENGINEER'),
  (req, res, next) => {
    if (req.user!.role === 'ENGINEER' && req.body.employee_id !== req.user!.empCode) {
      res.status(403).json({ success: false, error: 'You can only create assessments for yourself' });
      return;
    }
    next();
  },
  validate(createSkillAssessmentSchema),
  assessmentController.createAssessment,
);

// Approve a pending skill assessment (set status=approved + optional level) — MANAGER/ADMIN only
router.patch(
  '/skill-assessments/:id/approve',
  requireRole('MANAGER', 'ADMIN'),
  validate(approveSkillAssessmentSchema),
  assessmentController.approveAssessment,
);

// Update skill assessment — ENGINEER may only update their own (level is stripped server-side)
router.patch(
  '/skill-assessments/:id',
  requireRole('MANAGER', 'ADMIN', 'ENGINEER'),
  validate(updateSkillAssessmentSchema),
  assessmentController.updateAssessment,
);

// Delete skill assessment — ENGINEER may only delete their own
router.delete(
  '/skill-assessments/:id',
  requireRole('MANAGER', 'ADMIN', 'ENGINEER'),
  assessmentController.deleteAssessment,
);

// Get assessments for specific employee (MANAGER/ADMIN can see anyone; ENGINEER only their own)
router.get(
  '/employees/:empCode/assessments',
  requireRole('MANAGER', 'ADMIN', 'ENGINEER'),
  (req, res, next) => {
    if (req.user!.role === 'ENGINEER' && req.user!.empCode !== req.params.empCode) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
    next();
  },
  assessmentController.getEmployeeAssessments,
);

// Get team roster (manager's direct reports)
router.get(
  '/team-roster',
  requireRole('MANAGER', 'ADMIN'),
  assessmentController.getTeamRoster,
);

// Get all employees (ADMIN only)
router.get(
  '/employees',
  requireRole('ADMIN'),
  assessmentController.getAllEmployees,
);

export default router;
