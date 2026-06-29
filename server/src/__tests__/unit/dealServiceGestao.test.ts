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
