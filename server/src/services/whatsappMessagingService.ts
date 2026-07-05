import prisma from '../config/database.js';
import { InteractionType, InteractionDirection, ScoreEvent, DealStatus } from '@prisma/client';
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
  // Upgrade RD P3 (req 23): vincula a mensagem à timeline do deal/empresa (além do
  // lead). A Interaction WHATSAPP OUTBOUND aponta para leadId/dealId/companyId
  // conforme informados, aparecendo no histórico da entidade correspondente.
  dealId?: string;
  companyId?: string;
  // Upgrade RD P3 (lacuna #4): remetente da mensagem. Gravado na Interaction
  // OUTBOUND (userId) para que a mensagem enviada apareça na timeline do
  // deal/empresa para analistas com visibilidade PROPRIA (que filtra por userId).
  userId?: string;
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
// Phone matching (réplica da semântica do copilotService)
// ========================

/** Mantém apenas dígitos de um telefone. */
function digitsOnly(raw: string): string {
  return (raw || '').replace(/\D+/g, '');
}

/**
 * Normaliza um telefone para comparação: retorna o número em dígitos e a variante
 * sem o prefixo de DDI 55 (quando presente). Dois números casam se os dígitos
 * COMPLETOS batem, ou se batem depois de remover o '55' inicial de UM dos lados —
 * assim toleramos apenas a presença/ausência do DDI brasileiro, sem colidir por
 * sufixo (o bug: 8 dígitos finais iguais em DDDs diferentes casaria o lead errado).
 */
function phoneVariants(raw: string): string[] {
  const d = digitsOnly(raw);
  if (!d) return [];
  const variants = new Set<string>([d]);
  if (d.startsWith('55') && d.length > 2) variants.add(d.slice(2));
  return [...variants];
}

/** Dois telefones casam se compartilham alguma variante normalizada (com/sem DDI 55). */
function phonesMatch(a: string, b: string): boolean {
  const va = phoneVariants(a);
  const vb = phoneVariants(b);
  if (va.length === 0 || vb.length === 0) return false;
  return va.some((x) => vb.includes(x));
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

    // Meta Graph espera o destino apenas em dígitos (E.164 sem símbolos). O
    // frontend (fallback wa.me) já sanitiza, mas o caminho CONNECTED recebia
    // `data.to` como veio (podia estar mascarado, ex.: "(11) 99999-0000"). Aqui
    // normalizamos para dígitos antes de montar o payload. Se ficar vazio,
    // mantemos o comportamento de erro atual (a própria Meta API rejeita).
    const to = (data.to || '').replace(/\D+/g, '');

    // Build message payload
    const messagePayload: any = {
      messaging_product: 'whatsapp',
      to,
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

    // Create interaction record. Vincula a leadId/dealId/companyId conforme
    // informados (req 23) — a mensagem passa a aparecer na timeline do deal/empresa,
    // não só do lead. Só cria a Interaction se houver ao menos um vínculo. Cada
    // vínculo é validado contra o tenant (não referencia lead/deal/empresa de outro tenant).
    let leadId: string | null = null;
    if (data.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: data.leadId, tenantId },
        select: { id: true },
      });
      leadId = lead?.id ?? null;
    }
    let dealId: string | null = null;
    if (data.dealId) {
      const deal = await prisma.deal.findFirst({
        where: { id: data.dealId, tenantId, deletedAt: null },
        select: { id: true },
      });
      dealId = deal?.id ?? null;
    }
    let companyId: string | null = null;
    if (data.companyId) {
      const company = await prisma.company.findFirst({
        where: { id: data.companyId, tenantId, deletedAt: null },
        select: { id: true },
      });
      companyId = company?.id ?? null;
    }

    if (leadId || dealId || companyId) {
      // Para envios por TEMPLATE, o corpo real (parâmetros) não vem em `data.content`
      // (que fica vazio). Compomos um `content` legível a partir do nome do template +
      // parâmetros para que a mensagem enviada apareça de fato na timeline do
      // deal/empresa — não só o subject "Template: <nome>".
      const content =
        data.type === 'template'
          ? data.templateParams?.length
            ? `Template ${data.templateName}: ${data.templateParams.join(', ')}`
            : `Template ${data.templateName}`
          : data.content;

      await prisma.interaction.create({
        data: {
          tenantId,
          leadId,
          dealId,
          companyId,
          userId: data.userId ?? null,
          type: InteractionType.WHATSAPP,
          direction: InteractionDirection.OUTBOUND,
          subject: data.type === 'template' ? `Template: ${data.templateName}` : undefined,
          content,
          metadata: {
            messageId,
            connectionId: data.connectionId,
            to,
            type: data.type,
          },
        },
      });
    }

    return {
      messageId,
      status: 'sent',
      to,
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

    // Resolve o lead da mensagem RECEBIDA por telefone.
    //
    // Lacuna #1/#9: o lead NÃO pode ser resolvido só por SUFIXO de 8 dígitos
    // (`phone: { contains: from.slice(-8) }`): (a) casa o lead ERRADO quando dois
    // leads do tenant terminam nos mesmos 8 dígitos (DDDs diferentes), e (b) não
    // filtrava `deletedAt: null`, podendo casar lead na Lixeira. Correção: buscar
    // CANDIDATOS por sufixo curto COM `deletedAt: null` e filtrar por
    // `phonesMatch(lead.phone, from)` (dígitos COMPLETOS, tolerando só o DDI 55).
    // `phonesMatch` já normaliza máscaras via `digitsOnly`, então isto MELHORA o
    // matching (não regride). Só gravamos o leadId quando houver match completo;
    // sem candidato que dê match, a Interaction é gravada SEM lead.
    const candidateLeads = await prisma.lead.findMany({
      where: { tenantId, deletedAt: null, phone: { contains: from.slice(-8) } },
    });
    const lead = candidateLeads.find((c) => phonesMatch(c.phone || '', from)) ?? null;

    // Upgrade RD P3 (req 23): mensagens RECEBIDAS também precisam aparecer na
    // timeline do deal (a timeline do deal é buscada por dealId). Heurística
    // conservadora: se o lead resolvido tem EXATAMENTE UM deal ABERTO (status
    // != WON/LOST, deletedAt null) no tenant, vinculamos a Interaction INBOUND a
    // esse deal (e à empresa do lead, quando houver). Com 0 ou >1 deals abertos
    // mantemos só o leadId — não adivinhamos qual deal é o "certo". Como `lead` já
    // é um match por dígitos COMPLETOS, a inferência de deal/empresa não corre o
    // risco de poluir a timeline do deal errado.
    let dealId: string | null = null;
    let companyId: string | null = null;
    if (lead) {
      const openDeals = await prisma.deal.findMany({
        where: {
          tenantId,
          leadId: lead.id,
          deletedAt: null,
          status: { notIn: [DealStatus.WON, DealStatus.LOST] },
        },
        select: { id: true },
        take: 2, // só precisamos distinguir "exatamente 1" de "vários"
      });
      if (openDeals.length === 1) {
        dealId = openDeals[0].id;
        companyId = lead.companyId ?? null;
      }
    }

    // Create interaction
    const interaction = await prisma.interaction.create({
      data: {
        tenantId,
        leadId: lead?.id || null,
        dealId,
        companyId,
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

    // Localiza a Interaction OUTBOUND diretamente pelo messageId via path de JSON do
    // Postgres (`metadata.messageId`, o mesmo caminho gravado em sendMessage), em vez
    // de varrer as 100 interações mais recentes em memória — sob volume alto o scan
    // por janela poderia não achar a interação certa (lacuna #5). Esse é exatamente o
    // messageId retornado pela Meta Graph e persistido no metadata da OUTBOUND.
    const interaction = await prisma.interaction.findFirst({
      where: {
        tenantId,
        type: InteractionType.WHATSAPP,
        direction: InteractionDirection.OUTBOUND,
        metadata: { path: ['messageId'], equals: messageId },
      },
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
