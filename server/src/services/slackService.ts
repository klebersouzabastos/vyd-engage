import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';

interface TenantSettings {
  slackWebhookUrl?: string;
  teamsWebhookUrl?: string;
  [key: string]: unknown;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{ type: string; text: string }>;
}

async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  return (tenant?.settings as TenantSettings) ?? {};
}

async function postSlack(webhookUrl: string, blocks: SlackBlock[]): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
  if (!response.ok) {
    throw new Error(`Slack returned ${response.status}`);
  }
}

async function postTeams(
  webhookUrl: string,
  title: string,
  text: string,
  facts: Array<{ name: string; value: string }>
): Promise<void> {
  const body = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: '2563eb',
    summary: title,
    sections: [
      {
        activityTitle: title,
        activityText: text,
        facts,
      },
    ],
  };
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Teams returned ${response.status}`);
  }
}

export async function notifyDealWon(tenantId: string, deal: Record<string, any>): Promise<void> {
  try {
    const settings = await getTenantSettings(tenantId);
    const value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      Number(deal.value ?? 0)
    );

    if (settings.slackWebhookUrl) {
      await postSlack(settings.slackWebhookUrl, [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `🎉 *Deal ganho!* — ${deal.name}` },
          fields: [
            { type: 'mrkdwn', text: `*Valor:*\n${value}` },
            { type: 'mrkdwn', text: `*Cliente:*\n${deal.lead?.name ?? deal.company?.name ?? '—'}` },
          ],
        },
      ]);
    }

    if (settings.teamsWebhookUrl) {
      await postTeams(
        settings.teamsWebhookUrl,
        '🎉 Deal ganho!',
        `O deal "${deal.name}" foi marcado como ganho.`,
        [
          { name: 'Valor', value },
          { name: 'Cliente', value: deal.lead?.name ?? deal.company?.name ?? '—' },
        ]
      );
    }
  } catch (err: any) {
    logger.warn('notifyDealWon failed', { tenantId, error: err.message });
  }
}

export async function notifyDealLost(tenantId: string, deal: Record<string, any>): Promise<void> {
  try {
    const settings = await getTenantSettings(tenantId);

    if (settings.slackWebhookUrl) {
      await postSlack(settings.slackWebhookUrl, [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `❌ *Deal perdido* — ${deal.name}` },
          fields: deal.lostReason
            ? [{ type: 'mrkdwn', text: `*Motivo:*\n${deal.lostReason}` }]
            : [],
        },
      ]);
    }

    if (settings.teamsWebhookUrl) {
      await postTeams(
        settings.teamsWebhookUrl,
        '❌ Deal perdido',
        `O deal "${deal.name}" foi marcado como perdido.`,
        deal.lostReason ? [{ name: 'Motivo', value: deal.lostReason }] : []
      );
    }
  } catch (err: any) {
    logger.warn('notifyDealLost failed', { tenantId, error: err.message });
  }
}

export async function notifyLeadCaptured(
  tenantId: string,
  lead: Record<string, any>
): Promise<void> {
  try {
    const settings = await getTenantSettings(tenantId);

    if (settings.slackWebhookUrl) {
      await postSlack(settings.slackWebhookUrl, [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `🆕 *Novo lead via formulário* — ${lead.name}` },
          fields: [
            { type: 'mrkdwn', text: `*Email:*\n${lead.email ?? '—'}` },
            { type: 'mrkdwn', text: `*Empresa:*\n${lead.company ?? '—'}` },
          ],
        },
      ]);
    }

    if (settings.teamsWebhookUrl) {
      await postTeams(
        settings.teamsWebhookUrl,
        '🆕 Novo lead capturado',
        `"${lead.name}" preencheu o formulário público.`,
        [
          { name: 'Email', value: lead.email ?? '—' },
          { name: 'Empresa', value: lead.company ?? '—' },
        ]
      );
    }
  } catch (err: any) {
    logger.warn('notifyLeadCaptured failed', { tenantId, error: err.message });
  }
}

export async function notifyTaskOverdue(
  tenantId: string,
  task: Record<string, any>
): Promise<void> {
  try {
    const settings = await getTenantSettings(tenantId);

    if (settings.slackWebhookUrl) {
      await postSlack(settings.slackWebhookUrl, [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `⏰ *Tarefa atrasada* — ${task.title}` },
          fields: task.assignedUser?.name
            ? [{ type: 'mrkdwn', text: `*Responsável:*\n${task.assignedUser.name}` }]
            : [],
        },
      ]);
    }

    if (settings.teamsWebhookUrl) {
      await postTeams(
        settings.teamsWebhookUrl,
        '⏰ Tarefa atrasada',
        `A tarefa "${task.title}" está atrasada.`,
        task.assignedUser?.name ? [{ name: 'Responsável', value: task.assignedUser.name }] : []
      );
    }
  } catch (err: any) {
    logger.warn('notifyTaskOverdue failed', { tenantId, error: err.message });
  }
}
