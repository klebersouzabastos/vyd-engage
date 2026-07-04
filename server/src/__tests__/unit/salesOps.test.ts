import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationType, ScheduledDealStatus } from '@prisma/client';
import { prismaMock } from '../helpers/prismaMock.js';

/**
 * Upgrade RD parity — P0 (job salesOps):
 *  - multi-vendas: agendamentos PENDING vencidos criam Deal + notificação
 *    MULTI_SALE_CREATED, respeitando o toggle Tenant.settings.multiSalesEnabled;
 *  - gatilho DEFAULT "Negociações esfriando": semântica IDÊNTICA ao staleDeals
 *    (DEAL_AT_RISK, metadata { dealId }, socket 'deal:at-risk', dedup por janela).
 */
vi.mock('../../services/socketService.js', () => ({ emitToTenant: vi.fn() }));
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/dealService.js', () => ({
  dealService: { create: vi.fn() },
}));

import { emitToTenant } from '../../services/socketService.js';
import { dealService } from '../../services/dealService.js';
import {
  runScheduledDeals,
  runManagerTriggers,
  ensureDefaultTriggers,
} from '../../jobs/salesOps.js';

const tenantId = 't1';
const NOW = new Date('2026-07-04T12:00:00.000Z');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arg0 = (fn: any, call = 0) => fn.mock.calls[call][0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runScheduledDeals — multi-vendas vencidas', () => {
  const dueScheduled = {
    id: 'sd1',
    tenantId,
    originDealId: 'origin-1',
    companyId: 'c1',
    leadId: null,
    type: 'POS_VENDA',
    scheduledFor: new Date('2026-07-01T00:00:00.000Z'),
    funnelId: 'f1',
    funnelColumnId: 'fc1',
    estimatedValue: 1500,
    assignedTo: 'u1',
    notes: 'Renovação anual',
    status: ScheduledDealStatus.PENDING,
  };

  it('cria o deal, marca CREATED e notifica MULTI_SALE_CREATED quando o toggle está ligado', async () => {
    prismaMock.scheduledDeal.findMany.mockResolvedValue([dueScheduled] as never);
    prismaMock.tenant.findUnique.mockResolvedValue({
      settings: { multiSalesEnabled: true },
    } as never);
    prismaMock.company.findFirst.mockResolvedValue({ name: 'ACME Ltda' } as never);
    prismaMock.scheduledDeal.update.mockResolvedValue({} as never);
    prismaMock.notification.create.mockResolvedValue({} as never);
    (dealService.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'new-deal',
      name: 'Pós-venda — ACME Ltda',
    });

    const created = await runScheduledDeals(NOW);

    expect(created).toBe(1);
    const createArg = (dealService.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(createArg[0]).toBe(tenantId);
    expect(createArg[1]).toMatchObject({
      name: 'Pós-venda — ACME Ltda',
      value: 1500,
      companyId: 'c1',
      assignedTo: 'u1',
      funnelId: 'f1',
      funnelColumnId: 'fc1',
    });
    expect(arg0(prismaMock.scheduledDeal.update)).toMatchObject({
      where: { id: 'sd1' },
      data: { status: ScheduledDealStatus.CREATED, createdDealId: 'new-deal' },
    });
    const notif = arg0(prismaMock.notification.create).data;
    expect(notif.type).toBe(NotificationType.MULTI_SALE_CREATED);
    expect(notif.userId).toBe('u1');
    expect(notif.metadata).toMatchObject({ scheduledDealId: 'sd1', dealId: 'new-deal' });
  });

  it('mantém PENDING (não cria nada) quando multiSalesEnabled está desligado', async () => {
    prismaMock.scheduledDeal.findMany.mockResolvedValue([dueScheduled] as never);
    prismaMock.tenant.findUnique.mockResolvedValue({ settings: {} } as never);

    const created = await runScheduledDeals(NOW);

    expect(created).toBe(0);
    expect(dealService.create).not.toHaveBeenCalled();
    expect(prismaMock.scheduledDeal.update).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});

describe('runManagerTriggers — gatilho padrão "Negociações esfriando"', () => {
  const defaultTrigger = {
    id: 'mt-default',
    tenantId,
    name: 'Negociações esfriando',
    conditionType: 'NO_INTERACTION',
    conditionConfig: { useCoolingDays: true },
    notifyOwner: true,
    notifyManagers: false,
    notifyUserIds: [],
    emailEnabled: false,
    active: true,
    isDefault: true,
  };

  function mockBaseline() {
    prismaMock.tenant.findMany.mockResolvedValue([{ id: tenantId, staleDays: 5 }] as never);
    // ensureDefaultTriggers encontra o gatilho já semeado
    prismaMock.managerTrigger.findFirst.mockResolvedValue({ id: 'mt-default' } as never);
    prismaMock.managerTrigger.findMany.mockResolvedValue([defaultTrigger] as never);
    prismaMock.deal.findMany.mockResolvedValue([
      { id: 'd1', name: 'Projeto X', assignedTo: 'u1', funnelColumn: null },
    ] as never);
    prismaMock.interaction.findMany.mockResolvedValue([] as never); // nunca interagido
    prismaMock.notification.create.mockResolvedValue({} as never);
  }

  it('emite DEAL_AT_RISK com o MESMO shape do staleDeals (metadata { dealId } + socket deal:at-risk)', async () => {
    mockBaseline();
    prismaMock.notification.findMany.mockResolvedValue([] as never); // dedup vazio

    const created = await runManagerTriggers(NOW);

    expect(created).toBe(1);
    const notif = arg0(prismaMock.notification.create).data;
    expect(notif).toMatchObject({
      tenantId,
      userId: 'u1',
      type: NotificationType.DEAL_AT_RISK,
      title: 'Deal em risco',
      message: 'O deal "Projeto X" está sem atividade há 5 dias.',
      link: '/app/deals/d1',
      metadata: { dealId: 'd1' }, // shape EXATO do staleDeals — sem managerTriggerId
    });
    expect(emitToTenant).toHaveBeenCalledWith(tenantId, 'deal:at-risk', {
      dealId: 'd1',
      dealName: 'Projeto X',
      daysSinceActivity: 5,
    });
  });

  it('deduplica por Notification.metadata.dealId dentro da janela (sem nova notificação)', async () => {
    mockBaseline();
    prismaMock.notification.findMany.mockResolvedValue([
      { metadata: { dealId: 'd1' } },
    ] as never);

    const created = await runManagerTriggers(NOW);

    expect(created).toBe(0);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    expect(emitToTenant).not.toHaveBeenCalled();
  });

  it('usa os coolingDays da etapa quando habilitados (deal recente não alerta)', async () => {
    mockBaseline();
    prismaMock.notification.findMany.mockResolvedValue([] as never);
    // Última interação há 8 dias; coluna esfria em 10 → NÃO está frio.
    prismaMock.deal.findMany.mockResolvedValue([
      {
        id: 'd1',
        name: 'Projeto X',
        assignedTo: 'u1',
        funnelColumn: { coolingEnabled: true, coolingDays: 10 },
      },
    ] as never);
    prismaMock.interaction.findMany.mockResolvedValue([
      { dealId: 'd1', createdAt: new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000) },
    ] as never);

    const created = await runManagerTriggers(NOW);

    expect(created).toBe(0);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});

describe('ensureDefaultTriggers — semeadura do gatilho padrão', () => {
  it('cria "Negociações esfriando" (isDefault, useCoolingDays) quando não existe', async () => {
    prismaMock.managerTrigger.findFirst.mockResolvedValue(null as never);
    prismaMock.managerTrigger.create.mockResolvedValue({ id: 'mt-new' } as never);

    const id = await ensureDefaultTriggers(tenantId);

    expect(id).toBe('mt-new');
    expect(arg0(prismaMock.managerTrigger.create).data).toMatchObject({
      tenantId,
      name: 'Negociações esfriando',
      conditionType: 'NO_INTERACTION',
      conditionConfig: { useCoolingDays: true },
      notifyOwner: true,
      isDefault: true,
      active: true,
    });
  });

  it('é idempotente quando o gatilho padrão já existe', async () => {
    prismaMock.managerTrigger.findFirst.mockResolvedValue({ id: 'mt-default' } as never);

    const id = await ensureDefaultTriggers(tenantId);

    expect(id).toBe('mt-default');
    expect(prismaMock.managerTrigger.create).not.toHaveBeenCalled();
  });
});
