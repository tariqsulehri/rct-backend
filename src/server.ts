import { createApp } from './app';
import { prisma } from './config/database';
import env from './config/env';
import logger from './config/logger';
import { configService } from './modules/config/config.service';

async function main() {
  try {
    await configService.ensurePermissions();

    // Create Express app
    const app = createApp();

    // Start listening
    const server = app.listen(env.API_PORT, () => {
      logger.info(`🚀 Server running on port ${env.API_PORT}`);
      logger.info(`📚 Environment: ${env.NODE_ENV}`);
      logger.info(`🔗 Frontend URL: ${env.FRONTEND_URL}`);
    });

    // ========================================================================
    // GRACEFUL SHUTDOWN
    // ========================================================================
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(() => {
        logger.info('Server closed');
      });

      // Close database connection
      await prisma.$disconnect();
      logger.info('Database disconnected');

      // Exit with success
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // ========================================================================
    // ERROR HANDLING
    // ========================================================================
    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise }, 'Unhandled Rejection');
    });

    process.on('uncaughtException', (error) => {
      logger.error({ err: error }, 'Uncaught Exception');
      process.exit(1);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

main();
