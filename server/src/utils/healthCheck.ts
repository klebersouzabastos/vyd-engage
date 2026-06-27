import prisma from '../config/database.js';
import { logger } from './logger.js';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    api: 'up' | 'down';
  };
  uptime: number;
  version: string;
}

const startTime = Date.now();

export async function getHealthStatus(): Promise<HealthStatus> {
  const status: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'down',
      api: 'up',
    },
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || '1.0.0',
  };

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    status.services.database = 'up';
  } catch (error) {
    logger.error('Database health check failed', error);
    status.services.database = 'down';
    status.status = 'unhealthy';
  }

  return status;
}
