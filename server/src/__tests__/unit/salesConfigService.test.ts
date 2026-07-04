import { describe, it, expect } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';
import { TriggerConditionType } from '@prisma/client';
import {
  salesConfigService,
  normalizeQualificationConfig,
  normalizeSalesFlags,
  resolveQualificationLevel,
  assertTriggerConditionValid,
  DEFAULT_QUALIFICATION_LEVEL_NAMES,
} from '../../services/salesConfigService.js';
import { qualificationSchema } from '../../routes/salesConfig.js';

/**
 * Upgrade RD parity — P0 (reqs 1, 3 e 8):
 *  - escala de qualificação (5 níveis, nomes, maxScore crescente, toggle auto);
 *  - regra de auto-qualificação por score;
 *  - validação de gatilhos gerenciais (condição por tipo + destinatários).
 *
 * Testes de unidade com Prisma mockado (padrão helpers/prismaMock) — não tocam
 * o banco (as tabelas novas só existem após a migração 20260704000000).
 */

const tenantId = 'tenant-1';

// Primeiro argumento da primeira chamada de um mock (precedente dealServiceGestao.test).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arg0 = (fn: any) => fn.mock.calls[0][0];

const levels = (maxScores: Array<number | null>) =>
  maxScores.map((maxScore, i) => ({
    level: i + 1,
    name: DEFAULT_QUALIFICATION_LEVEL_NAMES[i],
    maxScore,
  }));

describe('normalizeQualificationConfig — defaults', () => {
  it('sem configuração salva, retorna os 5 níveis padrão com maxScore null e toggle off', () => {
    const config = normalizeQualificationConfig(undefined);
    expect(config.levels).toHaveLength(5);
    expect(config.levels.map((l) => l.name)).toEqual([...DEFAULT_QUALIFICATION_LEVEL_NAMES]);
    expect(config.levels.every((l) => l.maxScore === null)).toBe(true);
    expect(config.autoQualifyEnabled).toBe(false);
  });

  it('preenche nome padrão para nível salvo sem nome e ignora maxScore não numérico', () => {
    const config = normalizeQualificationConfig({
      autoQualify: true,
      levels: [
        { level: 1, name: '', maxScore: 'abc' },
        { level: 3, name: 'Médio', maxScore: 30 },
      ],
    });
    expect(config.levels[0]).toEqual({ level: 1, name: 'Muito frio', maxScore: null });
    expect(config.levels[2]).toEqual({ level: 3, name: 'Médio', maxScore: 30 });
    expect(config.autoQualifyEnabled).toBe(true);
  });
});

describe('PUT /sales-config/qualification — validação (qualificationSchema)', () => {
  const valid = { levels: levels([10, 20, 30, 40, 50]), autoQualifyEnabled: true };

  it('aceita payload válido (5 níveis, maxScore crescente)', () => {
    expect(qualificationSchema.safeParse(valid).success).toBe(true);
  });

  it('aceita maxScore parcial (níveis sem pontuação definida)', () => {
    const partial = { levels: levels([10, null, 30, null, null]), autoQualifyEnabled: false };
    expect(qualificationSchema.safeParse(partial).success).toBe(true);
  });

  it('rejeita quando não há exatamente 5 níveis', () => {
    const result = qualificationSchema.safeParse({
      levels: levels([10, 20, 30, 40]),
      autoQualifyEnabled: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita níveis repetidos (dois "nível 2")', () => {
    const dup = { ...valid, levels: valid.levels.map((l, i) => (i === 0 ? { ...l, level: 2 } : l)) };
    const result = qualificationSchema.safeParse(dup);
    expect(result.success).toBe(false);
  });

  it('rejeita nome de nível vazio', () => {
    const noName = {
      ...valid,
      levels: valid.levels.map((l, i) => (i === 2 ? { ...l, name: '   ' } : l)),
    };
    expect(qualificationSchema.safeParse(noName).success).toBe(false);
  });

  it('rejeita maxScore não crescente entre níveis definidos', () => {
    const result = qualificationSchema.safeParse({
      levels: levels([10, 5, 30, 40, 50]),
      autoQualifyEnabled: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('salesConfigService.updateQualificationConfig — persistência em Tenant.settings', () => {
  it('grava settings.qualification preservando as demais chaves do settings', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      settings: { multiSalesEnabled: true, slackWebhookUrl: 'https://hooks.slack.com/x' },
    } as never);
    prismaMock.tenant.update.mockResolvedValue({} as never);

    const result = await salesConfigService.updateQualificationConfig(tenantId, {
      levels: levels([10, 20, 30, 40, 50]),
      autoQualifyEnabled: true,
    });

    const updateArg = arg0(prismaMock.tenant.update) as {
      where: { id: string };
      data: { settings: Record<string, unknown> };
    };
    expect(updateArg.where).toEqual({ id: tenantId });
    // Chaves pré-existentes preservadas (merge, não replace).
    expect(updateArg.data.settings.multiSalesEnabled).toBe(true);
    expect(updateArg.data.settings.slackWebhookUrl).toBe('https://hooks.slack.com/x');
    // Persistido no formato do design: { autoQualify, levels }.
    expect(updateArg.data.settings.qualification).toMatchObject({ autoQualify: true });
    expect(result.autoQualifyEnabled).toBe(true);
    expect(result.levels.map((l) => l.maxScore)).toEqual([10, 20, 30, 40, 50]);
  });
});

describe('normalizeSalesFlags — defaults do tenant', () => {
  it('multiSales default false; celebration default true (opt-out)', () => {
    expect(normalizeSalesFlags({})).toEqual({ multiSalesEnabled: false, celebrationEnabled: true });
    expect(normalizeSalesFlags({ multiSalesEnabled: true, celebrationEnabled: false })).toEqual({
      multiSalesEnabled: true,
      celebrationEnabled: false,
    });
  });
});

describe('resolveQualificationLevel — regra de auto-qualificação (req 3)', () => {
  const on = { levels: levels([10, 20, 30, 40, 50]), autoQualifyEnabled: true };

  it('nível = menor level cujo maxScore >= score', () => {
    expect(resolveQualificationLevel(on, 0)).toBe(1);
    expect(resolveQualificationLevel(on, 10)).toBe(1);
    expect(resolveQualificationLevel(on, 11)).toBe(2);
    expect(resolveQualificationLevel(on, 35)).toBe(4);
    expect(resolveQualificationLevel(on, 50)).toBe(5);
  });

  it('score acima do maior maxScore => nível 5', () => {
    expect(resolveQualificationLevel(on, 999)).toBe(5);
  });

  it('toggle desligado => null (nada muda no deal)', () => {
    expect(resolveQualificationLevel({ ...on, autoQualifyEnabled: false }, 15)).toBeNull();
  });

  it('maxScore incompleto (algum null) => null mesmo com toggle ligado', () => {
    const incomplete = { levels: levels([10, 20, null, 40, 50]), autoQualifyEnabled: true };
    expect(resolveQualificationLevel(incomplete, 15)).toBeNull();
  });
});

describe('assertTriggerConditionValid — gatilhos gerenciais (req 8)', () => {
  const allRecipients = { notifyOwner: true, notifyManagers: false, notifyUserIds: [] };

  it('rejeita gatilho sem nenhum destinatário', () => {
    expect(() =>
      assertTriggerConditionValid(
        TriggerConditionType.DEAL_LOST,
        {},
        { notifyOwner: false, notifyManagers: false, notifyUserIds: [] }
      )
    ).toThrowError(/destinatário/);
  });

  it('NO_INTERACTION exige days >= 1 OU useCoolingDays', () => {
    expect(() =>
      assertTriggerConditionValid(TriggerConditionType.NO_INTERACTION, {}, allRecipients)
    ).toThrowError(/dias/);
    expect(() =>
      assertTriggerConditionValid(TriggerConditionType.NO_INTERACTION, { days: 0 }, allRecipients)
    ).toThrowError(/dias/);
    expect(() =>
      assertTriggerConditionValid(
        TriggerConditionType.NO_INTERACTION,
        { useCoolingDays: true },
        allRecipients
      )
    ).not.toThrow();
    expect(() =>
      assertTriggerConditionValid(TriggerConditionType.NO_INTERACTION, { days: 7 }, allRecipients)
    ).not.toThrow();
  });

  it('STUCK_IN_STAGE exige days; BIG_SALE exige minValue > 0; DEAL_LOST não exige nada', () => {
    expect(() =>
      assertTriggerConditionValid(TriggerConditionType.STUCK_IN_STAGE, {}, allRecipients)
    ).toThrowError(/dias/);
    expect(() =>
      assertTriggerConditionValid(TriggerConditionType.BIG_SALE, {}, allRecipients)
    ).toThrowError(/valor mínimo/);
    expect(() =>
      assertTriggerConditionValid(
        TriggerConditionType.BIG_SALE,
        { minValue: 50000 },
        allRecipients
      )
    ).not.toThrow();
    expect(() =>
      assertTriggerConditionValid(TriggerConditionType.DEAL_LOST, {}, allRecipients)
    ).not.toThrow();
  });
});

describe('salesConfigService — gatilho padrão (isDefault) protegido', () => {
  const defaultTrigger = {
    id: 'trig-default',
    tenantId,
    name: 'Negociações esfriando',
    conditionType: TriggerConditionType.NO_INTERACTION,
    conditionConfig: { useCoolingDays: true },
    notifyOwner: true,
    notifyManagers: false,
    notifyUserIds: [],
    emailEnabled: false,
    active: true,
    isDefault: true,
  };

  it('DELETE do gatilho padrão → 400 (DEFAULT_TRIGGER_LOCKED)', async () => {
    prismaMock.managerTrigger.findFirst.mockResolvedValue(defaultTrigger as never);

    await expect(salesConfigService.deleteTrigger(tenantId, 'trig-default')).rejects.toMatchObject({
      statusCode: 400,
      code: 'DEFAULT_TRIGGER_LOCKED',
    });
    expect(prismaMock.managerTrigger.delete).not.toHaveBeenCalled();
  });

  it('PUT no gatilho padrão só permite ativar/desativar e ajustar os dias', async () => {
    prismaMock.managerTrigger.findFirst.mockResolvedValue(defaultTrigger as never);
    prismaMock.managerTrigger.update.mockResolvedValue(defaultTrigger as never);

    // Renomear é bloqueado.
    await expect(
      salesConfigService.updateTrigger(tenantId, 'trig-default', { name: 'Outro nome' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'DEFAULT_TRIGGER_LOCKED' });

    // Desativar + editar days é permitido.
    await salesConfigService.updateTrigger(tenantId, 'trig-default', {
      active: false,
      conditionConfig: { days: 10 },
    });
    const updateArg = arg0(prismaMock.managerTrigger.update) as {
      data: { active?: boolean; conditionConfig?: { days?: number; useCoolingDays?: boolean } };
    };
    expect(updateArg.data.active).toBe(false);
    expect(updateArg.data.conditionConfig?.days).toBe(10);
  });

  it('gatilho comum: excluir funciona normalmente', async () => {
    prismaMock.managerTrigger.findFirst.mockResolvedValue({
      ...defaultTrigger,
      id: 'trig-x',
      isDefault: false,
    } as never);
    prismaMock.managerTrigger.delete.mockResolvedValue({} as never);

    await expect(salesConfigService.deleteTrigger(tenantId, 'trig-x')).resolves.toEqual({
      deleted: true,
    });
    expect(prismaMock.managerTrigger.delete).toHaveBeenCalledWith({ where: { id: 'trig-x' } });
  });
});
