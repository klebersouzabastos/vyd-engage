// O prompt é montado no servidor (IP da plataforma). Aqui garantimos que a
// montagem anexa o bloco de experiências do acervo quando ele existe, com a
// consulta derivada dos valores preenchidos pelo usuário.
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
const { buildExperienceContextMock, getRawMock } = vi.hoisted(() => ({
  buildExperienceContextMock: vi.fn(),
  getRawMock: vi.fn(),
}));
vi.mock('../../services/deepResearch/experienceContext.js', () => ({
  __esModule: true,
  buildExperienceContext: buildExperienceContextMock,
}));
vi.mock('../../services/deepResearch/templateService.js', () => ({
  __esModule: true,
  deepResearchTemplateService: { getRaw: getRawMock },
}));

import { deepResearchService } from '../../services/deepResearchService.js';

const BLOCO = '## Experiências da consultoria (TENAX)\n- Vale — Projeto básico (2025)';

/** promptUsed enviado ao create, tipado de forma frouxa para inspeção. */
function promptUsedGravado(): string {
  const calls = prismaMock.deepResearch.create.mock.calls as unknown as Array<
    [{ data: { promptUsed: string } }]
  >;
  return calls[0][0].data.promptUsed;
}

beforeEach(() => {
  getRawMock.mockResolvedValue({ promptBody: 'Pesquise [SEGMENTO] em [REGIÃO].' });
  prismaMock.deepResearch.create.mockResolvedValue({ id: 'r1', status: 'DRAFT' } as never);
  prismaMock.deepResearch.findFirst.mockResolvedValue({ id: 'r1', status: 'DRAFT' } as never);
});

describe('deepResearchService.create — prompt com experiências', () => {
  it('anexa o bloco de experiências ao promptUsed, consultando o acervo com os valores preenchidos', async () => {
    buildExperienceContextMock.mockResolvedValue(BLOCO);

    await deepResearchService.create('t1', 'u1', {
      title: 'x',
      templateId: 'tpl',
      variables: { SEGMENTO: 'lítio', REGIÃO: 'Minas Gerais', 'Contexto adicional': 'foco em 2026' },
    });

    const [tenantId, query] = buildExperienceContextMock.mock.calls[0]!;
    expect(tenantId).toBe('t1');
    expect(query).toContain('lítio');
    expect(query).toContain('Minas Gerais');
    expect(query).not.toContain('foco em 2026');

    const promptUsed = promptUsedGravado();
    expect(promptUsed).toContain('Pesquise lítio em Minas Gerais.');
    expect(promptUsed).toContain('## Contexto adicional informado\nfoco em 2026');
    expect(promptUsed.endsWith(BLOCO)).toBe(true);
  });

  it('sem acervo (null) o prompt fica exatamente como antes', async () => {
    buildExperienceContextMock.mockResolvedValue(null);

    await deepResearchService.create('t1', 'u1', {
      title: 'x',
      templateId: 'tpl',
      variables: { SEGMENTO: 'lítio', REGIÃO: 'MG' },
    });

    expect(promptUsedGravado()).toBe('Pesquise lítio em MG.');
  });
});
