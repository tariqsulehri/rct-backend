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

router.post(
  '/chat',
  requireRole('ADMIN', 'TOP_MANAGEMENT', 'MANAGER', 'LINE_MANAGER'),
  aiController.askDashboard,
);

export default router;
