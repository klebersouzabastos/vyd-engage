import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DealStatus } from '@prisma/client';
import { prismaMock } from '../helpers/prismaMock.js';

/**
 * Gestão de Negócios (RD parity) — P0:
 *  - enforcement de campos obrigatórios por etapa ao avançar (reqs 4/10);
 *  - ações de status dedicadas: markWon/markLost (motivo obrigatório) (reqs 20-22).
 *
 * Mocka os serviços de efeito colateral (webhook/slack/socket/logger).
 */
vi.mock('../../services/webhookDispatcher.js', () => ({
  webhookDispatcher: { emitDealEvent: vi.fn() },
}));
vi.mock('../../services/slackService.js', () => ({
  notifyDealWon: vi.fn(async () => {}),
  notifyDealLost: vi.fn(async () => {}),
}));
vi.mock('../../services/socketService.js', () => ({ emitToTenant: vi.fn() }));
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { dealService } from '../../services/dealService.js';

const tenantId = 't1';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arg0 = (fn: any) => fn.mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('dealService.update — enforcement de campos obrigatórios por etapa', () => {
  it('bloqueia o avanço quando a etapa de destino tem campos obrigatórios vazios', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId,
      stage: 'QUALIFICATION',
      funnelColumnId: 'colA',
      customFields: {},
      closedAt: null,
      leadId: null,
    } as never);
    prismaMock.stageRequiredField.findMany.mockResolvedValue([
      { customField: { id: 'cf1', name: 'Escopo Geral' } },
    ] as never);

    await expect(
      dealService.update(tenantId, { id: 'd1', funnelColumnId: 'colB' })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'STAGE_REQUIRED_FIELDS_MISSING',
      details: { pendingFields: ['Escopo Geral'] },
    });
    expect(prismaMock.deal.update).not.toHaveBeenCalled();
  });

  it('permite o avanço quando os campos obrigatórios estão preenchidos', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId,
      stage: 'QUALIFICATION',
      funnelColumnId: 'colA',
      customFields: { 'Escopo Geral': 'preenchido' },
      closedAt: null,
      leadId: null,
    } as never);
    prismaMock.stageRequiredField.findMany.mockResolvedValue([
      { customField: { id: 'cf1', name: 'Escopo Geral' } },
    ] as never);
    prismaMock.deal.update.mockResolvedValue({
      id: 'd1',
      tenantId,
      stage: 'QUALIFICATION',
      funnelColumnId: 'colB',
      leadId: null,
    } as never);
    prismaMock.dealStageHistory.updateMany.mockResolvedValue({} as never);
    prismaMock.dealStageHistory.create.mockResolvedValue({} as never);
    prismaMock.stageTaskTemplate.findMany.mockResolvedValue([] as never);

    await expect(
      dealService.update(tenantId, { id: 'd1', funnelColumnId: 'colB' })
    ).resolves.toBeTruthy();
    expect(prismaMock.deal.update).toHaveBeenCalled();
  });
});

describe('dealService — ações de status (ganho/perda)', () => {
  it('markLost exige um motivo de perda válido do tenant (INVALID_LOST_REASON)', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({ id: 'd1', tenantId, deletedAt: null } as never);
    prismaMock.lostReason.findFirst.mockResolvedValue(null as never);

    await expect(dealService.markLost(tenantId, 'd1', 'inexistente')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_LOST_REASON',
    });
    expect(prismaMock.deal.update).not.toHaveBeenCalled();
  });

  it('markLost grava status LOST, lostAt e o rótulo do motivo', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({ id: 'd1', tenantId, deletedAt: null } as never);
    prismaMock.lostReason.findFirst.mockResolvedValue({ id: 'lr1', label: 'Preço' } as never);
    prismaMock.deal.update.mockResolvedValue({ id: 'd1', tenantId, leadId: null } as never);

    await dealService.markLost(tenantId, 'd1', 'lr1');
    const data = arg0(prismaMock.deal.update).data;
    expect(data.status).toBe(DealStatus.LOST);
    expect(data.lostReasonId).toBe('lr1');
    expect(data.lostReason).toBe('Preço');
    expect(data.lostAt).toBeInstanceOf(Date);
  });

  it('markWon define status WON e wonAt', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({ id: 'd1', tenantId, deletedAt: null } as never);
    prismaMock.deal.update.mockResolvedValue({ id: 'd1', tenantId, leadId: null } as never);

    await dealService.markWon(tenantId, 'd1');
    const data = arg0(prismaMock.deal.update).data;
    expect(data.status).toBe(DealStatus.WON);
    expect(data.wonAt).toBeInstanceOf(Date);
  });
});

describe('dealService.update — alinhamento status/wonAt/lostAt pela etapa (LACUNA #10/#12)', () => {
  it('transição para WON seta status WON e wonAt no updateData', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId,
      stage: 'NEGOTIATION',
      status: 'OPEN',
      funnelColumnId: 'colA',
      customFields: {},
      closedAt: null,
      wonAt: null,
      lostAt: null,
      companyId: null,
      leadId: null,
    } as never);
    prismaMock.deal.update.mockResolvedValue({
      id: 'd1',
      tenantId,
      stage: 'WON',
      leadId: null,
      companyId: null,
    } as never);
    prismaMock.dealStageHistory.updateMany.mockResolvedValue({} as never);
    prismaMock.dealStageHistory.create.mockResolvedValue({} as never);
    prismaMock.commercialRoadmap.updateMany.mockResolvedValue({} as never);

    await dealService.update(tenantId, { id: 'd1', stage: 'WON' as never });
    const data = arg0(prismaMock.deal.update).data;
    expect(data.status).toBe(DealStatus.WON);
    expect(data.wonAt).toBeInstanceOf(Date);
    expect(data.lostAt).toBeUndefined();
  });

  it('transição para LOST seta status LOST e lostAt no updateData', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId,
      stage: 'NEGOTIATION',
      status: 'OPEN',
      funnelColumnId: 'colA',
      customFields: {},
      closedAt: null,
      wonAt: null,
      lostAt: null,
      companyId: null,
      leadId: null,
    } as never);
    prismaMock.deal.update.mockResolvedValue({
      id: 'd1',
      tenantId,
      stage: 'LOST',
      leadId: null,
      companyId: null,
    } as never);
    prismaMock.dealStageHistory.updateMany.mockResolvedValue({} as never);
    prismaMock.dealStageHistory.create.mockResolvedValue({} as never);
    prismaMock.commercialRoadmap.updateMany.mockResolvedValue({} as never);

    await dealService.update(tenantId, { id: 'd1', stage: 'LOST' as never });
    const data = arg0(prismaMock.deal.update).data;
    expect(data.status).toBe(DealStatus.LOST);
    expect(data.lostAt).toBeInstanceOf(Date);
    expect(data.wonAt).toBeUndefined();
  });

  it('reabrir (WON → NEGOTIATION) volta status OPEN e limpa wonAt/lostAt', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId,
      stage: 'WON',
      status: 'WON',
      funnelColumnId: 'colA',
      customFields: {},
      closedAt: new Date(),
      wonAt: new Date(),
      lostAt: null,
      companyId: null,
      leadId: null,
    } as never);
    prismaMock.deal.update.mockResolvedValue({
      id: 'd1',
      tenantId,
      stage: 'NEGOTIATION',
      leadId: null,
      companyId: null,
    } as never);
    prismaMock.dealStageHistory.updateMany.mockResolvedValue({} as never);
    prismaMock.dealStageHistory.create.mockResolvedValue({} as never);

    await dealService.update(tenantId, { id: 'd1', stage: 'NEGOTIATION' as never });
    const data = arg0(prismaMock.deal.update).data;
    expect(data.status).toBe(DealStatus.OPEN);
    expect(data.wonAt).toBeNull();
    expect(data.lostAt).toBeNull();
    expect(data.closedAt).toBeNull();
  });

  it('re-salvar deal já GANHO (sem trocar etapa) não reescreve wonAt', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId,
      stage: 'WON',
      status: 'WON',
      funnelColumnId: 'colA',
      customFields: {},
      closedAt: new Date(),
      wonAt: new Date('2026-01-01'),
      lostAt: null,
      companyId: null,
      leadId: null,
    } as never);
    prismaMock.deal.update.mockResolvedValue({
      id: 'd1',
      tenantId,
      stage: 'WON',
      leadId: null,
      companyId: null,
    } as never);
    prismaMock.dealStageHistory.updateMany.mockResolvedValue({} as never);
    prismaMock.dealStageHistory.create.mockResolvedValue({} as never);

    await dealService.update(tenantId, { id: 'd1', notes: 'apenas nota' });
    const data = arg0(prismaMock.deal.update).data;
    // Sem transição de etapa: nada de status/wonAt/lostAt/closedAt no updateData.
    expect(data.status).toBeUndefined();
    expect(data.wonAt).toBeUndefined();
    expect(data.lostAt).toBeUndefined();
    expect(data.closedAt).toBeUndefined();
  });
});

describe('dealService.findAll — filtros server-side de Gestão de Negócios (LACUNA #1/#6)', () => {
  function mockList() {
    prismaMock.deal.findMany.mockResolvedValue([] as never);
    prismaMock.deal.count.mockResolvedValue(0 as never);
  }

  it('qualification aplica gte (semântica "N+ estrelas") no where', async () => {
    mockList();
    await dealService.findAll(tenantId, { qualification: 3 });
    const where = arg0(prismaMock.deal.findMany).where;
    expect(where.qualification).toEqual({ gte: 3 });
    expect(where.tenantId).toBe(tenantId);
  });

  it('sourceId e originCampaignId aplicam igualdade exata no where', async () => {
    mockList();
    await dealService.findAll(tenantId, {
      sourceId: 'src-1',
      originCampaignId: 'camp-1',
    });
    const where = arg0(prismaMock.deal.findMany).where;
    expect(where.sourceId).toBe('src-1');
    expect(where.originCampaignId).toBe('camp-1');
  });

  it('sem filtros de qualificação/fonte/campanha não adiciona as chaves', async () => {
    mockList();
    await dealService.findAll(tenantId, {});
    const where = arg0(prismaMock.deal.findMany).where;
    expect(where.qualification).toBeUndefined();
    expect(where.sourceId).toBeUndefined();
    expect(where.originCampaignId).toBeUndefined();
  });
});
