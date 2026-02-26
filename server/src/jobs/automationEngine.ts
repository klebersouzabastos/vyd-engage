import { Queue, Worker, Job, FlowProducer } from 'bullmq';
import { logger } from '../utils/logger.js';
import prisma from '../config/database.js';
import { AutomationLogStatus, NotificationType } from '@prisma/client';
import { automationService } from '../services/automationService.js';
import { whatsappMessagingService } from '../services/whatsappMessagingService.js';
import { emailMessagingService } from '../services/emailMessagingService.js';
import { notificationService } from '../services/notificationService.js';

// Redis connection configuration
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

// ========================
// Types
// ========================

export interface AutomationJobData {
  automationId: string;
  tenantId: string;
  leadId: string;
  triggerEvent: string;
  triggerData?: Record<string, any>;
  currentStepIndex: number;
  executionId: string;
}

export interface AutomationStep {
  type: 'send_whatsapp' | 'send_email' | 'delay' | 'update_lead' | 'condition' | 'add_tag' | 'remove_tag';
  config: Record<string, any>;
}

export interface AutomationTrigger {
  type: 'lead_created' | 'status_changed' | 'tag_added' | 'manual';
  conditions?: Record<string, any>;
}

export interface AutomationSchedule {
  enabled: boolean;
  days: number[]; // 0=Sunday, 1=Monday, ...6=Saturday
  startHour: number; // 0-23
  endHour: number; // 0-23
  timezone: string;
}

// ========================
// Queue
// ========================

export const automationQueue = new Queue('automations', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, then 25s, then 125s
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

// Dead letter queue for permanently failed jobs
export const automationDLQ = new Queue('automations-dlq', {
  connection: redisConnection,
});

// ========================
// Step Executor
// ========================

async function executeStep(step: AutomationStep, jobData: AutomationJobData): Promise<{ success: boolean; message: string; data?: any }> {
  switch (step.type) {
    case 'delay': {
      // Delay is handled by scheduling the next step with a delay
      const delayMinutes = step.config.minutes || 0;
      const delayHours = step.config.hours || 0;
      const totalDelayMs = (delayMinutes * 60 + delayHours * 3600) * 1000;

      if (totalDelayMs > 0) {
        // Schedule next step with delay
        await automationQueue.add(
          'process-step',
          {
            ...jobData,
            currentStepIndex: jobData.currentStepIndex + 1,
          },
          { delay: totalDelayMs }
        );
        return { success: true, message: `Aguardando ${delayHours}h ${delayMinutes}min` };
      }
      return { success: true, message: 'Delay de 0, continuando' };
    }

    case 'update_lead': {
      const updateData: any = {};
      if (step.config.status) updateData.status = step.config.status;
      if (step.config.assignedTo) updateData.assignedTo = step.config.assignedTo;
      if (step.config.customFields) updateData.customFields = step.config.customFields;

      await prisma.lead.update({
        where: { id: jobData.leadId },
        data: updateData,
      });

      return { success: true, message: `Lead atualizado: ${JSON.stringify(updateData)}` };
    }

    case 'add_tag': {
      const { tagId } = step.config;
      if (!tagId) return { success: false, message: 'Tag ID não fornecido' };

      // Check if tag already exists on lead
      const existing = await prisma.leadTag.findFirst({
        where: { leadId: jobData.leadId, tagId },
      });
      if (!existing) {
        await prisma.leadTag.create({
          data: { leadId: jobData.leadId, tagId },
        });
      }
      return { success: true, message: `Tag ${tagId} adicionada` };
    }

    case 'remove_tag': {
      const { tagId: removeTagId } = step.config;
      if (!removeTagId) return { success: false, message: 'Tag ID não fornecido' };

      await prisma.leadTag.deleteMany({
        where: { leadId: jobData.leadId, tagId: removeTagId },
      });
      return { success: true, message: `Tag ${removeTagId} removida` };
    }

    case 'condition': {
      // Evaluate condition and decide which branch to follow
      const lead = await prisma.lead.findUnique({
        where: { id: jobData.leadId },
        include: { tags: true },
      });

      if (!lead) return { success: false, message: 'Lead não encontrado' };

      let conditionMet = false;
      const { field, operator, value } = step.config;

      const leadValue = (lead as any)[field];

      switch (operator) {
        case 'equals': conditionMet = leadValue === value; break;
        case 'not_equals': conditionMet = leadValue !== value; break;
        case 'contains': conditionMet = String(leadValue || '').includes(value); break;
        case 'greater_than': conditionMet = Number(leadValue) > Number(value); break;
        case 'less_than': conditionMet = Number(leadValue) < Number(value); break;
        case 'has_tag': conditionMet = lead.tags.some(t => t.tagId === value); break;
        default: conditionMet = false;
      }

      return {
        success: true,
        message: `Condição ${field} ${operator} ${value}: ${conditionMet ? 'VERDADEIRO' : 'FALSO'}`,
        data: { conditionMet },
      };
    }

    case 'send_whatsapp': {
      const lead = await prisma.lead.findFirst({
        where: { id: jobData.leadId, tenantId: jobData.tenantId },
      });
      if (!lead?.phone) {
        return { success: false, message: 'Lead não possui telefone' };
      }

      const result = await whatsappMessagingService.sendMessage(jobData.tenantId, {
        connectionId: step.config.connectionId,
        to: lead.phone,
        type: step.config.templateName ? 'template' : 'text',
        content: step.config.content || '',
        templateName: step.config.templateName,
        templateParams: step.config.templateParams,
        leadId: jobData.leadId,
      });

      return { success: true, message: `WhatsApp enviado: ${result.messageId}`, data: result };
    }

    case 'send_email': {
      const lead = await prisma.lead.findFirst({
        where: { id: jobData.leadId, tenantId: jobData.tenantId },
      });
      if (!lead?.email) {
        return { success: false, message: 'Lead não possui email' };
      }

      const result = await emailMessagingService.sendEmail(jobData.tenantId, {
        configId: step.config.configId,
        to: lead.email,
        subject: step.config.subject || 'Sem assunto',
        html: step.config.html || step.config.content || '',
        leadId: jobData.leadId,
      });

      return { success: true, message: `Email enviado: ${result.messageId}`, data: result };
    }

    default:
      return { success: false, message: `Step type desconhecido: ${(step as any).type}` };
  }
}

// ========================
// Schedule Check
// ========================

function isWithinSchedule(schedule?: AutomationSchedule): boolean {
  if (!schedule || !schedule.enabled) return true; // No schedule = always run

  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  if (!schedule.days.includes(currentDay)) return false;
  if (currentHour < schedule.startHour || currentHour >= schedule.endHour) return false;

  return true;
}

// ========================
// Worker
// ========================

export const automationWorker = new Worker(
  'automations',
  async (job: Job<AutomationJobData>) => {
    const { automationId, tenantId, leadId, currentStepIndex, executionId } = job.data;

    logger.info('Processing automation step', {
      automationId,
      leadId,
      stepIndex: currentStepIndex,
      executionId,
      jobId: job.id,
    });

    try {
      // Load automation
      const automation = await prisma.automation.findFirst({
        where: { id: automationId, tenantId },
      });

      if (!automation) {
        throw new Error(`Automation ${automationId} not found`);
      }

      // Check if still active
      if (automation.status !== 'ACTIVE') {
        await automationService.addLog(automationId, AutomationLogStatus.SKIPPED, 'Automação não está ativa', null, undefined, { leadId, executionId });
        return;
      }

      // Check schedule (stored in conditions.schedule)
      const conditions = automation.conditions as Record<string, any> | null;
      const schedule = conditions?.schedule as AutomationSchedule | undefined;
      if (!isWithinSchedule(schedule)) {
        // Re-schedule for 1 hour later
        await automationQueue.add('process-step', job.data, { delay: 3600000 });
        await automationService.addLog(automationId, AutomationLogStatus.SKIPPED, 'Fora do horário permitido, reagendado para 1h', null, undefined, { leadId, executionId });
        return;
      }

      // Verify lead still exists
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, tenantId },
      });

      if (!lead) {
        await automationService.addLog(automationId, AutomationLogStatus.SKIPPED, `Lead ${leadId} não encontrado`, null, undefined, { leadId, executionId });
        return;
      }

      // Get steps
      const steps = automation.steps as unknown as AutomationStep[];
      if (!steps || currentStepIndex >= steps.length) {
        // All steps completed
        await automationService.addLog(automationId, AutomationLogStatus.SUCCESS, `Execução ${executionId} completa (${steps?.length || 0} steps)`, null, undefined, { leadId, executionId });
        await automationService.updateStats(automationId, true);
        return;
      }

      const step = steps[currentStepIndex];

      // Execute step
      const result = await executeStep(step, job.data);

      // Log step result
      await automationService.addLog(
        automationId,
        result.success ? AutomationLogStatus.SUCCESS : AutomationLogStatus.ERROR,
        `Step ${currentStepIndex + 1}/${steps.length} (${step.type}): ${result.message}`,
        { stepIndex: currentStepIndex, stepType: step.type, executionId, leadId, ...result.data },
        result.success ? undefined : result.message,
        { leadId, stepOrder: currentStepIndex, stepType: step.type, executionId }
      );

      if (!result.success) {
        await automationService.updateStats(automationId, false);

        // Notify admins on first step failure (before retries)
        if (job.attemptsMade === 0) {
          const automationInfo = await prisma.automation.findFirst({ where: { id: automationId }, select: { name: true } });
          notificationService.notifyTenantAdmins(tenantId, {
            type: NotificationType.AUTOMATION_ERROR,
            title: 'Erro em automação',
            message: `"${automationInfo?.name || 'Automação'}" - Step ${currentStepIndex + 1} (${step.type}) falhou: ${result.message}`,
            link: `/app/automation-logs?automationId=${automationId}`,
            metadata: { automationId, leadId, executionId, stepIndex: currentStepIndex },
          }).catch(() => {});
        }

        throw new Error(result.message);
      }

      // Handle condition branching
      if (step.type === 'condition') {
        const conditionMet = result.data?.conditionMet;
        // If condition has trueBranch/falseBranch step indices
        const nextIndex = conditionMet
          ? (step.config.trueStepIndex ?? currentStepIndex + 1)
          : (step.config.falseStepIndex ?? currentStepIndex + 1);

        if (nextIndex < steps.length) {
          await automationQueue.add('process-step', {
            ...job.data,
            currentStepIndex: nextIndex,
          });
        } else {
          // Execution complete
          await automationService.addLog(automationId, AutomationLogStatus.SUCCESS, `Execução ${executionId} completa`, null, undefined, { leadId, executionId });
          await automationService.updateStats(automationId, true);
        }
        return;
      }

      // For delay steps, the next step is already scheduled inside executeStep
      if (step.type === 'delay') {
        return;
      }

      // Continue to next step
      if (currentStepIndex + 1 < steps.length) {
        await automationQueue.add('process-step', {
          ...job.data,
          currentStepIndex: currentStepIndex + 1,
        });
      } else {
        // All steps completed
        await automationService.addLog(automationId, AutomationLogStatus.SUCCESS, `Execução ${executionId} completa`, null, undefined, { leadId, executionId });
        await automationService.updateStats(automationId, true);
      }
    } catch (error: any) {
      logger.error('Error processing automation step', error, {
        automationId,
        leadId,
        stepIndex: currentStepIndex,
        executionId,
      });

      // If final attempt, move to DLQ and notify admins
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        await automationDLQ.add('failed-automation', {
          ...job.data,
          error: error.message,
          failedAt: new Date().toISOString(),
        });
        await automationService.addLog(
          automationId,
          AutomationLogStatus.ERROR,
          `Step ${currentStepIndex} falhou após ${job.attemptsMade + 1} tentativas: ${error.message}`,
          { executionId, leadId, attempts: job.attemptsMade + 1 },
          error.message,
          { leadId, stepOrder: currentStepIndex, executionId }
        );
        await automationService.updateStats(automationId, false);

        // Notify tenant admins about the automation failure
        const automation = await prisma.automation.findFirst({ where: { id: automationId }, select: { name: true } });
        const lead = await prisma.lead.findFirst({ where: { id: leadId }, select: { name: true } });
        notificationService.notifyTenantAdmins(tenantId, {
          type: NotificationType.AUTOMATION_ERROR,
          title: 'Automação falhou',
          message: `"${automation?.name || 'Automação'}" falhou no step ${currentStepIndex + 1}${lead?.name ? ` para o lead "${lead.name}"` : ''}: ${error.message}`,
          link: `/app/automation-logs?automationId=${automationId}`,
          metadata: { automationId, leadId, executionId, stepIndex: currentStepIndex, error: error.message },
        }).catch(() => {});
      }

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);

// ========================
// Event Listeners
// ========================

automationWorker.on('completed', (job) => {
  logger.info('Automation job completed', { jobId: job.id });
});

automationWorker.on('failed', (job, err) => {
  logger.error('Automation job failed', err, { jobId: job?.id, attempts: job?.attemptsMade });
});

// ========================
// Trigger Dispatcher
// ========================

/**
 * Dispatch automation trigger event.
 * Finds all active automations matching the trigger type and conditions,
 * then queues them for execution.
 */
export async function dispatchTrigger(
  tenantId: string,
  triggerType: string,
  leadId: string,
  triggerData?: Record<string, any>
): Promise<number> {
  try {
    // Find all active automations for this tenant
    const automations = await prisma.automation.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
    });

    let dispatched = 0;

    for (const automation of automations) {
      const trigger = automation.trigger as unknown as AutomationTrigger;
      if (!trigger || trigger.type !== triggerType) continue;

      // Check trigger conditions
      if (trigger.conditions) {
        let conditionsMet = true;

        // Check specific conditions
        if (trigger.conditions.status && triggerData?.newStatus !== trigger.conditions.status) {
          conditionsMet = false;
        }
        if (trigger.conditions.tagId && triggerData?.tagId !== trigger.conditions.tagId) {
          conditionsMet = false;
        }
        if (trigger.conditions.source && triggerData?.source !== trigger.conditions.source) {
          conditionsMet = false;
        }

        if (!conditionsMet) continue;
      }

      const executionId = `exec_${automation.id}_${Date.now()}`;

      // Queue the first step
      await automationQueue.add('process-step', {
        automationId: automation.id,
        tenantId,
        leadId,
        triggerEvent: triggerType,
        triggerData,
        currentStepIndex: 0,
        executionId,
      });

      await automationService.addLog(
        automation.id,
        AutomationLogStatus.SUCCESS,
        `Trigger ${triggerType} disparado para lead ${leadId}`,
        { executionId, leadId, triggerData },
        undefined,
        { leadId, executionId }
      );

      dispatched++;
    }

    if (dispatched > 0) {
      logger.info('Automation triggers dispatched', { tenantId, triggerType, leadId, dispatched });
    }

    return dispatched;
  } catch (error: any) {
    logger.error('Error dispatching automation trigger', error, { tenantId, triggerType, leadId });
    return 0;
  }
}

// ========================
// Initialization
// ========================

export async function initializeAutomationEngine(): Promise<void> {
  logger.info('Automation engine initialized');
  // Worker is already running by importing this file
  // Future: Could load pending delayed jobs or check for stuck jobs
}
