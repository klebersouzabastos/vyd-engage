import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from '../services/emailService.js';

interface ReportSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;    // 0-6 (0 = Sunday)
  dayOfMonth?: number;   // 1-28
  time: string;          // "HH:MM"
  recipients: string[];
  format: 'pdf' | 'excel' | 'both';
  lastSentAt?: string;
}

const HOUR_MS = 3_600_000;

function shouldSendNow(schedule: ReportSchedule): boolean {
  if (!schedule.enabled || !schedule.recipients?.length) return false;

  const now = new Date();
  const [targetHour] = (schedule.time ?? '09:00').split(':').map(Number);

  // Only act during the target hour
  if (now.getHours() !== targetHour) return false;

  // Dedup: skip if already sent recently for this frequency
  if (schedule.lastSentAt) {
    const msSinceLast = now.getTime() - new Date(schedule.lastSentAt).getTime();
    if (schedule.frequency === 'daily'   && msSinceLast < 23 * HOUR_MS)        return false;
    if (schedule.frequency === 'weekly'  && msSinceLast < 6.9 * 24 * HOUR_MS)  return false;
    if (schedule.frequency === 'monthly' && msSinceLast < 27 * 24 * HOUR_MS)   return false;
  }

  // Check day constraint
  if (schedule.frequency === 'weekly'  && now.getDay()  !== (schedule.dayOfWeek  ?? 1)) return false;
  if (schedule.frequency === 'monthly' && now.getDate() !== (schedule.dayOfMonth ?? 1)) return false;

  return true;
}

const FREQ_LABEL: Record<string, string> = {
  daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal',
};
const FORMAT_LABEL: Record<string, string> = {
  pdf: 'PDF', excel: 'Excel', both: 'PDF e Excel',
};

function buildEmailBody(name: string, type: string, schedule: ReportSchedule): string {
  const frontendUrl = process.env.FRONTEND_URL ?? 'https://engage.vydhub.com';
  const freqLabel   = FREQ_LABEL[schedule.frequency]  ?? schedule.frequency;
  const fmtLabel    = FORMAT_LABEL[schedule.format ?? 'pdf'] ?? schedule.format;

  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937;">
  <div style="background:#2563eb;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:white;margin:0;font-size:20px;">Relatório Agendado</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p style="margin-top:0;">Seu relatório <strong>${name}</strong> está disponível na plataforma.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Tipo</td>
        <td style="padding:8px 0;font-weight:500;">${type}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Frequência</td>
        <td style="padding:8px 0;font-weight:500;">${freqLabel}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Formato</td>
        <td style="padding:8px 0;font-weight:500;">${fmtLabel}</td>
      </tr>
    </table>
    <div style="margin-top:24px;text-align:center;">
      <a href="${frontendUrl}/app/reports"
         style="background:#2563eb;color:white;padding:12px 32px;text-decoration:none;
                border-radius:6px;display:inline-block;font-weight:500;">
        Ver Relatório
      </a>
    </div>
    <p style="margin-top:24px;font-size:12px;color:#9ca3af;text-align:center;">
      Você recebe este email por estar cadastrado nos relatórios agendados do VYD Engage.
    </p>
  </div>
</div>`.trim();
}

async function runScheduledReports(): Promise<void> {
  const reports = await prisma.report.findMany({
    select: { id: true, name: true, type: true, config: true, tenantId: true },
  });

  let sent = 0;

  for (const report of reports) {
    const config   = report.config as Record<string, unknown>;
    const schedule = config?.schedule as ReportSchedule | undefined;

    if (!schedule || !shouldSendNow(schedule)) continue;

    const subject = `[${FREQ_LABEL[schedule.frequency] ?? schedule.frequency}] Relatório: ${report.name}`;

    try {
      await sendEmail({
        to: schedule.recipients,
        subject,
        html: buildEmailBody(report.name, report.type, schedule),
      });

      await prisma.report.update({
        where: { id: report.id },
        data: {
          config: { ...config, schedule: { ...schedule, lastSentAt: new Date().toISOString() } },
        },
      });

      sent++;
      logger.info('Scheduled report sent', {
        reportId: report.id,
        name: report.name,
        tenantId: report.tenantId,
        recipients: schedule.recipients.length,
        frequency: schedule.frequency,
      });
    } catch (err: unknown) {
      logger.error('Failed to send scheduled report', {
        reportId: report.id,
        name: report.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (sent > 0) {
    logger.info('Scheduled reports run complete', { sent });
  }
}

const CHECK_INTERVAL = 60 * 60 * 1000; // hourly

export function initializeScheduledReports(): void {
  logger.info('Scheduled reports job initialized (interval: 1h)');

  // First run 30s after startup (let the server settle)
  setTimeout(() => {
    runScheduledReports().catch(err =>
      logger.error('Scheduled reports error on startup', err)
    );
  }, 30_000);

  setInterval(() => {
    runScheduledReports().catch(err =>
      logger.error('Scheduled reports error', err)
    );
  }, CHECK_INTERVAL);
}
