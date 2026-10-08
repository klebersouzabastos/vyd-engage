// Bug real: o poller marcava FAILED aos 20 min uma pesquisa cujo run síncrono
// (chamada inicial + até 3 continuações) ainda estava rodando; depois o
// resultado chegava e `applyProviderResult` sobrescrevia para COMPLETED sem
// olhar o status — e um run ANTIGO, de antes de o usuário re-solicitar, também
// sobrescrevia o prompt novo. O contrato aqui: todo resultado carrega o token do
// run (`requestedAt` gravado no disparo) e só grava se o token ainda confere.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';

vi.mock('../../utils/logger.js', () => ({
  __esModule: true,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
const { getProviderMock } = vi.hoisted(() => ({ getProviderMock: vi.fn() }));
vi.mock('../../services/deepResearch/deepResearchProvider.js', () => ({
  __esModule: true,
  getProvider: getProviderMock,
}));

import { deepResearchService, inFlightSyncRuns } from '../../services/deepResearchService.js';

const COMPLETO = '## Capítulo 1 — Panorama\n\nTexto final.';

/** Chamadas a updateMany, tipadas de forma frouxa para inspeção. */
function updateManyCalls() {
  return prismaMock.deepResearch.updateMany.mock.calls as unknown as Array<
    [{ where: Record<string, unknown>; data: Record<string, unknown> }]
  >;
}

beforeEach(() => {
  getProviderMock.mockReturnValue(null); // sem provider → sem continuação
  inFlightSyncRuns.clear();
  // prompt vazio → outline vazio → nada "faltando"
  prismaMock.deepResearch.findUnique.mockResolvedValue({ promptUsed: '' } as never);
});

describe('applyProviderResult — token de run', () => {
  it('grava COMPLETED condicionado ao token: where carrega id + requestedAt', async () => {
    const token = new Date('2026-10-07T10:00:00.000Z');
    prismaMock.deepResearch.updateMany.mockResolvedValue({ count: 1 } as never);

    await deepResearchService.applyProviderResult('r1', { markdown: COMPLETO }, { requestedAt: token });

    expect(prismaMock.deepResearch.updateMany).toHaveBeenCalledTimes(1);
    const [{ where, data }] = updateManyCalls()[0];
    expect(where).toMatchObject({ id: 'r1', requestedAt: token });
    expect(data.status).toBe('COMPLETED');
    expect(data.reportMarkdown).toBe(COMPLETO);
  });

  it('resultado órfão (token já não confere) é descartado sem tocar na pesquisa', async () => {
    prismaMock.deepResearch.updateMany.mockResolvedValue({ count: 0 } as never);

    await deepResearchService.applyProviderResult(
      'r1',
      { markdown: COMPLETO },
      { requestedAt: new Date('2026-01-01T00:00:00.000Z') }
    );

    // O único acesso de escrita é o updateMany condicional; sem fallback cego.
    expect(prismaMock.deepResearch.update).not.toHaveBeenCalled();
    expect(prismaMock.deepResearch.updateMany).toHaveBeenCalledTimes(1);
  });

  it('falha do provider só derruba pesquisa ainda RESEARCHING e com o token do run', async () => {
    const token = new Date('2026-10-07T10:00:00.000Z');
    prismaMock.deepResearch.updateMany.mockResolvedValue({ count: 0 } as never);

    await deepResearchService.applyProviderResult(
      'r1',
      { failed: true, error: 'boom' },
      { requestedAt: token }
    );

    expect(prismaMock.deepResearch.update).not.toHaveBeenCalled();
    const [{ where, data }] = updateManyCalls()[0];
    expect(where).toMatchObject({ id: 'r1', status: 'RESEARCHING', requestedAt: token });
    expect(data.status).toBe('FAILED');
  });
});

describe('maybeTrigger — registro in-flight do run síncrono', () => {
  it('mantém o id em inFlightSyncRuns enquanto o run roda e remove ao aplicar o resultado', async () => {
    let resolveRun!: (v: unknown) => void;
    getProviderMock.mockReturnValue({
      name: 'fake',
      isAsync: false,
      enabled: () => true,
      run: () => new Promise((r) => (resolveRun = r)),
    });
    prismaMock.deepResearch.findFirst.mockResolvedValue({
      id: 'r1',
      status: 'RESEARCHING',
      promptUsed: 'Pesquise.',
      providerResponseId: null,
    } as never);
    prismaMock.deepResearch.update.mockResolvedValue({} as never);
    prismaMock.deepResearch.updateMany.mockResolvedValue({ count: 1 } as never);

    await deepResearchService.maybeTrigger('t1', 'r1');
    expect(inFlightSyncRuns.has('r1')).toBe(true);

    resolveRun({ status: 'completed', markdown: COMPLETO, sources: [], searchResults: [] });
    await new Promise((r) => setTimeout(r, 0));

    expect(inFlightSyncRuns.has('r1')).toBe(false);
  });
});
