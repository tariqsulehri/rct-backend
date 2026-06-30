import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { loginSchema } from './auth.schema';

const router: Router = express.Router();

// Rate limiting for login endpoint
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/v1/auth/login
 * Public endpoint - login with username and password
 */
router.post('/login', loginLimiter, validate(loginSchema), authController.login);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token cookie
 */
router.post('/refresh', authController.refresh);

/**
 * GET /api/v1/auth/me
 * Return latest user identity from the database.
 */
router.get('/me', authenticate, authController.me);

/**
 * POST /api/v1/auth/logout
 * Logout - revoke refresh token and clear cookie
 */
router.post('/logout', authenticate, authController.logout);

export default router;
