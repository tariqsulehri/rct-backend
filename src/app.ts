import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import env from './config/env';
import logger from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './modules/auth/auth.router';
import assessmentRouter from './modules/assessment/assessment.router';
import configRouter from './modules/config/config.router';
import reportsRouter from './modules/reports/reports.router';

/**
 * Create and configure Express application
 * This is the app factory - no listen() call here for testability
 */
export function createApp(): Express {
  const app = express();

  // ============================================================================
  // REQUEST LOGGING
  // ============================================================================
  app.use(pinoHttp({ logger }));

  // ============================================================================
  // SECURITY HEADERS
  // ============================================================================
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // ============================================================================
  // CORS
  // ============================================================================
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 3600,
    })
  );

  // ============================================================================
  // BODY PARSING
  // ============================================================================
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  // ============================================================================
  // HEALTH CHECK (NO AUTH REQUIRED)
  // ============================================================================
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  });

  // ============================================================================
  // API ROUTES
  // ============================================================================

  // Public routes (no auth)
  app.use('/api/v1/auth', authRouter);

  // Protected routes (require JWT)
  app.use('/api/v1/assessments', assessmentRouter);
  app.use('/api/v1/config', configRouter);
  app.use('/api/v1/reports', reportsRouter);

  // ============================================================================
  // 404 HANDLER
  // ============================================================================
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      code: 'NOT_FOUND',
      path: req.path,
    });
  });

  // ============================================================================
  // ERROR HANDLER (MUST BE LAST)
  // ============================================================================
  app.use(errorHandler);

  return app;
}
