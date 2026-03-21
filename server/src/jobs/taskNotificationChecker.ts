import prisma from '../config/database.js';
import { TaskStatus, NotificationType } from '@prisma/client';
import { notificationService } from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

/**
 * Backend task notification checker.
 * Periodically scans all tenants for overdue and due-today tasks,
 * then creates TASK_DUE / TASK_OVERDUE notifications with daily deduplication.
 *
 * Replaces the frontend-only TaskNotificationChecker that created ephemeral
 * (in-memory) notifications lost on page refresh.
 */

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function checkTaskNotifications() {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Get all overdue tasks (dueDate < now, not completed/cancelled)
    const overdueTasks = await prisma.task.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        assignedTo: { not: null },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assignedTo: true,
        tenantId: true,
      },
    });

    // Get tasks due today (dueDate between todayStart and todayEnd, not completed/cancelled)
    const dueTodayTasks = await prisma.task.findMany({
      where: {
        dueDate: { gte: todayStart, lt: todayEnd },
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        assignedTo: { not: null },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assignedTo: true,
        tenantId: true,
      },
    });

    // Deduplication: find notifications already sent today for these task IDs
    const allTaskIds = [
      ...overdueTasks.map((t) => t.id),
      ...dueTodayTasks.map((t) => t.id),
    ];

    if (allTaskIds.length === 0) return;

    // Get today's existing task notifications to avoid duplicates
    const existingNotifications = await prisma.notification.findMany({
      where: {
        type: { in: [NotificationType.TASK_DUE, NotificationType.TASK_OVERDUE] },
        createdAt: { gte: todayStart },
      },
      select: {
        type: true,
        metadata: true,
      },
    });

    // Build a set of "type:taskId" for fast lookup
    const alreadyNotified = new Set<string>();
    for (const notif of existingNotifications) {
      const meta = notif.metadata as Record<string, any> | null;
      if (meta?.taskId) {
        alreadyNotified.add(`${notif.type}:${meta.taskId}`);
      }
    }

    let created = 0;

    // TASK_OVERDUE notifications
    for (const task of overdueTasks) {
      const key = `${NotificationType.TASK_OVERDUE}:${task.id}`;
      if (alreadyNotified.has(key)) continue;

      await notificationService.create(task.tenantId, {
        userId: task.assignedTo!,
        type: NotificationType.TASK_OVERDUE,
        title: 'Tarefa vencida',
        message: `A tarefa "${task.title}" está vencida desde ${new Date(task.dueDate!).toLocaleDateString('pt-BR')}.`,
        link: '/app/tasks',
        metadata: { taskId: task.id, taskTitle: task.title, dueDate: task.dueDate },
      }).catch((err) => {
        logger.error(`Failed to create TASK_OVERDUE notification for task ${task.id}`, err);
      });
      created++;
    }

    // TASK_DUE notifications
    for (const task of dueTodayTasks) {
      const key = `${NotificationType.TASK_DUE}:${task.id}`;
      if (alreadyNotified.has(key)) continue;

      await notificationService.create(task.tenantId, {
        userId: task.assignedTo!,
        type: NotificationType.TASK_DUE,
        title: 'Tarefa vence hoje',
        message: `A tarefa "${task.title}" vence hoje.`,
        link: '/app/tasks',
        metadata: { taskId: task.id, taskTitle: task.title, dueDate: task.dueDate },
      }).catch((err) => {
        logger.error(`Failed to create TASK_DUE notification for task ${task.id}`, err);
      });
      created++;
    }

    if (created > 0) {
      logger.info(`Task notification checker: created ${created} notifications (${overdueTasks.length} overdue, ${dueTodayTasks.length} due today)`);
    }
  } catch (error) {
    logger.error('Task notification checker failed', error);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function initializeTaskNotificationChecker() {
  // Run immediately on startup
  checkTaskNotifications();

  // Then run every 30 minutes
  intervalId = setInterval(checkTaskNotifications, CHECK_INTERVAL_MS);

  logger.info('Task notification checker initialized (interval: 30min)');
}

export function stopTaskNotificationChecker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
