import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';

/**
 * CRUD genérico para as listas de configuração simples da gestão de negócios:
 * Motivos de Perda (LostReason), Fontes (DealSource) e Campanhas de origem
 * (OriginCampaign). Todas têm a mesma forma: id, tenantId, <campo-rótulo>,
 * active, order. Isolado por tenant; ordenado por `order` e depois pelo rótulo.
 */

// Delegate mínimo do Prisma (as três listas compartilham a mesma interface).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConfigDelegate = Record<string, (args: any) => Promise<any>>;

function makeConfigService(
  delegate: ConfigDelegate,
  labelField: 'name' | 'label',
  notFoundCode: string
) {
  return {
    async findAll(tenantId: string, activeOnly = false) {
      return delegate.findMany({
        where: { tenantId, ...(activeOnly ? { active: true } : {}) },
        orderBy: [{ order: 'asc' }, { [labelField]: 'asc' }],
      });
    },

    async create(tenantId: string, value: string) {
      const agg = await delegate.aggregate({ where: { tenantId }, _max: { order: true } });
      const nextOrder = (agg?._max?.order ?? -1) + 1;
      return delegate.create({ data: { tenantId, [labelField]: value, order: nextOrder } });
    },

    async update(
      tenantId: string,
      id: string,
      data: { value?: string; active?: boolean; order?: number }
    ) {
      const existing = await delegate.findFirst({ where: { id, tenantId } });
      if (!existing) throw createError('Registro não encontrado', 404, notFoundCode);
      return delegate.update({
        where: { id },
        data: {
          ...(data.value !== undefined ? { [labelField]: data.value } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
          ...(data.order !== undefined ? { order: data.order } : {}),
        },
      });
    },

    async delete(tenantId: string, id: string) {
      const existing = await delegate.findFirst({ where: { id, tenantId } });
      if (!existing) throw createError('Registro não encontrado', 404, notFoundCode);
      await delegate.delete({ where: { id } });
      return { deleted: true };
    },
  };
}

export const lostReasonService = makeConfigService(
  prisma.lostReason as unknown as ConfigDelegate,
  'label',
  'LOST_REASON_NOT_FOUND'
);
export const dealSourceService = makeConfigService(
  prisma.dealSource as unknown as ConfigDelegate,
  'name',
  'DEAL_SOURCE_NOT_FOUND'
);
export const originCampaignService = makeConfigService(
  prisma.originCampaign as unknown as ConfigDelegate,
  'name',
  'ORIGIN_CAMPAIGN_NOT_FOUND'
);
