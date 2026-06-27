import prisma from '../config/database.js';
import { InteractionType, InteractionDirection, ScoreEvent } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { scoringService } from './scoringService.js';
import { safeDecryptConfig } from '../utils/encryption.js';

// ========================
// Types
// ========================

export interface SendMessageData {
  connectionId: string;
  to: string; // Phone number (with country code)
  type: 'text' | 'template' | 'image' | 'document' | 'audio';
  content: string;
  templateName?: string;
  templateParams?: string[];
  mediaUrl?: string;
  leadId?: string;
}

export interface MessageStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  error?: string;
}

export interface WhatsAppTemplate {
  id: string;
  tenantId: string;
  name: string;
  language: string;
  category: string;
  body: string;
  variables: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  metaTemplateId?: string;
  createdAt: string;
}

// ========================
// Meta Business API Client
// ========================

// Graph API version is configurable (versions get deprecated) — bump via env
// WHATSAPP_GRAPH_VERSION (ex.: "v21.0") sem mexer no código.
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';

async function callMetaAPI(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE',
  accessToken: string,
  body?: any
): Promise<any> {
  const baseUrl = `https://graph.facebook.com/${GRAPH_VERSION}`;
  const url = `${baseUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data: any = await response.json();

    if (!response.ok) {
      logger.error('Meta API error', { status: response.status, data });
      throw createError(
        data.error?.message || 'Meta API request failed',
        response.status,
        'META_API_ERROR',
        data.error
      );
    }

    return data;
  } catch (error: any) {
    if (error.statusCode) throw error; // Re-throw createError
    logger.error('Meta API network error', error);
    throw createError('Failed to connect to Meta API', 502, 'META_API_NETWORK_ERROR');
  }
}

// ========================
// Service
// ========================

export const whatsappMessagingService = {
  /**
   * Send a text message via WhatsApp Business API
   */
  async sendMessage(tenantId: string, data: SendMessageData) {
    // Get connection config
    const connection = await prisma.whatsAppConnection.findFirst({
      where: { id: data.connectionId, tenantId, status: 'CONNECTED' },
    });

    if (!connection) {
      throw createError(
        'WhatsApp connection not found or not connected',
        400,
        'WHATSAPP_NOT_CONNECTED'
      );
    }

    const config = safeDecryptConfig(connection.config) as any;
    const phoneNumberId = config.phoneNumberId;
    const accessToken = config.accessToken;

    if (!phoneNumberId || !accessToken) {
      throw createError(
        'WhatsApp connection missing phoneNumberId or accessToken',
        400,
        'WHATSAPP_CONFIG_INVALID'
      );
    }

    // Build message payload
    const messagePayload: any = {
      messaging_product: 'whatsapp',
      to: data.to,
    };

    switch (data.type) {
      case 'text':
        messagePayload.type = 'text';
        messagePayload.text = { body: data.content };
        break;

      case 'template':
        messagePayload.type = 'template';
        messagePayload.template = {
          name: data.templateName,
          language: { code: 'pt_BR' },
          components: data.templateParams
            ? [
                {
                  type: 'body',
                  parameters: data.templateParams.map((p) => ({ type: 'text', text: p })),
                },
              ]
            : undefined,
        };
        break;

      case 'image':
        messagePayload.type = 'image';
        messagePayload.image = {
          link: data.mediaUrl,
          caption: data.content || undefined,
        };
        break;

      case 'document':
        messagePayload.type = 'document';
        messagePayload.document = {
          link: data.mediaUrl,
          caption: data.content || undefined,
        };
        break;

      case 'audio':
        messagePayload.type = 'audio';
        messagePayload.audio = { link: data.mediaUrl };
        break;
    }

    // Send via Meta API
    const result = await callMetaAPI(
      `/${phoneNumberId}/messages`,
      'POST',
      accessToken,
      messagePayload
    );

    const messageId = result.messages?.[0]?.id;

    // Update connection stats
    await prisma.whatsAppConnection.update({
      where: { id: data.connectionId },
      data: { messagesSent: { increment: 1 } },
    });

    // Create interaction record
    if (data.leadId) {
      await prisma.interaction.create({
        data: {
          tenantId,
          leadId: data.leadId,
          type: InteractionType.WHATSAPP,
          direction: InteractionDirection.OUTBOUND,
          subject: data.type === 'template' ? `Template: ${data.templateName}` : undefined,
          content: data.content,
          metadata: {
            messageId,
            connectionId: data.connectionId,
            to: data.to,
            type: data.type,
          },
        },
      });
    }

    return {
      messageId,
      status: 'sent',
      to: data.to,
    };
  },

  /**
   * Process incoming webhook from Meta
   */
  async processWebhook(payload: any) {
    try {
      const entries = payload.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];

        for (const change of changes) {
          if (change.field !== 'messages') continue;

          const value = change.value;
          const metadata = value.metadata;
          const phoneNumberId = metadata?.phone_number_id;

          // Find connection by phone number ID
          const connections = await prisma.whatsAppConnection.findMany({
            where: { status: 'CONNECTED' },
          });

          const connection = connections.find((c) => {
            const config = safeDecryptConfig(c.config) as any;
            return config.phoneNumberId === phoneNumberId;
          });

          if (!connection) {
            logger.warn('Webhook: No connection found for phoneNumberId', { phoneNumberId });
            continue;
          }

          // Process messages
          const messages = value.messages || [];
          for (const message of messages) {
            await this.processIncomingMessage(connection.tenantId, connection.id, message);
          }

          // Process status updates
          const statuses = value.statuses || [];
          for (const status of statuses) {
            await this.processStatusUpdate(connection.tenantId, status);
          }
        }
      }
    } catch (error: any) {
      logger.error('Error processing WhatsApp webhook', error);
      throw error;
    }
  },

  /**
   * Process a single incoming message
   */
  async processIncomingMessage(tenantId: string, connectionId: string, message: any) {
    const from = message.from; // Sender phone number
    const messageType = message.type;
    const timestamp = message.timestamp;

    let content: string;
    switch (messageType) {
      case 'text':
        content = message.text?.body || '';
        break;
      case 'image':
        content = '[Imagem recebida]';
        break;
      case 'document':
        content = '[Documento recebido]';
        break;
      case 'audio':
        content = '[Audio recebido]';
        break;
      case 'video':
        content = '[Video recebido]';
        break;
      default:
        content = `[${messageType}]`;
    }

    // Update connection stats
    await prisma.whatsAppConnection.update({
      where: { id: connectionId },
      data: { messagesReceived: { increment: 1 } },
    });

    // Find lead by phone number
    const lead = await prisma.lead.findFirst({
      where: { tenantId, phone: { contains: from.slice(-8) } }, // Match last 8 digits
    });

    // Create interaction
    const interaction = await prisma.interaction.create({
      data: {
        tenantId,
        leadId: lead?.id || null,
        type: InteractionType.WHATSAPP,
        direction: InteractionDirection.INBOUND,
        content,
        metadata: {
          messageId: message.id,
          from,
          messageType,
          connectionId,
          timestamp,
        },
      },
    });

    // Score WhatsApp reply event
    if (lead) {
      scoringService.processEvent(tenantId, lead.id, ScoreEvent.WHATSAPP_REPLIED).catch(() => {});
    }

    logger.info('Incoming WhatsApp message processed', {
      tenantId,
      from,
      leadId: lead?.id,
      interactionId: interaction.id,
    });
  },

  /**
   * Process message status update (sent, delivered, read, failed)
   */
  async processStatusUpdate(tenantId: string, status: any) {
    const messageId = status.id;
    const statusValue = status.status; // sent, delivered, read, failed

    // Find interaction with this messageId
    const interactions = await prisma.interaction.findMany({
      where: {
        tenantId,
        type: InteractionType.WHATSAPP,
        direction: InteractionDirection.OUTBOUND,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const interaction = interactions.find((i) => {
      const meta = i.metadata as any;
      return meta?.messageId === messageId;
    });

    if (interaction) {
      // Update metadata with status
      const existingMeta = (interaction.metadata || {}) as any;
      await prisma.interaction.update({
        where: { id: interaction.id },
        data: {
          metadata: {
            ...existingMeta,
            deliveryStatus: statusValue,
            deliveryTimestamp: status.timestamp,
          },
        },
      });
    }

    logger.info('WhatsApp status update', { messageId, status: statusValue });
  },

  /**
   * Get message templates for a connection
   */
  async getTemplates(tenantId: string, connectionId: string) {
    const connection = await prisma.whatsAppConnection.findFirst({
      where: { id: connectionId, tenantId },
    });

    if (!connection) {
      throw createError('Connection not found', 404);
    }

    const config = safeDecryptConfig(connection.config) as any;
    const wabaId = config.wabaId;
    const accessToken = config.accessToken;

    if (!wabaId || !accessToken) {
      return []; // No WABA configured
    }

    try {
      const result = await callMetaAPI(`/${wabaId}/message_templates`, 'GET', accessToken);
      return result.data || [];
    } catch (error) {
      logger.error('Failed to fetch WhatsApp templates', error as any);
      return [];
    }
  },
};
