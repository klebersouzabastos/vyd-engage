import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

const SOFT_DELETE_MODELS = new Set(['Lead', 'Deal', 'Company', 'Task', 'SavedView', 'Interaction']);

// Automatically exclude soft-deleted records from read queries.
// Queries that explicitly need deleted records must pass `deletedAt: { not: null }`.
// eslint-disable-next-line @typescript-eslint/no-deprecated
prisma.$use(async (params, next) => {
  if (params.model && SOFT_DELETE_MODELS.has(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args ??= {};
      params.args.where = { deletedAt: null, ...params.args.where };
    }
    if (params.action === 'findUnique') {
      params.action = 'findFirst';
      params.args ??= {};
      params.args.where = { deletedAt: null, ...params.args.where };
    }
  }
  return next(params);
});

// Connect to database with retry for cloud deployments
async function connectWithRetry(maxRetries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$connect();
      logger.info('Database connected successfully');
      return;
    } catch (error) {
      logger.error(`Database connection attempt ${attempt}/${maxRetries} failed`, error);
      if (attempt < maxRetries) {
        logger.info(`Retrying in ${delayMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  logger.error('All database connection attempts failed. Server will start but DB queries will fail.');
}

connectWithRetry();

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Database disconnected');
});

export default prisma;








