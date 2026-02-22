import prisma from '../config/database.js';
import { EmailProvider } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

export interface CreateEmailConfigData {
  name: string;
  provider: EmailProvider;
  fromEmail: string;
  fromName?: string;
  config?: any; // JSON - encrypted in production
}

export interface UpdateEmailConfigData extends Partial<CreateEmailConfigData> {
  id: string;
  verified?: boolean;
}

export const emailConfigService = {
  async create(tenantId: string, data: CreateEmailConfigData) {
    // Check plan limits
    const { planLimitsService } = await import('./planLimitsService.js');
    await planLimitsService.enforceLimit(tenantId, 'emailConfigs');

    const config = await prisma.emailConfig.create({
      data: {
        tenantId,
        name: data.name,
        provider: data.provider,
        fromEmail: data.fromEmail,
        fromName: data.fromName,
        config: data.config,
        verified: false,
      },
    });

    return this.findById(tenantId, config.id);
  },

  async findById(tenantId: string, id: string) {
    const config = await prisma.emailConfig.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!config) {
      throw createError('Email config not found', 404, 'EMAIL_CONFIG_NOT_FOUND');
    }

    return config;
  },

  async findAll(tenantId: string) {
    return prisma.emailConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async update(tenantId: string, data: UpdateEmailConfigData) {
    await this.findById(tenantId, data.id);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.provider !== undefined) updateData.provider = data.provider;
    if (data.fromEmail !== undefined) updateData.fromEmail = data.fromEmail;
    if (data.fromName !== undefined) updateData.fromName = data.fromName;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.verified !== undefined) {
      updateData.verified = data.verified;
      if (data.verified) {
        updateData.verifiedAt = new Date();
      }
    }

    const config = await prisma.emailConfig.update({
      where: { id: data.id },
      data: updateData,
    });

    return config;
  },

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.emailConfig.delete({
      where: { id },
    });
  },

  async verify(tenantId: string, id: string) {
    // In a real implementation, this would send a test email
    // For now, we'll just mark it as verified
    const config = await this.findById(tenantId, id);
    
    return prisma.emailConfig.update({
      where: { id },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });
  },
};








