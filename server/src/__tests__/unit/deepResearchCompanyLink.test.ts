// `DeepResearch.companyId` existia no schema desde o desdobramento comercial,
// mas nunca era gravado: faltava no zod, no tipo do serviço e no create. Sem ele
// a pesquisa de Empresa não se liga à Company — pré-requisito de "Criar
// desdobramento" a partir da pesquisa e do censo → Empresas.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';

vi.mock('../../utils/logger.js', () => ({
  __esModule: true,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../services/deepResearch/deepResearchProvider.js', () => ({
  __esModule: true,
  getProvider: vi.fn(() => null),
}));
vi.mock('../../services/deepResearch/experienceContext.js', () => ({
  __esModule: true,
  buildExperienceContext: vi.fn(async () => null),
}));
vi.mock('../../services/deepResearch/templateService.js', () => ({
  __esModule: true,
  deepResearchTemplateService: { getRaw: vi.fn(async () => ({ promptBody: 'Pesquise [EMPRESA].' })) },
}));

import { deepResearchService } from '../../services/deepResearchService.js';

function createData() {
  const calls = prismaMock.deepResearch.create.mock.calls as unknown as Array<[{ data: Record<string, unknown> }]>;
  return calls[0][0].data;
}

beforeEach(() => {
  prismaMock.deepResearch.create.mockResolvedValue({ id: 'r1', status: 'DRAFT' } as never);
  prismaMock.deepResearch.findFirst.mockResolvedValue({ id: 'r1', status: 'DRAFT' } as never);
});

describe('deepResearchService.create — vínculo com a empresa', () => {
  it('grava companyId quando a empresa é do tenant', async () => {
    prismaMock.company.findFirst.mockResolvedValue({ id: 'co1' } as never);

    await deepResearchService.create('t1', 'u1', {
      title: 'Empresa: ACME',
      templateId: 'tpl',
      variables: { EMPRESA: 'ACME' },
      companyId: 'co1',
    });

    expect(createData().companyId).toBe('co1');
    const where = (prismaMock.company.findFirst.mock.calls as unknown as Array<[{ where: unknown }]>)[0][0].where;
    expect(where).toMatchObject({ id: 'co1', tenantId: 't1', deletedAt: null });
  });

  it('empresa de outro tenant (não encontrada) → 400 COMPANY_NOT_FOUND, sem criar', async () => {
    prismaMock.company.findFirst.mockResolvedValue(null as never);

    await expect(
      deepResearchService.create('t1', 'u1', { title: 'x', templateId: 'tpl', companyId: 'co-alheia' })
    ).rejects.toMatchObject({ code: 'COMPANY_NOT_FOUND' });
    expect(prismaMock.deepResearch.create).not.toHaveBeenCalled();
  });

  it('sem companyId, grava null e não consulta a empresa', async () => {
    await deepResearchService.create('t1', 'u1', { title: 'x', templateId: 'tpl' });

    expect(createData().companyId).toBeNull();
    expect(prismaMock.company.findFirst).not.toHaveBeenCalled();
  });
});

describe('deepResearchService.update — vínculo com a empresa', () => {
  it('companyId: null desfaz o vínculo; companyId válido religa', async () => {
    prismaMock.deepResearch.findFirst.mockResolvedValue({ id: 'r1', templateId: 'tpl', status: 'DRAFT' } as never);
    prismaMock.deepResearch.update.mockResolvedValue({} as never);
    prismaMock.company.findFirst.mockResolvedValue({ id: 'co2' } as never);

    await deepResearchService.update('t1', 'r1', { companyId: null });
    await deepResearchService.update('t1', 'r1', { companyId: 'co2' });

    const calls = prismaMock.deepResearch.update.mock.calls as unknown as Array<[{ data: Record<string, unknown> }]>;
    expect(calls[0][0].data.companyId).toBeNull();
    expect(calls[1][0].data.companyId).toBe('co2');
  });
});
