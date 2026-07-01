import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { reportsController } from './reports.controller';

const router = Router();
router.use(authenticate);

const requireReportsViewOrEngineer = (req: any, res: any, next: any) => {
  if (req.user?.role === 'ENGINEER') return next();
  return requirePermission('reports.view')(req, res, next);
};

// Engineers can only view their own gap analysis
router.get(
  '/gap-analysis/:empCode',
  requireReportsViewOrEngineer,
  (req, res, next) => {
    if (req.user!.role === 'ENGINEER' && req.user!.empCode !== req.params.empCode) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
    next();
  },
  reportsController.getGapAnalysis,
);
router.get('/promotion-readiness', requirePermission('reports.view'), reportsController.getPromotionReadiness);
// Engineers can view their own competency scores
router.get('/competency-scores', requireReportsViewOrEngineer, reportsController.getCompetencyScores);
router.get('/competency-matrix', requirePermission('reports.view'), reportsController.getCompetencyMatrix);
router.get('/gap-matrix',           requireReportsViewOrEngineer, reportsController.getGapMatrix);
router.get('/gap-report/download',  requirePermission('reports.view'), reportsController.downloadGapReport);
router.get('/skills-summary',    requirePermission('reports.view'), reportsController.getSkillsSummary);
router.get('/assessment-history', requirePermission('reports.view'), reportsController.getAssessmentHistory);

export default router;
