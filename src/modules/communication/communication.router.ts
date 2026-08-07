import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { communicationController } from './communication.controller';
import {
  createCommAssessmentSchema,
  updateCommAssessmentStatusSchema,
} from './communication.schema';

const router = Router();

// Public / shared configuration read
router.get('/config', communicationController.getConfig);

// Authenticated endpoints
router.use(authenticate);

// Update configuration (Admin only)
router.put('/config', requireRole('ADMIN'), communicationController.updateConfig);

// Create CEFR communication assessment (Line Managers, Admins & Communication Experts)
router.post(
  '/assessments',
  requireRole('MANAGER', 'LINE_MANAGER', 'ADMIN', 'TOP_MANAGEMENT', 'COMMUNICATION_EXPERT', 'LANGUAGE_EXPERT'),
  validate(createCommAssessmentSchema),
  communicationController.createAssessment,
);

// Get assessment by ID
router.get(
  '/assessments/:id',
  requireRole('MANAGER', 'LINE_MANAGER', 'ADMIN', 'ENGINEER', 'TOP_MANAGEMENT'),
  communicationController.getAssessmentById,
);

// Get latest assessment for a subject / employee
router.get(
  '/subjects/:employeeId/latest',
  requireRole('MANAGER', 'LINE_MANAGER', 'ADMIN', 'ENGINEER', 'TOP_MANAGEMENT'),
  communicationController.getLatestSubjectAssessment,
);

// Get assessment history for an employee
router.get(
  '/subjects/:employeeId/history',
  requireRole('MANAGER', 'LINE_MANAGER', 'ADMIN', 'ENGINEER', 'TOP_MANAGEMENT'),
  communicationController.getSubjectHistory,
);

// Approve or update status of assessment
router.patch(
  '/assessments/:id/status',
  requireRole('MANAGER', 'LINE_MANAGER', 'TOP_MANAGEMENT', 'ADMIN'),
  validate(updateCommAssessmentStatusSchema),
  communicationController.updateAssessmentStatus,
);

export default router;
