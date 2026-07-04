import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduledDealStatus } from '@prisma/client';
import { prismaMock } from '../helpers/prismaMock.js';

/**
 * Upgrade RD parity — P0 (multi-vendas, spec req 4):
 *  - criação valida o deal de origem no tenant e herda companyId/leadId/responsável;
 *  - datas no passado são aceitas (job cria na próxima varredura);
 *  - cancelamento só de agendamentos PENDING, com escopo de analista.
 */
import { scheduledDealService } from '../../services/scheduledDealService.js';

const tenantId = 't1';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arg0 = (fn: any) => fn.mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('scheduledDealService.create', () => {
  it('rejeita quando o deal de origem não pertence ao tenant (404)', async () => {
    prismaMock.deal.findFirst.mockResolvedValue(null as never);

    await expect(
      scheduledDealService.create(tenantId, 'u1', {
        originDealId: 'de-outro-tenant',
        type: 'CROSS_SELL',
        scheduledFor: '2026-08-01T00:00:00.000Z',
      })
    ).rejects.toMatchObject({ statusCode: 404, code: 'DEAL_NOT_FOUND' });
    expect(prismaMock.scheduledDeal.create).not.toHaveBeenCalled();
  });

  it('herda companyId/leadId/responsável do deal de origem e aceita data no passado', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      id: 'origin-1',
      companyId: 'c1',
      leadId: 'l1',
      assignedTo: 'owner-1',
    } as never);
    prismaMock.scheduledDeal.create.mockResolvedValue({ id: 'sd1' } as never);

    const past = '2020-01-01T00:00:00.000Z'; // criada na próxima varredura do job
    await scheduledDealService.create(tenantId, 'creator-1', {
      originDealId: 'origin-1',
      type: 'RECOMPRA',
      scheduledFor: past,
      estimatedValue: 900,
      notes: 'Recompra semestral',
    });

    const data = arg0(prismaMock.scheduledDeal.create).data;
    expect(data).toMatchObject({
      tenantId,
      originDealId: 'origin-1',
      companyId: 'c1',
      leadId: 'l1',
      type: 'RECOMPRA',
      estimatedValue: 900,
      assignedTo: 'owner-1', // padrão: mesmo responsável do deal de origem
      createdById: 'creator-1',
    });
    expect(data.status).toBeUndefined(); // default PENDING vem do schema
    expect(data.scheduledFor).toEqual(new Date(past));
  });

  it('rejeita data de agendamento inválida (400)', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      id: 'origin-1',
      companyId: null,
      leadId: null,
      assignedTo: null,
    } as never);

    await expect(
      scheduledDealService.create(tenantId, 'u1', {
        originDealId: 'origin-1',
        type: 'OUTRO',
        scheduledFor: 'não-é-data',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.scheduledDeal.create).not.toHaveBeenCalled();
  });
});

describe('scheduledDealService.cancel', () => {
  it('cancela agendamento PENDING do tenant', async () => {
    prismaMock.scheduledDeal.findFirst.mockResolvedValue({
      id: 'sd1',
      tenantId,
      status: ScheduledDealStatus.PENDING,
    } as never);
    prismaMock.scheduledDeal.update.mockResolvedValue({
      id: 'sd1',
      status: ScheduledDealStatus.CANCELLED,
    } as never);

    const result = await scheduledDealService.cancel(tenantId, 'sd1');

    expect(result.status).toBe(ScheduledDealStatus.CANCELLED);
    expect(arg0(prismaMock.scheduledDeal.update)).toMatchObject({
      where: { id: 'sd1' },
      data: { status: ScheduledDealStatus.CANCELLED },
    });
  });

  it('recusa cancelar agendamento já CREATED (400 SCHEDULED_DEAL_NOT_PENDING)', async () => {
    prismaMock.scheduledDeal.findFirst.mockResolvedValue({
      id: 'sd1',
      tenantId,
      status: ScheduledDealStatus.CREATED,
    } as never);

    await expect(scheduledDealService.cancel(tenantId, 'sd1')).rejects.toMatchObject({
      statusCode: 400,
      code: 'SCHEDULED_DEAL_NOT_PENDING',
    });
    expect(prismaMock.scheduledDeal.update).not.toHaveBeenCalled();
  });

  it('analista só cancela agendamentos em que é o responsável (escopo no where)', async () => {
    prismaMock.scheduledDeal.findFirst.mockResolvedValue(null as never);

    await expect(scheduledDealService.cancel(tenantId, 'sd1', 'analista-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'SCHEDULED_DEAL_NOT_FOUND',
    });
    expect(arg0(prismaMock.scheduledDeal.findFirst).where).toMatchObject({
      id: 'sd1',
      tenantId,
      assignedTo: 'analista-1',
    });
  });
});
