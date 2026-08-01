import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { isProductionDatabaseUrl } from './dbSafety.js';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Aviso alto (sem bloquear) quando um ambiente de desenvolvimento conecta no
// banco de produção — situação real deste projeto (server/.env → Railway).
if (process.env.NODE_ENV !== 'production' && isProductionDatabaseUrl()) {
  logger.warn(
    '⚠️  [dbSafety] DATABASE_URL aponta para o banco de PRODUÇÃO com NODE_ENV != production. ' +
      'Escritas atingem dados reais. Testes/seed-demo estão bloqueados; scripts exigem ALLOW_PROD_DB=true.'
  );
}

// Rede de segurança contra mutações em massa desprotegidas. Causa raiz do
// incidente de 03/07/2026: afterEach com `deleteMany({ where: { tenantId } })`
// onde tenantId era undefined — o Prisma ignora filtros undefined em silêncio
// e a operação virou um wipe da tabela inteira em produção.
prisma.$use(async (params, next) => {
  if (params.action === 'deleteMany' || params.action === 'updateMany') {
    const where = params.args?.where;
    if (!where || Object.keys(where).length === 0) {
      throw new Error(
        `[tenant-guard] ${params.model ?? '?'}.${params.action} sem \`where\` — bloqueado: ` +
          'atingiria a tabela inteira. Filtre explicitamente (no mínimo por tenantId).'
      );
    }
    const assertNoUndefined = (obj: Record<string, unknown>, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) {
          throw new Error(
            `[tenant-guard] ${params.model ?? '?'}.${params.action}: filtro "${path}${key}" é undefined — ` +
              'o Prisma ignoraria esse filtro silenciosamente e a mutação escaparia do escopo pretendido ' +
              '(causa do incidente de 03/07/2026). Resolva o valor antes de chamar.'
          );
        }
        if ((key === 'AND' || key === 'OR' || key === 'NOT') && Array.isArray(value)) {
          value.forEach((v, i) => {
            if (v && typeof v === 'object') {
              assertNoUndefined(v as Record<string, unknown>, `${path}${key}[${i}].`);
            }
          });
        }
      }
    };
    assertNoUndefined(where as Record<string, unknown>);
  }
  return next(params);
});

const SOFT_DELETE_MODELS = new Set(['Lead', 'Deal', 'Company', 'Task', 'SavedView', 'Interaction']);

// Automatically exclude soft-deleted records from read queries.
// Queries that explicitly need deleted records must pass `deletedAt: { not: null }`.

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
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  logger.error(
    'All database connection attempts failed. Server will start but DB queries will fail.'
  );
}

connectWithRetry();

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Database disconnected');
});

export default prisma;
