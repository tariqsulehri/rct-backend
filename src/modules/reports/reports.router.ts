import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { reportsController } from './reports.controller';

const router = Router();
router.use(authenticate);

// Engineers can only view their own gap analysis
router.get(
  '/gap-analysis/:empCode',
  requireRole('MANAGER', 'ADMIN', 'ENGINEER'),
  (req, res, next) => {
    if (req.user!.role === 'ENGINEER' && req.user!.empCode !== req.params.empCode) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
    next();
  },
  reportsController.getGapAnalysis,
);
router.get('/promotion-readiness', requireRole('MANAGER', 'ADMIN'), reportsController.getPromotionReadiness);
// Engineers can view their own competency scores
router.get('/competency-scores', requireRole('MANAGER', 'ADMIN', 'ENGINEER'), reportsController.getCompetencyScores);
router.get('/competency-matrix', requireRole('MANAGER', 'ADMIN'), reportsController.getCompetencyMatrix);
router.get('/gap-matrix',           requireRole('MANAGER', 'ADMIN', 'ENGINEER'), reportsController.getGapMatrix);
router.get('/gap-report/download',  requireRole('MANAGER', 'ADMIN'), reportsController.downloadGapReport);
router.get('/skills-summary',    requireRole('MANAGER', 'ADMIN'), reportsController.getSkillsSummary);
router.get('/assessment-history', requireRole('MANAGER', 'ADMIN'), reportsController.getAssessmentHistory);

export default router;
