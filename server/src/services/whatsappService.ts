import prisma from '../config/database.js';
import { WhatsAppProvider, WhatsAppConnectionStatus } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { planLimitsService } from './planLimitsService.js';
import { safeEncryptConfig, safeDecryptConfig } from '../utils/encryption.js';

export interface CreateWhatsAppConnectionData {
  name: string;
  provider: WhatsAppProvider;
  config?: any; // JSON - encrypted in production
  // Copiloto IA (Upgrade RD P3, req 25): designa esta conexão/número como o
  // canal do copiloto (ADMIN configura). Default false.
  isCopilot?: boolean;
}

export interface UpdateWhatsAppConnectionData extends Partial<CreateWhatsAppConnectionData> {
  id: string;
  status?: WhatsAppConnectionStatus;
  qrCode?: string;
}

export const whatsappService = {
  async create(tenantId: string, data: CreateWhatsAppConnectionData) {
    await planLimitsService.enforceLimit(tenantId, 'whatsappConnections');

    const isCopilot = data.isCopilot ?? false;

    const connection = await prisma.whatsAppConnection.create({
      data: {
        tenantId,
        name: data.name,
        provider: data.provider,
        status: WhatsAppConnectionStatus.DISCONNECTED,
        config: safeEncryptConfig(data.config) as any,
        isCopilot,
      },
    });

    // Invariante: no máximo UMA conexão copiloto por tenant. Se esta foi criada
    // como copiloto, zera o flag das demais numa transação (o id só existe após
    // o create, por isso o zeramento vem depois).
    if (isCopilot) {
      await prisma.whatsAppConnection.updateMany({
        where: { tenantId, id: { not: connection.id }, isCopilot: true },
        data: { isCopilot: false },
      });
    }

    planLimitsService.invalidateUsage(tenantId).catch(() => {});

    return this.findById(tenantId, connection.id);
  },

  async findById(tenantId: string, id: string) {
    const connection = await prisma.whatsAppConnection.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!connection) {
      throw createError('WhatsApp connection not found', 404, 'WHATSAPP_CONNECTION_NOT_FOUND');
    }

    return {
      ...connection,
      config: safeDecryptConfig(connection.config),
    };
  },

  async findAll(tenantId: string) {
    const connections = await prisma.whatsAppConnection.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return connections.map((conn) => ({
      ...conn,
      config: safeDecryptConfig(conn.config),
    }));
  },

  async update(tenantId: string, data: UpdateWhatsAppConnectionData) {
    await this.findById(tenantId, data.id);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.config !== undefined) updateData.config = safeEncryptConfig(data.config);
    if (data.isCopilot !== undefined) updateData.isCopilot = data.isCopilot;
    if (data.qrCode !== undefined) {
      updateData.qrCode = data.qrCode;
      updateData.qrCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    }
    if (data.status === WhatsAppConnectionStatus.CONNECTED) {
      updateData.lastConnectedAt = new Date();
    }

    // Invariante: no máximo UMA conexão copiloto por tenant. Quando esta conexão
    // passa a ser copiloto, zera o flag das demais e atualiza esta na MESMA
    // transação, garantindo consistência mesmo com writes concorrentes.
    if (data.isCopilot === true) {
      const [, connection] = await prisma.$transaction([
        prisma.whatsAppConnection.updateMany({
          where: { tenantId, id: { not: data.id }, isCopilot: true },
          data: { isCopilot: false },
        }),
        prisma.whatsAppConnection.update({
          where: { id: data.id },
          data: updateData,
        }),
      ]);

      return connection;
    }

    const connection = await prisma.whatsAppConnection.update({
      where: { id: data.id },
      data: updateData,
    });

    return connection;
  },

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.whatsAppConnection.delete({
      where: { id },
    });
    planLimitsService.invalidateUsage(tenantId).catch(() => {});
  },

  async updateQRCode(id: string, qrCode: string) {
    await prisma.whatsAppConnection.update({
      where: { id },
      data: {
        qrCode,
        qrCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });
  },

  async clearQRCode(id: string) {
    await prisma.whatsAppConnection.update({
      where: { id },
      data: {
        qrCode: null,
        qrCodeExpiresAt: null,
      },
    });
  },
};
