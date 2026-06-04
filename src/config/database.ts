import { PrismaClient } from '@prisma/client';
import logger from './logger';

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // Prevent instantiating multiple Prisma instances in development
  const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  prisma = globalForPrisma.prisma;
}

// Log connection
prisma.$connect().then(() => {
  logger.info('✅ Database connected');
});

// Handle disconnection gracefully
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export { prisma };
export const db = prisma;
