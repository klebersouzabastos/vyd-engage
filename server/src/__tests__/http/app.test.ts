import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

// Neutralize all Redis-backed infrastructure so the full app can be imported
// without a running Redis (BullMQ queues/workers are created at module load).
vi.mock('bullmq', () => {
  class FakeQueue {
    add = vi.fn();
    on = vi.fn();
    close = vi.fn();
  }
  class FakeWorker {
    on = vi.fn();
    close = vi.fn();
  }
  class FakeQueueEvents {
    on = vi.fn();
    close = vi.fn();
  }
  return { Queue: FakeQueue, Worker: FakeWorker, QueueEvents: FakeQueueEvents };
});
vi.mock('ioredis', () => {
  class FakeRedis {
    on = vi.fn();
    quit = vi.fn();
    disconnect = vi.fn();
  }
  return { default: FakeRedis, Redis: FakeRedis };
});
// Avoid the always-on setInterval keeping the test process alive.
vi.mock('../../jobs/taskNotificationChecker.js', () => ({
  initializeTaskNotificationChecker: vi.fn(),
  stopTaskNotificationChecker: vi.fn(),
}));
// Mock the DB singleton (no real connection).
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

import prisma from '../../config/database.js';
import app from '../../index.js';
import { tenantFactory, leadFactory } from '../factories/index.js';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});

describe('app wiring (supertest, mocked infra)', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Route not found' });
  });

  it('serves the OpenAPI spec at /api/v1/openapi.json', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.paths).toHaveProperty('/public/capture/{tenantSlug}');
    expect(res.body.paths).toHaveProperty('/public/plans');
  });

  describe('POST /api/public/capture/:tenantSlug', () => {
    it('returns 404 when the tenant slug does not exist', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/public/capture/unknown-slug')
        .send({ name: 'Fulano' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Form not found' });
    });

    it('validates the body and returns 400 when name is missing', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(tenantFactory.build({ slug: 'acme' }));

      const res = await request(app)
        .post('/api/public/capture/acme')
        .send({ email: 'no-name@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('captures a lead and returns 201 on a valid body', async () => {
      const tenant = tenantFactory.build({ slug: 'acme' });
      const lead = leadFactory.build({ tenantId: tenant.id, name: 'Fulano' });
      prismaMock.tenant.findUnique.mockResolvedValue(tenant);
      prismaMock.lead.create.mockResolvedValue(lead);

      const res = await request(app)
        .post('/api/public/capture/acme')
        .send({ name: 'Fulano', email: 'fulano@example.com' });

      expect(res.status).toBe(201);
      expect(res.body.leadId).toBe(lead.id);
    });
  });
});
