import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from '../services/emailService.js';

interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  sendTo: string[];
  lastSentAt?: string;
}

function shouldRun(schedule: ReportSchedule): boolean {
  if (!schedule.lastSentAt) return true;
  const last = new Date(schedule.lastSentAt).getTime();
  const now = Date.now();
  const hour = 60 * 60 * 1000;

  switch (schedule.frequency) {
    case 'daily':   return now - last >= 24 * hour;
    case 'weekly':  return now - last >= 7 * 24 * hour;
    case 'monthly': return now - last >= 30 * 24 * hour;
  }
}

async function runScheduledReports(): Promise<void> {
  const reports = await prisma.report.findMany({
    include: { tenant: true, createdBy: true },
  });

  for (const report of reports) {
    const config = report.config as Record<string, any>;
    const schedule = config?.schedule as ReportSchedule | undefined;
    if (!schedule?.frequency || !schedule.sendTo?.length) continue;
    if (!shouldRun(schedule)) continue;

    try {
      const body = buildReportEmailBody(report.name, report.type);
      for (const email of schedule.sendTo) {
        await sendEmail({
          to: email,
          subject: `Relatório agendado: ${report.name}`,
          html: body,
        });
      }

      // Update lastSentAt inside config JSON
      await prisma.report.update({
        where: { id: report.id },
        data: {
          config: {
            ...config,
            schedule: {
              ...schedule,
              lastSentAt: new Date().toISOString(),
            },
          },
        },
      });

      logger.info('Scheduled report sent', {
        reportId: report.id,
        reportName: report.name,
        recipients: schedule.sendTo.length,
      });
    } catch (err: any) {
      logger.error('Failed to send scheduled report', {
        reportId: report.id,
        error: err.message,
      });
    }
  }
}

function buildReportEmailBody(name: string, type: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1f2937;">Relatório: ${name}</h2>
      <p style="color: #6b7280;">Seu relatório agendado está disponível na plataforma VYD Engage.</p>
      <p style="color: #6b7280;">Tipo: ${type}</p>
      <div style="margin-top: 24px;">
        <a href="${process.env.FRONTEND_URL || 'https://engage.vydhub.com'}/app/reports"
           style="background-color: #2563eb; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; display: inline-block;">
          Ver Relatório
        </a>
      </div>
    </div>
  `;
}

const CHECK_INTERVAL = 60 * 60 * 1000; // check every hour

export function initializeScheduledReports(): void {
  logger.info('Scheduled reports job initialized');

  // Run shortly after startup
  setTimeout(() => {
    runScheduledReports().catch(err =>
      logger.error('Scheduled reports error', err)
    );
  }, 10 * 1000);

  // Then every hour
  setInterval(() => {
    runScheduledReports().catch(err =>
      logger.error('Scheduled reports error', err)
    );
  }, CHECK_INTERVAL);
}
