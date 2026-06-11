import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { aiController } from './ai.controller';

const router = Router();

router.use(authenticate);

router.get(
  '/dashboard',
  requireRole('ADMIN', 'TOP_MANAGEMENT', 'MANAGER', 'LINE_MANAGER'),
  aiController.getDashboard,
);

export default router;
