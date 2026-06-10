import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { reportsController } from './reports.controller';

const router = Router();
router.use(authenticate);

// Engineers can only view their own gap analysis
router.get(
  '/gap-analysis/:empCode',
  requireRole('MANAGER', 'LINE_MANAGER', 'TOP_MANAGEMENT', 'ADMIN', 'ENGINEER'),
  (req, res, next) => {
    if (req.user!.role === 'ENGINEER' && req.user!.empCode !== req.params.empCode) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
    next();
  },
  reportsController.getGapAnalysis,
);
router.get('/promotion-readiness', requireRole('MANAGER', 'LINE_MANAGER', 'TOP_MANAGEMENT', 'ADMIN'), reportsController.getPromotionReadiness);
// Engineers can view their own competency scores
router.get('/competency-scores', requireRole('MANAGER', 'LINE_MANAGER', 'TOP_MANAGEMENT', 'ADMIN', 'ENGINEER'), reportsController.getCompetencyScores);
router.get('/competency-matrix', requireRole('MANAGER', 'LINE_MANAGER', 'TOP_MANAGEMENT', 'ADMIN'), reportsController.getCompetencyMatrix);
router.get('/gap-matrix',           requireRole('MANAGER', 'LINE_MANAGER', 'TOP_MANAGEMENT', 'ADMIN', 'ENGINEER'), reportsController.getGapMatrix);
router.get('/gap-report/download',  requireRole('MANAGER', 'LINE_MANAGER', 'TOP_MANAGEMENT', 'ADMIN'), reportsController.downloadGapReport);
router.get('/skills-summary',    requireRole('MANAGER', 'LINE_MANAGER', 'TOP_MANAGEMENT', 'ADMIN'), reportsController.getSkillsSummary);
router.get('/assessment-history', requireRole('MANAGER', 'LINE_MANAGER', 'TOP_MANAGEMENT', 'ADMIN'), reportsController.getAssessmentHistory);

export default router;
