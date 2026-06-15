import { beforeEach, vi } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';
import prisma from '../../config/database.js';

/**
 * Replaces the real Prisma singleton (which opens a DB connection on import)
 * with a deep mock, so services can be unit-tested without a database.
 *
 * Import this helper in a unit test BEFORE the service under test:
 *   import { prismaMock } from '../helpers/prismaMock.js';
 *   import { tagService } from '../../services/tagService.js';
 */
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});
