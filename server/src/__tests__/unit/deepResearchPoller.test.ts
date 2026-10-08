// Limpeza de "travadas" do poller: não pode derrubar um run síncrono que ainda
// está vivo neste processo, e a janela precisa ser configurável — 20 min fixos
// eram menos que uma pesquisa de 11 capítulos com continuações.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

import { inFlightSyncRuns } from '../../services/deepResearchService.js';
import { pollPending } from '../../jobs/deepResearchPoller.js';

const UMA_HORA = 60 * 60 * 1000;

function whereDaLimpeza() {
  const calls = prismaMock.deepResearch.updateMany.mock.calls as unknown as Array<
    [{ where: { id?: unknown; OR: Array<{ requestedAt?: { lt: Date } }> } }]
  >;
  return calls[0][0].where;
}

beforeEach(() => {
  // Provider síncrono: pula o acompanhamento de jobs assíncronos e vai direto à limpeza.
  getProviderMock.mockReturnValue({ name: 'fake', isAsync: false, enabled: () => true, run: vi.fn() });
  prismaMock.deepResearch.updateMany.mockResolvedValue({ count: 0 } as never);
  inFlightSyncRuns.clear();
  delete process.env.DEEP_RESEARCH_STALE_AFTER_MS;
});
afterEach(() => {
  delete process.env.DEEP_RESEARCH_STALE_AFTER_MS;
});

describe('pollPending — limpeza de pesquisas travadas', () => {
  it('não marca como travada uma pesquisa com run síncrono em andamento neste processo', async () => {
    inFlightSyncRuns.add('em-andamento');

    await pollPending();

    expect(whereDaLimpeza().id).toEqual({ notIn: ['em-andamento'] });
  });

  it('janela padrão de "travada" é 60 min', async () => {
    const antes = Date.now();

    await pollPending();

    const cutoff = whereDaLimpeza().OR[0].requestedAt!.lt;
    const janela = antes - cutoff.getTime();
    expect(janela).toBeGreaterThanOrEqual(UMA_HORA - 100);
    expect(janela).toBeLessThan(UMA_HORA + 5000);
  });

  it('janela vem de DEEP_RESEARCH_STALE_AFTER_MS quando definida', async () => {
    process.env.DEEP_RESEARCH_STALE_AFTER_MS = String(5 * 60 * 1000);
    const antes = Date.now();

    await pollPending();

    const cutoff = whereDaLimpeza().OR[0].requestedAt!.lt;
    const janela = antes - cutoff.getTime();
    expect(janela).toBeGreaterThanOrEqual(5 * 60 * 1000 - 100);
    expect(janela).toBeLessThan(5 * 60 * 1000 + 5000);
  });
});
