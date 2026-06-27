import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DealStage, CommercialRoadmapStatus } from '@prisma/client';
import { prismaMock } from '../helpers/prismaMock.js';

/**
 * Cobertura do desdobramento comercial (Definição de Concluído):
 *  - geração de uma Task por passo do playbook ao criar o roadmap;
 *  - vínculo roadmap → Deal ao avançar para "pedido de proposta" (criar novo
 *    ou reusar um Deal aberto, refletindo o status do roadmap).
 *
 * Os serviços irmãos são mockados para isolar a lógica do roadmapService.
 */
vi.mock('../../services/taskService.js', () => ({
  taskService: { create: vi.fn(async () => ({ id: 'task-x', dueDate: new Date() })) },
}));
vi.mock('../../services/dealService.js', () => ({
  dealService: {
    create: vi.fn(async () => ({ id: 'deal-new', stage: DealStage.PROPOSAL })),
    update: vi.fn(async () => ({ id: 'deal-open', stage: DealStage.PROPOSAL })),
  },
}));
vi.mock('../../services/googleCalendarService.js', () => ({
  googleCalendarService: { syncTaskForUser: vi.fn(async () => {}) },
}));

// eslint-disable-next-line import/first
import { roadmapService } from '../../services/roadmapService.js';
// eslint-disable-next-line import/first
import { taskService } from '../../services/taskService.js';
// eslint-disable-next-line import/first
import { dealService } from '../../services/dealService.js';

const tenantId = 'tenant-1';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lastArg = (fn: any) => fn.mock.calls[fn.mock.calls.length - 1];

// Limpa o histórico de chamadas dos mocks dos serviços irmãos entre os testes
// (o prismaMock já é resetado pelo helper). Mantém as implementações.
beforeEach(() => {
  vi.clearAllMocks();
});

describe('roadmapService.create — geração de ações pelo playbook', () => {
  it('cria uma Task por PlaybookStep, com type/roadmapId/companyId', async () => {
    prismaMock.company.findFirst.mockResolvedValue({ id: 'co1' } as never);
    prismaMock.commercialRoadmap.create.mockResolvedValue({
      id: 'rm1',
      companyId: 'co1',
      empreendimentoId: null,
      playbookTemplateId: 'pb1',
    } as never);
    prismaMock.playbookTemplate.findFirst.mockResolvedValue({
      id: 'pb1',
      steps: [
        { order: 1, title: 'Mapear decisores', actionType: 'LIGACAO', offsetDays: 0, priority: 'HIGH', description: null },
        { order: 2, title: 'Reunião', actionType: 'REUNIAO', offsetDays: 7, priority: 'MEDIUM', description: null },
        { order: 3, title: 'Pedido de proposta', actionType: 'PROPOSTA', offsetDays: 30, priority: 'URGENT', description: null },
      ],
    } as never);
    prismaMock.commercialRoadmap.findFirst.mockResolvedValue({ id: 'rm1', title: 'Acme' } as never);

    await roadmapService.create(tenantId, 'user-1', {
      title: 'Acme',
      companyId: 'co1',
      playbookTemplateId: 'pb1',
    });

    expect(taskService.create).toHaveBeenCalledTimes(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstStepArgs = (taskService.create as any).mock.calls[0][1];
    expect(firstStepArgs).toMatchObject({
      title: 'Mapear decisores',
      type: 'LIGACAO',
      roadmapId: 'rm1',
      companyId: 'co1',
    });
  });

  it('não gera nenhuma ação quando o roadmap não tem playbook', async () => {
    prismaMock.company.findFirst.mockResolvedValue({ id: 'co1' } as never);
    prismaMock.commercialRoadmap.create.mockResolvedValue({
      id: 'rm2',
      companyId: 'co1',
      empreendimentoId: null,
      playbookTemplateId: null,
    } as never);
    prismaMock.commercialRoadmap.findFirst.mockResolvedValue({ id: 'rm2', title: 'Sem playbook' } as never);

    await roadmapService.create(tenantId, 'user-1', { title: 'Sem playbook', companyId: 'co1' });

    expect(taskService.create).not.toHaveBeenCalled();
  });
});

describe('roadmapService.advanceToProposal — vínculo roadmap → Deal', () => {
  it('cria um Deal em PROPOSAL e reflete o status do roadmap quando não há Deal aberto', async () => {
    prismaMock.commercialRoadmap.findFirst.mockResolvedValue({
      id: 'rm1',
      dealId: null,
      companyId: 'co1',
      empreendimentoId: null,
      company: { id: 'co1', name: 'Acme' },
      empreendimento: null,
    } as never);
    prismaMock.deal.findFirst.mockResolvedValue(null as never);
    prismaMock.commercialRoadmap.update.mockResolvedValue({ id: 'rm1' } as never);

    await roadmapService.advanceToProposal(tenantId, 'rm1', 'user-1');

    expect(dealService.create).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dealArgs = (dealService.create as any).mock.calls[0][1];
    expect(dealArgs).toMatchObject({ stage: DealStage.PROPOSAL, companyId: 'co1' });

    const updateArgs = lastArg(prismaMock.commercialRoadmap.update)[0];
    expect(updateArgs.data).toMatchObject({
      dealId: 'deal-new',
      status: CommercialRoadmapStatus.PROPOSTA,
    });
  });

  it('reusa um Deal aberto existente em vez de criar um novo', async () => {
    prismaMock.commercialRoadmap.findFirst.mockResolvedValue({
      id: 'rm1',
      dealId: null,
      companyId: 'co1',
      empreendimentoId: null,
      company: { id: 'co1', name: 'Acme' },
      empreendimento: null,
    } as never);
    prismaMock.deal.findFirst.mockResolvedValue({ id: 'deal-open', stage: DealStage.QUALIFICATION } as never);
    prismaMock.commercialRoadmap.update.mockResolvedValue({ id: 'rm1' } as never);

    await roadmapService.advanceToProposal(tenantId, 'rm1', 'user-1');

    expect(dealService.create).not.toHaveBeenCalled();
    expect(dealService.update).toHaveBeenCalledWith(tenantId, {
      id: 'deal-open',
      stage: DealStage.PROPOSAL,
    });
  });
});

describe('roadmapService.getPanel — não deixar passar', () => {
  it('marca como em risco apenas roadmaps sem atividade recente', async () => {
    // overdue + upcoming (duas chamadas a task.findMany), nesta ordem.
    prismaMock.task.findMany.mockResolvedValueOnce([] as never).mockResolvedValueOnce([] as never);

    const stale = new Date('2020-01-01T00:00:00Z');
    const fresh = new Date();
    prismaMock.commercialRoadmap.findMany.mockResolvedValue([
      {
        id: 'parado',
        title: 'Parado',
        status: 'EM_ANDAMENTO',
        company: { id: 'co1', name: 'Acme' },
        empreendimento: null,
        tasks: [{ status: 'COMPLETED', completedAt: stale, dueDate: stale }],
      },
      {
        id: 'ativo',
        title: 'Ativo',
        status: 'EM_ANDAMENTO',
        company: { id: 'co2', name: 'Beta' },
        empreendimento: null,
        tasks: [{ status: 'COMPLETED', completedAt: fresh, dueDate: fresh }],
      },
    ] as never);

    const panel = await roadmapService.getPanel(tenantId);
    const atRiskIds = panel.atRisk.map((r) => r.id);
    expect(atRiskIds).toContain('parado');
    expect(atRiskIds).not.toContain('ativo');
  });
});
