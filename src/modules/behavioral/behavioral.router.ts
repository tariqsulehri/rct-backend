import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { behavioralController } from './behavioral.controller';
import { createBehavioralAssessmentSchema } from './behavioral.schema';

const router = Router();

// Reference configuration (shared read)
router.get('/config', behavioralController.getConfig);

// Authenticated endpoints
router.use(authenticate);

// Create behavioral assessment (Line Managers, Managers, Admins, Top Management)
router.post(
  '/assessments',
  requireRole('MANAGER', 'LINE_MANAGER', 'ADMIN', 'TOP_MANAGEMENT'),
  validate(createBehavioralAssessmentSchema),
  behavioralController.createAssessment
);

// Get assessment result by ID
router.get(
  '/assessments/:id/result',
  requireRole('MANAGER', 'LINE_MANAGER', 'ADMIN', 'TOP_MANAGEMENT', 'ENGINEER'),
  behavioralController.getAssessmentById
);

router.get(
  '/assessments/:id',
  requireRole('MANAGER', 'LINE_MANAGER', 'ADMIN', 'TOP_MANAGEMENT', 'ENGINEER'),
  behavioralController.getAssessmentById
);

// Get latest assessment for a subject employee
router.get(
  '/subjects/:employeeId/latest',
  requireRole('MANAGER', 'LINE_MANAGER', 'ADMIN', 'TOP_MANAGEMENT', 'ENGINEER'),
  behavioralController.getLatestSubjectAssessment
);

// Get assessment history for a subject employee
router.get(
  '/subjects/:employeeId/history',
  requireRole('MANAGER', 'LINE_MANAGER', 'ADMIN', 'TOP_MANAGEMENT', 'ENGINEER'),
  behavioralController.getSubjectHistory
);

export default router;
