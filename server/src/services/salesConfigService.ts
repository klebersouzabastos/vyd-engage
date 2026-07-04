import prisma from '../config/database.js';
import { Prisma, PresetEntity, TriggerConditionType } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

/**
 * Configurações de vendas (Upgrade RD parity — P0).
 *
 * Qualificação e flags vivem em `Tenant.settings` (Json — sem coluna nova):
 *   settings.qualification = { autoQualify: boolean, levels: [{ level, name, maxScore }] }
 *   settings.multiSalesEnabled   (default false)
 *   settings.celebrationEnabled  (default true)
 *
 * Segmentos, presets e gatilhos gerenciais têm tabelas próprias
 * (CompanySegment / FieldPreset / ManagerTrigger), sempre escopadas por tenantId.
 */

// ── Qualificação ────────────────────────────────────────────────────────────

export interface QualificationLevel {
  level: number;
  name: string;
  maxScore: number | null;
}

export interface QualificationConfig {
  levels: QualificationLevel[];
  autoQualifyEnabled: boolean;
}

export const DEFAULT_QUALIFICATION_LEVEL_NAMES = [
  'Muito frio',
  'Frio',
  'Morno',
  'Quente',
  'Muito quente',
] as const;

/**
 * Normaliza o bloco `settings.qualification` (Json livre) para o contrato da API:
 * sempre 5 níveis ordenados, nomes com fallback padrão e maxScore número ou null.
 */
export function normalizeQualificationConfig(raw: unknown): QualificationConfig {
  const rawObj = (raw ?? {}) as {
    autoQualify?: unknown;
    levels?: unknown;
  };
  const rawLevels = Array.isArray(rawObj.levels) ? (rawObj.levels as unknown[]) : [];

  const levels: QualificationLevel[] = [1, 2, 3, 4, 5].map((level) => {
    const found = rawLevels.find(
      (l) => typeof l === 'object' && l !== null && (l as { level?: unknown }).level === level
    ) as { name?: unknown; maxScore?: unknown } | undefined;

    const name =
      typeof found?.name === 'string' && found.name.trim() !== ''
        ? found.name.trim()
        : DEFAULT_QUALIFICATION_LEVEL_NAMES[level - 1];
    const maxScore =
      typeof found?.maxScore === 'number' && Number.isFinite(found.maxScore)
        ? Math.trunc(found.maxScore)
        : null;

    return { level, name, maxScore };
  });

  return { levels, autoQualifyEnabled: rawObj.autoQualify === true };
}

/**
 * Regra de qualificação automática (design fixado): nível = MENOR level cujo
 * maxScore >= score (níveis ordenados); score acima do maior maxScore => 5.
 * Só aplica quando autoQualifyEnabled E os 5 maxScore estão definidos —
 * caso contrário retorna null (nada muda no deal).
 */
export function resolveQualificationLevel(
  config: QualificationConfig,
  score: number
): number | null {
  if (!config.autoQualifyEnabled) return null;
  const levels = [...config.levels].sort((a, b) => a.level - b.level);
  if (levels.length !== 5 || levels.some((l) => typeof l.maxScore !== 'number')) return null;
  for (const l of levels) {
    if (score <= (l.maxScore as number)) return l.level;
  }
  return 5;
}

async function readTenantSettings(tenantId: string): Promise<Record<string, unknown>> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  if (!tenant) {
    throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
  }
  return (tenant.settings as Record<string, unknown> | null) ?? {};
}

/** Merge raso em Tenant.settings preservando as demais chaves (padrão de PUT /auth/tenant). */
async function mergeTenantSettings(tenantId: string, patch: Record<string, unknown>) {
  const current = await readTenantSettings(tenantId);
  const settings = { ...current, ...patch };
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: settings as Prisma.InputJsonValue },
  });
  return settings;
}

// ── Flags do tenant ─────────────────────────────────────────────────────────

export interface SalesFlags {
  multiSalesEnabled: boolean;
  celebrationEnabled: boolean;
}

export function normalizeSalesFlags(settings: Record<string, unknown>): SalesFlags {
  return {
    multiSalesEnabled: settings.multiSalesEnabled === true,
    // Comemoração é opt-out: só desliga quando explicitamente false.
    celebrationEnabled: settings.celebrationEnabled !== false,
  };
}

// ── Presets — campos suportados por entidade (design fixado) ────────────────

export const PRESET_FIELDS_BY_ENTITY: Record<PresetEntity, string[]> = {
  COMPANY: ['industry'],
  CONTACT: ['position'],
  DEAL: [],
};

export interface FieldPresetInput {
  entity: PresetEntity;
  field: string;
  options: string[];
  allowCustom?: boolean;
}

// ── Gatilhos gerenciais ─────────────────────────────────────────────────────

export interface TriggerConditionConfig {
  days?: number;
  funnelColumnId?: string;
  useCoolingDays?: boolean;
  minValue?: number;
}

export interface ManagerTriggerInput {
  name: string;
  conditionType: TriggerConditionType;
  conditionConfig: TriggerConditionConfig;
  notifyOwner?: boolean;
  notifyManagers?: boolean;
  notifyUserIds?: string[];
  emailEnabled?: boolean;
  active?: boolean;
}

/**
 * Validação semântica da condição por tipo (a forma já foi validada por Zod na
 * rota). Gatilho mal configurado (N=0/ausente, sem destinatário) é rejeitado —
 * caso extremo explícito da spec.
 */
export function assertTriggerConditionValid(
  conditionType: TriggerConditionType,
  config: TriggerConditionConfig,
  recipients: { notifyOwner: boolean; notifyManagers: boolean; notifyUserIds: string[] }
) {
  if (!recipients.notifyOwner && !recipients.notifyManagers && recipients.notifyUserIds.length === 0) {
    throw createError(
      'Informe pelo menos um destinatário (responsável, gestores ou usuários específicos)',
      400,
      'TRIGGER_NO_RECIPIENTS'
    );
  }
  switch (conditionType) {
    case TriggerConditionType.NO_INTERACTION:
      if (config.useCoolingDays !== true && (!config.days || config.days < 1)) {
        throw createError(
          'Informe o número de dias sem interação (mínimo 1) ou use os dias de esfriamento da etapa',
          400,
          'TRIGGER_INVALID_CONDITION'
        );
      }
      break;
    case TriggerConditionType.STUCK_IN_STAGE:
      if (!config.days || config.days < 1) {
        throw createError(
          'Informe o número de dias parado na etapa (mínimo 1)',
          400,
          'TRIGGER_INVALID_CONDITION'
        );
      }
      break;
    case TriggerConditionType.BIG_SALE:
      if (typeof config.minValue !== 'number' || config.minValue <= 0) {
        throw createError(
          'Informe o valor mínimo da venda (maior que zero)',
          400,
          'TRIGGER_INVALID_CONDITION'
        );
      }
      break;
    case TriggerConditionType.DEAL_LOST:
      break;
  }
}

async function assertFunnelColumnInTenant(tenantId: string, funnelColumnId?: string) {
  if (!funnelColumnId) return;
  const column = await prisma.funnelColumn.findFirst({
    where: { id: funnelColumnId, funnel: { tenantId } },
    select: { id: true },
  });
  if (!column) {
    throw createError('Etapa de funil inválida', 400, 'INVALID_FUNNEL_COLUMN');
  }
}

async function assertUsersInTenant(tenantId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const count = await prisma.user.count({ where: { id: { in: userIds }, tenantId } });
  if (count !== userIds.length) {
    throw createError('Um ou mais usuários destinatários são inválidos', 400, 'INVALID_NOTIFY_USERS');
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// ── Service ─────────────────────────────────────────────────────────────────

export const salesConfigService = {
  // Qualificação
  async getQualificationConfig(tenantId: string): Promise<QualificationConfig> {
    const settings = await readTenantSettings(tenantId);
    return normalizeQualificationConfig(settings.qualification);
  },

  async updateQualificationConfig(
    tenantId: string,
    config: QualificationConfig
  ): Promise<QualificationConfig> {
    const levels = [...config.levels]
      .sort((a, b) => a.level - b.level)
      .map((l) => ({
        level: l.level,
        name: l.name.trim(),
        maxScore: typeof l.maxScore === 'number' ? Math.trunc(l.maxScore) : null,
      }));
    const settings = await mergeTenantSettings(tenantId, {
      qualification: { autoQualify: config.autoQualifyEnabled, levels },
    });
    return normalizeQualificationConfig((settings as Record<string, unknown>).qualification);
  },

  // Flags
  async getFlags(tenantId: string): Promise<SalesFlags> {
    return normalizeSalesFlags(await readTenantSettings(tenantId));
  },

  async updateFlags(tenantId: string, patch: Partial<SalesFlags>): Promise<SalesFlags> {
    const clean: Record<string, unknown> = {};
    if (typeof patch.multiSalesEnabled === 'boolean') clean.multiSalesEnabled = patch.multiSalesEnabled;
    if (typeof patch.celebrationEnabled === 'boolean')
      clean.celebrationEnabled = patch.celebrationEnabled;
    const settings = await mergeTenantSettings(tenantId, clean);
    return normalizeSalesFlags(settings);
  },

  // Segmentos de empresas
  async listSegments(tenantId: string, activeOnly = false) {
    return prisma.companySegment.findMany({
      where: { tenantId, ...(activeOnly ? { active: true } : {}) },
      orderBy: { name: 'asc' },
    });
  },

  async createSegment(tenantId: string, data: { name: string; active?: boolean }) {
    try {
      return await prisma.companySegment.create({
        data: { tenantId, name: data.name.trim(), active: data.active ?? true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw createError('Já existe um segmento com esse nome', 400, 'SEGMENT_DUPLICATE');
      }
      throw error;
    }
  },

  async updateSegment(tenantId: string, id: string, data: { name?: string; active?: boolean }) {
    const existing = await prisma.companySegment.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw createError('Segmento não encontrado', 404, 'SEGMENT_NOT_FOUND');
    }
    try {
      return await prisma.companySegment.update({
        where: { id },
        data: {
          name: data.name !== undefined ? data.name.trim() : undefined,
          active: data.active,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw createError('Já existe um segmento com esse nome', 400, 'SEGMENT_DUPLICATE');
      }
      throw error;
    }
  },

  async deleteSegment(tenantId: string, id: string) {
    const existing = await prisma.companySegment.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw createError('Segmento não encontrado', 404, 'SEGMENT_NOT_FOUND');
    }
    // FK Company.segmentId é ON DELETE SET NULL — empresas ficam sem segmento.
    await prisma.companySegment.delete({ where: { id } });
    return { deleted: true };
  },

  // Presets (informações pré-definidas)
  async listPresets(tenantId: string, entity?: PresetEntity) {
    return prisma.fieldPreset.findMany({
      where: { tenantId, ...(entity ? { entity } : {}) },
      orderBy: [{ entity: 'asc' }, { field: 'asc' }],
    });
  },

  async createPreset(tenantId: string, data: FieldPresetInput) {
    assertPresetFieldValid(data.entity, data.field);
    try {
      return await prisma.fieldPreset.create({
        data: {
          tenantId,
          entity: data.entity,
          field: data.field,
          options: normalizePresetOptions(data.options),
          allowCustom: data.allowCustom ?? true,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw createError(
          'Já existe uma lista pré-definida para esse campo',
          400,
          'PRESET_DUPLICATE'
        );
      }
      throw error;
    }
  },

  async updatePreset(tenantId: string, id: string, data: Partial<FieldPresetInput>) {
    const existing = await prisma.fieldPreset.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw createError('Lista pré-definida não encontrada', 404, 'PRESET_NOT_FOUND');
    }
    const entity = data.entity ?? existing.entity;
    const field = data.field ?? existing.field;
    assertPresetFieldValid(entity, field);
    try {
      return await prisma.fieldPreset.update({
        where: { id },
        data: {
          entity: data.entity,
          field: data.field,
          options: data.options !== undefined ? normalizePresetOptions(data.options) : undefined,
          allowCustom: data.allowCustom,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw createError(
          'Já existe uma lista pré-definida para esse campo',
          400,
          'PRESET_DUPLICATE'
        );
      }
      throw error;
    }
  },

  async deletePreset(tenantId: string, id: string) {
    const existing = await prisma.fieldPreset.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw createError('Lista pré-definida não encontrada', 404, 'PRESET_NOT_FOUND');
    }
    await prisma.fieldPreset.delete({ where: { id } });
    return { deleted: true };
  },

  // Gatilhos gerenciais
  async listTriggers(tenantId: string) {
    return prisma.managerTrigger.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  },

  async createTrigger(tenantId: string, data: ManagerTriggerInput) {
    const recipients = {
      notifyOwner: data.notifyOwner ?? true,
      notifyManagers: data.notifyManagers ?? false,
      notifyUserIds: data.notifyUserIds ?? [],
    };
    assertTriggerConditionValid(data.conditionType, data.conditionConfig, recipients);
    await assertFunnelColumnInTenant(tenantId, data.conditionConfig.funnelColumnId);
    await assertUsersInTenant(tenantId, recipients.notifyUserIds);

    return prisma.managerTrigger.create({
      data: {
        tenantId,
        name: data.name.trim(),
        conditionType: data.conditionType,
        conditionConfig: data.conditionConfig as Prisma.InputJsonValue,
        notifyOwner: recipients.notifyOwner,
        notifyManagers: recipients.notifyManagers,
        notifyUserIds: recipients.notifyUserIds as Prisma.InputJsonValue,
        emailEnabled: data.emailEnabled ?? false,
        active: data.active ?? true,
        isDefault: false,
      },
    });
  },

  async updateTrigger(tenantId: string, id: string, data: Partial<ManagerTriggerInput>) {
    const existing = await prisma.managerTrigger.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw createError('Gatilho não encontrado', 404, 'TRIGGER_NOT_FOUND');
    }

    // Gatilho padrão ("Negociações esfriando"): só permite ativar/desativar e
    // ajustar os dias — nome, tipo e destinatários são fixos (design fixado).
    if (existing.isDefault) {
      if (data.conditionType !== undefined && data.conditionType !== existing.conditionType) {
        throw createError(
          'O gatilho padrão só permite ativar/desativar e ajustar os dias',
          400,
          'DEFAULT_TRIGGER_LOCKED'
        );
      }
      if (data.name !== undefined && data.name.trim() !== existing.name) {
        throw createError(
          'O gatilho padrão só permite ativar/desativar e ajustar os dias',
          400,
          'DEFAULT_TRIGGER_LOCKED'
        );
      }
      const currentConfig = (existing.conditionConfig as TriggerConditionConfig | null) ?? {};
      const days = data.conditionConfig?.days;
      if (days !== undefined && days < 1) {
        throw createError('Informe um número de dias válido (mínimo 1)', 400, 'TRIGGER_INVALID_CONDITION');
      }
      return prisma.managerTrigger.update({
        where: { id },
        data: {
          active: data.active,
          conditionConfig:
            days !== undefined
              ? ({ ...currentConfig, days, useCoolingDays: false } as Prisma.InputJsonValue)
              : undefined,
        },
      });
    }

    const merged: ManagerTriggerInput = {
      name: data.name ?? existing.name,
      conditionType: data.conditionType ?? existing.conditionType,
      conditionConfig:
        data.conditionConfig ?? ((existing.conditionConfig as TriggerConditionConfig | null) ?? {}),
      notifyOwner: data.notifyOwner ?? existing.notifyOwner,
      notifyManagers: data.notifyManagers ?? existing.notifyManagers,
      notifyUserIds: data.notifyUserIds ?? ((existing.notifyUserIds as string[] | null) ?? []),
      emailEnabled: data.emailEnabled ?? existing.emailEnabled,
      active: data.active ?? existing.active,
    };
    const recipients = {
      notifyOwner: merged.notifyOwner as boolean,
      notifyManagers: merged.notifyManagers as boolean,
      notifyUserIds: merged.notifyUserIds as string[],
    };
    assertTriggerConditionValid(merged.conditionType, merged.conditionConfig, recipients);
    await assertFunnelColumnInTenant(tenantId, merged.conditionConfig.funnelColumnId);
    await assertUsersInTenant(tenantId, recipients.notifyUserIds);

    return prisma.managerTrigger.update({
      where: { id },
      data: {
        name: merged.name.trim(),
        conditionType: merged.conditionType,
        conditionConfig: merged.conditionConfig as Prisma.InputJsonValue,
        notifyOwner: recipients.notifyOwner,
        notifyManagers: recipients.notifyManagers,
        notifyUserIds: recipients.notifyUserIds as Prisma.InputJsonValue,
        emailEnabled: merged.emailEnabled,
        active: merged.active,
      },
    });
  },

  async deleteTrigger(tenantId: string, id: string) {
    const existing = await prisma.managerTrigger.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw createError('Gatilho não encontrado', 404, 'TRIGGER_NOT_FOUND');
    }
    if (existing.isDefault) {
      throw createError('O gatilho padrão não pode ser excluído', 400, 'DEFAULT_TRIGGER_LOCKED');
    }
    await prisma.managerTrigger.delete({ where: { id } });
    return { deleted: true };
  },
};

function assertPresetFieldValid(entity: PresetEntity, field: string) {
  const allowed = PRESET_FIELDS_BY_ENTITY[entity] ?? [];
  if (!allowed.includes(field)) {
    throw createError(
      allowed.length > 0
        ? `Campo não suportado para pré-definição nesta entidade (suportados: ${allowed.join(', ')})`
        : 'Esta entidade ainda não possui campos com pré-definição',
      400,
      'PRESET_INVALID_FIELD'
    );
  }
}

/** Dedup preservando a ordem; entradas vazias já foram bloqueadas pelo Zod da rota. */
function normalizePresetOptions(options: string[]): string[] {
  return [...new Set(options.map((o) => o.trim()).filter((o) => o !== ''))];
}
