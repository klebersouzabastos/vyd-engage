import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { automationService } from '../services/automationService.js';
import prisma from '../config/database.js';

describe('Automation Service', () => {
  let testTenantId: string;

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Automation Test Company',
        slug: `auto-test-${Date.now()}`,
      },
    });
    testTenantId = tenant.id;
  });

  afterEach(async () => {
    const automations = await prisma.automation.findMany({
      where: { tenantId: testTenantId },
    });
    if (automations.length > 0) {
      await prisma.automationLog.deleteMany({
        where: { automationId: { in: automations.map(a => a.id) } },
      });
    }
    await prisma.automation.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.delete({ where: { id: testTenantId } });
  });

  describe('create', () => {
    it('should create an automation with DRAFT status', async () => {
      const automation = await automationService.create(testTenantId, {
        name: 'Welcome Email',
        trigger: { type: 'lead_created', config: {} },
        steps: [{ type: 'send_email', config: { template: 'welcome' } }],
      });

      expect(automation).toHaveProperty('id');
      expect(automation.name).toBe('Welcome Email');
      expect(automation.status).toBe('DRAFT');
      expect(automation.tenantId).toBe(testTenantId);
    });

    it('should create automation with description and conditions', async () => {
      const automation = await automationService.create(testTenantId, {
        name: 'Qualified Follow-up',
        description: 'Send follow-up when lead is qualified',
        trigger: { type: 'status_changed', config: { to: 'QUALIFIED' } },
        steps: [{ type: 'send_email', config: { template: 'followup' } }],
        conditions: { source: 'website' },
      });

      expect(automation.description).toBe('Send follow-up when lead is qualified');
      expect(automation.conditions).toEqual({ source: 'website' });
    });
  });

  describe('findById', () => {
    it('should find automation by id with logs', async () => {
      const created = await automationService.create(testTenantId, {
        name: 'Find Me',
        trigger: { type: 'manual' },
        steps: [],
      });

      const found = await automationService.findById(testTenantId, created.id);
      expect(found.id).toBe(created.id);
      expect(found.logs).toBeDefined();
      expect(Array.isArray(found.logs)).toBe(true);
    });

    it('should throw 404 for non-existent automation', async () => {
      await expect(
        automationService.findById(testTenantId, 'non-existent-id')
      ).rejects.toThrow('Automation not found');
    });

    it('should enforce tenant isolation', async () => {
      const automation = await automationService.create(testTenantId, {
        name: 'Isolated',
        trigger: { type: 'manual' },
        steps: [],
      });

      const otherTenant = await prisma.tenant.create({
        data: { name: 'Other', slug: `other-${Date.now()}` },
      });

      try {
        await expect(
          automationService.findById(otherTenant.id, automation.id)
        ).rejects.toThrow('Automation not found');
      } finally {
        await prisma.tenant.delete({ where: { id: otherTenant.id } });
      }
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      await automationService.create(testTenantId, {
        name: 'Auto A',
        trigger: { type: 'manual' },
        steps: [],
      });
      await automationService.create(testTenantId, {
        name: 'Auto B',
        trigger: { type: 'lead_created' },
        steps: [{ type: 'send_email' }],
      });
      await automationService.create(testTenantId, {
        name: 'Auto C',
        trigger: { type: 'status_changed' },
        steps: [],
      });
    });

    it('should list all automations for tenant', async () => {
      const result = await automationService.findAll(testTenantId);
      expect(result.automations.length).toBe(3);
      expect(result.pagination.total).toBe(3);
    });

    it('should filter by status', async () => {
      const result = await automationService.findAll(testTenantId, { status: 'DRAFT' });
      expect(result.automations.length).toBe(3); // All start as DRAFT
    });

    it('should search by name', async () => {
      const result = await automationService.findAll(testTenantId, { search: 'Auto B' });
      expect(result.automations.length).toBe(1);
      expect(result.automations[0].name).toBe('Auto B');
    });

    it('should paginate results', async () => {
      const page1 = await automationService.findAll(testTenantId, { page: 1, limit: 2 });
      expect(page1.automations.length).toBe(2);
      expect(page1.pagination.totalPages).toBe(2);

      const page2 = await automationService.findAll(testTenantId, { page: 2, limit: 2 });
      expect(page2.automations.length).toBe(1);
    });
  });

  describe('update', () => {
    it('should update automation fields', async () => {
      const automation = await automationService.create(testTenantId, {
        name: 'Original',
        trigger: { type: 'manual' },
        steps: [],
      });

      const updated = await automationService.update(testTenantId, {
        id: automation.id,
        name: 'Updated',
        description: 'Now has description',
      });

      expect(updated.name).toBe('Updated');
      expect(updated.description).toBe('Now has description');
    });

    it('should update automation status', async () => {
      const automation = await automationService.create(testTenantId, {
        name: 'Activate Me',
        trigger: { type: 'lead_created' },
        steps: [{ type: 'send_email' }],
      });

      const activated = await automationService.update(testTenantId, {
        id: automation.id,
        status: 'ACTIVE',
      });

      expect(activated.status).toBe('ACTIVE');
    });

    it('should throw 404 for non-existent automation', async () => {
      await expect(
        automationService.update(testTenantId, { id: 'non-existent', name: 'X' })
      ).rejects.toThrow('Automation not found');
    });
  });

  describe('delete', () => {
    it('should delete an automation', async () => {
      const automation = await automationService.create(testTenantId, {
        name: 'Delete Me',
        trigger: { type: 'manual' },
        steps: [],
      });

      await automationService.delete(testTenantId, automation.id);

      await expect(
        automationService.findById(testTenantId, automation.id)
      ).rejects.toThrow('Automation not found');
    });

    it('should throw 404 for non-existent automation', async () => {
      await expect(
        automationService.delete(testTenantId, 'non-existent')
      ).rejects.toThrow('Automation not found');
    });
  });

  describe('getLogs', () => {
    it('should return logs for automation', async () => {
      const automation = await automationService.create(testTenantId, {
        name: 'With Logs',
        trigger: { type: 'manual' },
        steps: [],
      });

      await automationService.addLog(automation.id, 'SUCCESS', 'Ran successfully');
      await automationService.addLog(automation.id, 'ERROR', 'Failed', null, 'Connection timeout');

      const logs = await automationService.getLogs(testTenantId, automation.id);
      expect(logs.length).toBe(2);
      expect(logs[0].status).toBe('ERROR'); // desc order
      expect(logs[1].status).toBe('SUCCESS');
    });
  });

  describe('addLog', () => {
    it('should add a success log entry', async () => {
      const automation = await automationService.create(testTenantId, {
        name: 'Log Test',
        trigger: { type: 'manual' },
        steps: [],
      });

      const log = await automationService.addLog(
        automation.id,
        'SUCCESS',
        'Email sent',
        { recipient: 'test@test.com' }
      );

      expect(log.automationId).toBe(automation.id);
      expect(log.status).toBe('SUCCESS');
      expect(log.message).toBe('Email sent');
      expect(log.data).toEqual({ recipient: 'test@test.com' });
    });

    it('should add an error log entry', async () => {
      const automation = await automationService.create(testTenantId, {
        name: 'Error Log',
        trigger: { type: 'manual' },
        steps: [],
      });

      const log = await automationService.addLog(
        automation.id,
        'ERROR',
        'Delivery failed',
        null,
        'SMTP connection refused'
      );

      expect(log.status).toBe('ERROR');
      expect(log.error).toBe('SMTP connection refused');
    });
  });

  describe('updateStats', () => {
    it('should increment success count', async () => {
      const automation = await automationService.create(testTenantId, {
        name: 'Stats Test',
        trigger: { type: 'manual' },
        steps: [],
      });

      await automationService.updateStats(automation.id, true);
      await automationService.updateStats(automation.id, true);
      await automationService.updateStats(automation.id, false);

      const updated = await automationService.findById(testTenantId, automation.id);
      expect(updated.runsCount).toBe(3);
      expect(updated.successCount).toBe(2);
      expect(updated.errorCount).toBe(1);
      expect(updated.lastRunAt).not.toBeNull();
    });
  });
});
