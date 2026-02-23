import prisma from '../config/database.js';
import nodemailer from 'nodemailer';
import { InteractionType, InteractionDirection, ScoreEvent } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { scoringService } from './scoringService.js';

// ========================
// Types
// ========================

export interface SendEmailData {
  configId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  leadId?: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
}

export interface BulkSendEmailData {
  configId: string;
  recipients: Array<{
    email: string;
    leadId?: string;
    variables?: Record<string, string>;
  }>;
  subject: string;
  html: string;
  text?: string;
}

// ========================
// Transport Factory
// ========================

function createTransport(provider: string, config: any): nodemailer.Transporter {
  switch (provider) {
    case 'SMTP':
      return nodemailer.createTransport({
        host: config.host,
        port: config.port || 587,
        secure: config.secure || false,
        auth: {
          user: config.user,
          pass: config.password,
        },
      });

    case 'SENDGRID':
      return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: config.apiKey,
        },
      });

    case 'MAILGUN':
      return nodemailer.createTransport({
        host: `smtp.mailgun.org`,
        port: 587,
        auth: {
          user: config.user || `postmaster@${config.domain}`,
          pass: config.apiKey,
        },
      });

    case 'SES':
      return nodemailer.createTransport({
        host: `email-smtp.${config.region || 'us-east-1'}.amazonaws.com`,
        port: 587,
        auth: {
          user: config.accessKeyId,
          pass: config.secretAccessKey,
        },
      });

    case 'RESEND':
      return nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: {
          user: 'resend',
          pass: config.apiKey,
        },
      });

    default:
      throw createError(`Unsupported email provider: ${provider}`, 400, 'INVALID_PROVIDER');
  }
}

// ========================
// Service
// ========================

export const emailMessagingService = {
  /**
   * Send a single email via tenant's configured provider
   */
  async sendEmail(tenantId: string, data: SendEmailData) {
    const emailConfig = await prisma.emailConfig.findFirst({
      where: { id: data.configId, tenantId, verified: true },
    });

    if (!emailConfig) {
      throw createError('Email config not found or not verified', 400, 'EMAIL_CONFIG_INVALID');
    }

    const config = emailConfig.config as any;
    const transport = createTransport(emailConfig.provider, config);

    const fromAddress = emailConfig.fromName
      ? `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`
      : emailConfig.fromEmail;

    try {
      // Create interaction record first (needed for tracking)
      let interactionId: string | null = null;
      let trackedHtml = data.html;

      if (data.leadId) {
        const interaction = await prisma.interaction.create({
          data: {
            tenantId,
            leadId: data.leadId,
            type: InteractionType.EMAIL,
            direction: InteractionDirection.OUTBOUND,
            subject: data.subject,
            content: data.html,
            metadata: {
              configId: data.configId,
              to: data.to,
              provider: emailConfig.provider,
            },
          },
        });
        interactionId = interaction.id;

        // Inject email tracking (pixel + link rewriting)
        try {
          const { emailTrackingService } = await import('./emailTrackingService.js');
          const trackingToken = await emailTrackingService.createTracking(interaction.id);
          const baseUrl = process.env.API_URL || process.env.FRONTEND_URL?.replace(':5173', ':3001') || 'http://localhost:3001';
          trackedHtml = emailTrackingService.applyTracking(data.html, trackingToken, baseUrl);
        } catch (trackErr: any) {
          logger.warn('Email tracking injection failed, sending without tracking', { error: trackErr.message });
        }
      }

      const info = await transport.sendMail({
        from: fromAddress,
        to: data.to,
        subject: data.subject,
        html: trackedHtml,
        text: data.text || data.html.replace(/<[^>]*>/g, ''),
      });

      // Update stats
      await prisma.emailConfig.update({
        where: { id: data.configId },
        data: { emailsSent: { increment: 1 } },
      });

      // Update interaction with messageId
      if (interactionId) {
        const existing = await prisma.interaction.findUnique({
          where: { id: interactionId },
          select: { metadata: true },
        });
        await prisma.interaction.update({
          where: { id: interactionId },
          data: {
            metadata: {
              ...((existing?.metadata as Record<string, any>) || {}),
              messageId: info.messageId,
            },
          },
        });
      }

      logger.info('Email sent', {
        tenantId,
        configId: data.configId,
        to: data.to,
        messageId: info.messageId,
        tracked: !!interactionId,
      });

      return {
        messageId: info.messageId,
        status: 'sent',
        to: data.to,
      };
    } catch (error: any) {
      logger.error('Failed to send email', { error: error.message, to: data.to });
      throw createError(`Failed to send email: ${error.message}`, 502, 'EMAIL_SEND_FAILED');
    }
  },

  /**
   * Send bulk emails (e.g., campaigns)
   */
  async sendBulk(tenantId: string, data: BulkSendEmailData) {
    const emailConfig = await prisma.emailConfig.findFirst({
      where: { id: data.configId, tenantId, verified: true },
    });

    if (!emailConfig) {
      throw createError('Email config not found or not verified', 400, 'EMAIL_CONFIG_INVALID');
    }

    const config = emailConfig.config as any;
    const transport = createTransport(emailConfig.provider, config);

    const fromAddress = emailConfig.fromName
      ? `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`
      : emailConfig.fromEmail;

    const results: Array<{ email: string; status: string; messageId?: string; error?: string }> = [];

    for (const recipient of data.recipients) {
      try {
        // Replace variables in template
        let html = data.html;
        let subject = data.subject;
        if (recipient.variables) {
          for (const [key, value] of Object.entries(recipient.variables)) {
            html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
            subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
          }
        }

        const info = await transport.sendMail({
          from: fromAddress,
          to: recipient.email,
          subject,
          html,
          text: html.replace(/<[^>]*>/g, ''),
        });

        results.push({ email: recipient.email, status: 'sent', messageId: info.messageId });

        // Create interaction
        if (recipient.leadId) {
          await prisma.interaction.create({
            data: {
              tenantId,
              leadId: recipient.leadId,
              type: InteractionType.EMAIL,
              direction: InteractionDirection.OUTBOUND,
              subject,
              content: html,
              metadata: {
                messageId: info.messageId,
                configId: data.configId,
                to: recipient.email,
                provider: emailConfig.provider,
                bulk: true,
              },
            },
          });
        }
      } catch (error: any) {
        results.push({ email: recipient.email, status: 'failed', error: error.message });
      }
    }

    // Update total sent count
    const sentCount = results.filter(r => r.status === 'sent').length;
    if (sentCount > 0) {
      await prisma.emailConfig.update({
        where: { id: data.configId },
        data: { emailsSent: { increment: sentCount } },
      });
    }

    logger.info('Bulk email completed', {
      tenantId,
      total: data.recipients.length,
      sent: sentCount,
      failed: data.recipients.length - sentCount,
    });

    return {
      total: data.recipients.length,
      sent: sentCount,
      failed: data.recipients.length - sentCount,
      results,
    };
  },

  /**
   * Send a test email to verify configuration
   */
  async sendTestEmail(tenantId: string, configId: string, toEmail: string) {
    const emailConfig = await prisma.emailConfig.findFirst({
      where: { id: configId, tenantId },
    });

    if (!emailConfig) {
      throw createError('Email config not found', 404);
    }

    const config = emailConfig.config as any;
    const transport = createTransport(emailConfig.provider, config);

    const fromAddress = emailConfig.fromName
      ? `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`
      : emailConfig.fromEmail;

    try {
      const info = await transport.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: 'VYD Engage - Email de Teste',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Email de Teste</h2>
            <p>Este é um email de teste do VYD Engage.</p>
            <p>Se você está recebendo este email, sua configuração está funcionando corretamente!</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">
              Provedor: ${emailConfig.provider}<br/>
              Remetente: ${emailConfig.fromEmail}<br/>
              Configuração: ${emailConfig.name}
            </p>
          </div>
        `,
      });

      // Mark as verified
      await prisma.emailConfig.update({
        where: { id: configId },
        data: { verified: true, verifiedAt: new Date() },
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      logger.error('Test email failed', { error: error.message, configId });
      throw createError(`Test email failed: ${error.message}`, 502, 'EMAIL_TEST_FAILED');
    }
  },

  /**
   * Process email webhook (tracking opens, clicks, bounces)
   */
  async processWebhook(provider: string, payload: any) {
    try {
      switch (provider) {
        case 'sendgrid':
          return this.processSendGridWebhook(payload);
        case 'resend':
          return this.processResendWebhook(payload);
        default:
          logger.warn('Unknown email webhook provider', { provider });
      }
    } catch (error: any) {
      logger.error('Error processing email webhook', error);
    }
  },

  async processSendGridWebhook(events: any[]) {
    if (!Array.isArray(events)) return;

    for (const event of events) {
      const messageId = event.sg_message_id?.split('.')[0];
      if (!messageId) continue;

      await this.updateInteractionStatus(messageId, event.event);
    }
  },

  async processResendWebhook(payload: any) {
    const type = payload.type;
    const messageId = payload.data?.email_id;
    if (!messageId) return;

    const eventMap: Record<string, string> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.opened': 'opened',
      'email.clicked': 'clicked',
      'email.bounced': 'bounced',
      'email.complained': 'complained',
    };

    const status = eventMap[type];
    if (status) {
      await this.updateInteractionStatus(messageId, status);
    }
  },

  async updateInteractionStatus(messageId: string, status: string) {
    const interactions = await prisma.interaction.findMany({
      where: {
        type: InteractionType.EMAIL,
        direction: InteractionDirection.OUTBOUND,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const interaction = interactions.find(i => {
      const meta = i.metadata as any;
      return meta?.messageId?.includes(messageId);
    });

    if (interaction) {
      const existingMeta = (interaction.metadata || {}) as any;
      await prisma.interaction.update({
        where: { id: interaction.id },
        data: {
          metadata: {
            ...existingMeta,
            emailStatus: status,
            emailStatusUpdatedAt: new Date().toISOString(),
          },
        },
      });

      // Score email events
      if (interaction.leadId) {
        if (status === 'opened') {
          scoringService.processEvent(interaction.tenantId, interaction.leadId, ScoreEvent.EMAIL_OPENED).catch(() => {});
        } else if (status === 'clicked') {
          scoringService.processEvent(interaction.tenantId, interaction.leadId, ScoreEvent.EMAIL_CLICKED).catch(() => {});
        }
      }
    }
  },
};
