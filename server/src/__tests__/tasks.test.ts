import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskService } from '../services/taskService.js';
import prisma from '../config/database.js';

describe('Task Service', () => {
  let testTenantId: string;
  let testUserId: string;

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Task Test Company',
        slug: `task-test-${Date.now()}`,
      },
    });
    testTenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `taskuser-${Date.now()}@test.com`,
        passwordHash: 'hashed',
        name: 'Task User',
        role: 'USER',
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    await prisma.task.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.delete({ where: { id: testTenantId } });
  });

  describe('create', () => {
    it('should create a task with required fields', async () => {
      const task = await taskService.create(testTenantId, {
        title: 'Test Task',
      });

      expect(task).toHaveProperty('id');
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('PENDING');
      expect(task.priority).toBe('MEDIUM');
      expect(task.tenantId).toBe(testTenantId);
    });

    it('should create a task with all fields', async () => {
      const dueDate = new Date('2026-03-01');
      const task = await taskService.create(testTenantId, {
        title: 'Full Task',
        description: 'Detailed description',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        assignedTo: testUserId,
        dueDate,
      });

      expect(task.title).toBe('Full Task');
      expect(task.description).toBe('Detailed description');
      expect(task.status).toBe('IN_PROGRESS');
      expect(task.priority).toBe('HIGH');
      expect(task.assignedTo).toBe(testUserId);
    });
  });

  describe('findById', () => {
    it('should find a task by id', async () => {
      const created = await taskService.create(testTenantId, {
        title: 'Find Me',
      });

      const found = await taskService.findById(testTenantId, created.id);
      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Find Me');
    });

    it('should throw 404 for non-existent task', async () => {
      await expect(taskService.findById(testTenantId, 'non-existent-id')).rejects.toThrow(
        'Task not found'
      );
    });

    it('should enforce tenant isolation', async () => {
      const task = await taskService.create(testTenantId, {
        title: 'Isolated Task',
      });

      const otherTenant = await prisma.tenant.create({
        data: { name: 'Other', slug: `other-${Date.now()}` },
      });

      try {
        await expect(taskService.findById(otherTenant.id, task.id)).rejects.toThrow(
          'Task not found'
        );
      } finally {
        await prisma.tenant.delete({ where: { id: otherTenant.id } });
      }
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      await taskService.create(testTenantId, {
        title: 'Task A',
        status: 'PENDING',
        priority: 'HIGH',
      });
      await taskService.create(testTenantId, {
        title: 'Task B',
        status: 'COMPLETED',
        priority: 'LOW',
      });
      await taskService.create(testTenantId, {
        title: 'Task C',
        status: 'PENDING',
        priority: 'MEDIUM',
      });
    });

    it('should list all tasks for tenant', async () => {
      const result = await taskService.findAll(testTenantId);
      expect(result.tasks.length).toBe(3);
      expect(result.pagination.total).toBe(3);
    });

    it('should filter by status', async () => {
      const result = await taskService.findAll(testTenantId, { status: 'PENDING' });
      expect(result.tasks.length).toBe(2);
      result.tasks.forEach((t) => expect(t.status).toBe('PENDING'));
    });

    it('should filter by priority', async () => {
      const result = await taskService.findAll(testTenantId, { priority: 'HIGH' });
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].title).toBe('Task A');
    });

    it('should paginate results', async () => {
      const page1 = await taskService.findAll(testTenantId, { page: 1, limit: 2 });
      expect(page1.tasks.length).toBe(2);
      expect(page1.pagination.totalPages).toBe(2);

      const page2 = await taskService.findAll(testTenantId, { page: 2, limit: 2 });
      expect(page2.tasks.length).toBe(1);
    });
  });

  describe('update', () => {
    it('should update task fields', async () => {
      const task = await taskService.create(testTenantId, { title: 'Original' });

      const updated = await taskService.update(testTenantId, {
        id: task.id,
        title: 'Updated',
        priority: 'URGENT',
      });

      expect(updated.title).toBe('Updated');
      expect(updated.priority).toBe('URGENT');
    });

    it('should set completedAt when marking as COMPLETED', async () => {
      const task = await taskService.create(testTenantId, { title: 'Complete Me' });

      const updated = await taskService.update(testTenantId, {
        id: task.id,
        status: 'COMPLETED',
      });

      expect(updated.status).toBe('COMPLETED');
      expect(updated.completedAt).not.toBeNull();
    });

    it('should clear completedAt when changing status from COMPLETED', async () => {
      const task = await taskService.create(testTenantId, { title: 'Reopen Me' });
      await taskService.update(testTenantId, { id: task.id, status: 'COMPLETED' });

      const reopened = await taskService.update(testTenantId, {
        id: task.id,
        status: 'IN_PROGRESS',
      });

      expect(reopened.status).toBe('IN_PROGRESS');
      expect(reopened.completedAt).toBeNull();
    });

    it('should throw 404 for non-existent task', async () => {
      await expect(
        taskService.update(testTenantId, { id: 'non-existent', title: 'X' })
      ).rejects.toThrow('Task not found');
    });
  });

  describe('delete', () => {
    it('should delete a task', async () => {
      const task = await taskService.create(testTenantId, { title: 'Delete Me' });
      await taskService.delete(testTenantId, task.id);

      await expect(taskService.findById(testTenantId, task.id)).rejects.toThrow('Task not found');
    });

    it('should throw 404 for non-existent task', async () => {
      await expect(taskService.delete(testTenantId, 'non-existent')).rejects.toThrow(
        'Task not found'
      );
    });
  });

  describe('count', () => {
    it('should count tasks for tenant', async () => {
      await taskService.create(testTenantId, { title: 'Task 1' });
      await taskService.create(testTenantId, { title: 'Task 2' });

      const count = await taskService.count(testTenantId);
      expect(count).toBe(2);
    });

    it('should return 0 when no tasks', async () => {
      const count = await taskService.count(testTenantId);
      expect(count).toBe(0);
    });
  });
});
