import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { reportsController } from './reports.controller';

const router = Router();
router.use(authenticate);

const requireReportsAccess = (req: any, res: any, next: any) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'User not authenticated' });
    return;
  }
  next();
};

// Engineers can only view their own gap analysis
router.get(
  '/gap-analysis/:empCode',
  requireReportsAccess,
  (req, res, next) => {
    if (req.user!.role === 'ENGINEER' && req.user!.empCode !== req.params.empCode) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
    next();
  },
  reportsController.getGapAnalysis,
);

router.get('/promotion-readiness', requireReportsAccess, reportsController.getPromotionReadiness);
router.get('/competency-scores',   requireReportsAccess, reportsController.getCompetencyScores);
router.get('/competency-matrix',   requireReportsAccess, reportsController.getCompetencyMatrix);
router.get('/gap-matrix',          requireReportsAccess, reportsController.getGapMatrix);
router.get('/gap-report/download', requireReportsAccess, reportsController.downloadGapReport);
router.get('/skills-summary',       requireReportsAccess, reportsController.getSkillsSummary);
router.get('/assessment-history',  requireReportsAccess, reportsController.getAssessmentHistory);
router.get('/executive-summary',   requireReportsAccess, reportsController.getExecutiveSummary);
router.get('/combined-matrix',      requireReportsAccess, reportsController.getCombinedMatrix);
router.get('/yoy-growth',           requireReportsAccess, reportsController.getYoYGrowth);

export default router;
