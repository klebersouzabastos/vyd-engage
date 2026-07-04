import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';

/**
 * Upgrade RD parity — P1 (CF-1a): enforcement de VISIBILIDADE viva + capabilities
 * por-entidade nos SERVICES de dados que eu possuo (companyService/leadService
 * findAll) e no núcleo de permissões.
 *
 * FOCO EM NÃO-REGRESSÃO (BYTE-A-BYTE == HOJE):
 *  - findAll SEM ownerScope (undefined) → NENHUM filtro por `assignedTo`
 *    (companies/contacts GERAL nos builtins → idêntico a hoje).
 *  - findAll COM ownerScope string (PROPRIA) → filtra por aquele dono.
 *  - findAll COM ownerScope {in} (EQUIPE) → filtra pelo conjunto da equipe.
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { companyService } from '../../services/companyService.js';
import { leadService } from '../../services/leadService.js';

const tenantId = 't1';

beforeEach(() => {
  vi.clearAllMocks();
});

/** Retorna o `where` da primeira chamada de um findMany mockado. */
function findManyWhere(mockFn: unknown): Record<string, unknown> {
  const calls = (mockFn as { mock: { calls: unknown[][] } }).mock.calls;
  return (calls[0]?.[0] as { where: Record<string, unknown> })?.where ?? {};
}

describe('companyService.findAll — escopo de dono (req 14, == HOJE)', () => {
  beforeEach(() => {
    prismaMock.company.findMany.mockResolvedValue([] as never);
    prismaMock.company.count.mockResolvedValue(0 as never);
  });

  it('SEM ownerScope (undefined) → NENHUM filtro por assignedTo (idêntico a hoje)', async () => {
    await companyService.findAll(tenantId, {}, undefined);
    const where = findManyWhere(prismaMock.company.findMany);
    expect(where).toMatchObject({ tenantId, deletedAt: null });
    expect(where.assignedTo).toBeUndefined();
  });

  it('COM ownerScope string (PROPRIA) → filtra por aquele dono', async () => {
    await companyService.findAll(tenantId, {}, 'u1');
    const where = findManyWhere(prismaMock.company.findMany);
    expect(where.assignedTo).toBe('u1');
  });

  it('COM ownerScope {in} (EQUIPE) → filtra pelo conjunto da equipe', async () => {
    await companyService.findAll(tenantId, {}, { in: ['u1', 'u2'] });
    const where = findManyWhere(prismaMock.company.findMany);
    expect(where.assignedTo).toEqual({ in: ['u1', 'u2'] });
  });
});

describe('leadService.findAll — escopo de dono (req 14, == HOJE)', () => {
  beforeEach(() => {
    prismaMock.lead.findMany.mockResolvedValue([] as never);
    prismaMock.lead.count.mockResolvedValue(0 as never);
  });

  it('SEM ownerScope (undefined) → NENHUM filtro por assignedTo (idêntico a hoje)', async () => {
    await leadService.findAll(tenantId, {}, undefined);
    const where = findManyWhere(prismaMock.lead.findMany);
    expect(where).toMatchObject({ tenantId, deletedAt: null });
    expect(where.assignedTo).toBeUndefined();
  });

  it('COM ownerScope string (PROPRIA) → filtra por aquele dono (substitui o assignedTo bruto)', async () => {
    // Mesmo que o cliente peça um assignedTo, o escopo de visibilidade prevalece.
    await leadService.findAll(tenantId, { assignedTo: 'outro' }, 'u1');
    const where = findManyWhere(prismaMock.lead.findMany);
    expect(where.assignedTo).toBe('u1');
  });

  it('COM ownerScope {in} (EQUIPE) → filtra pelo conjunto da equipe', async () => {
    await leadService.findAll(tenantId, {}, { in: ['u1', 'u2', 'u3'] });
    const where = findManyWhere(prismaMock.lead.findMany);
    expect(where.assignedTo).toEqual({ in: ['u1', 'u2', 'u3'] });
  });

  it('SEM ownerScope mas COM assignedTo bruto (manager pediu) → usa o assignedTo bruto', async () => {
    await leadService.findAll(tenantId, { assignedTo: 'someone' }, undefined);
    const where = findManyWhere(prismaMock.lead.findMany);
    expect(where.assignedTo).toBe('someone');
  });
});
