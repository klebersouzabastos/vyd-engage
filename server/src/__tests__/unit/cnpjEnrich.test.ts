import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Upgrade RD parity — P2 (B3): enriquecimento por CNPJ (req 20).
 *
 * Prova:
 *  - CNPJ inválido → 400 INVALID_CNPJ (sem chamar rede).
 *  - fetch mock (BrasilAPI) → diff campo a campo; NÃO grava (nenhum update/create).
 *  - compara com a empresa quando companyId é informado (current vs suggested).
 *  - só devolve campos com sugestão (sem ruído).
 */

vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));
vi.mock('../../utils/safeFetch.js', () => ({
  assertPublicHttpUrl: vi.fn(async (u: string) => new URL(u)),
}));

import prisma from '../../config/database.js';
import { cnpjService, normalizeCnpj } from '../../services/cnpjService.js';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const BRASILAPI = {
  razao_social: 'ACME INDUSTRIA LTDA',
  nome_fantasia: 'ACME',
  descricao_tipo_de_logradouro: 'RUA',
  logradouro: 'DAS FLORES',
  numero: '100',
  bairro: 'CENTRO',
  municipio: 'SAO PAULO',
  uf: 'SP',
  cep: '01000000',
  cnae_fiscal_descricao: 'Fabricação de artefatos',
  porte: 'DEMAIS',
};

beforeEach(() => {
  mockReset(prismaMock);
  vi.restoreAllMocks();
});

describe('normalizeCnpj', () => {
  it('remove máscara e mantém 14 dígitos', () => {
    expect(normalizeCnpj('12.345.678/0001-95')).toBe('12345678000195');
  });
  it('rejeita comprimento errado → 400', () => {
    expect(() => normalizeCnpj('123')).toThrowError();
    try {
      normalizeCnpj('123');
    } catch (e: any) {
      expect(e.statusCode).toBe(400);
      expect(e.code).toBe('INVALID_CNPJ');
    }
  });
});

describe('cnpjService.enrich', () => {
  it('CNPJ inválido → 400 sem chamar a rede', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    await expect(cnpjService.enrich('t1', '123')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_CNPJ',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retorna diff a partir da BrasilAPI e NÃO grava', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(BRASILAPI), { status: 200 })
    );

    const result = await cnpjService.enrich('t1', '12.345.678/0001-95');

    // Nenhuma escrita no banco.
    expect(prismaMock.company.update).not.toHaveBeenCalled();
    expect(prismaMock.company.create).not.toHaveBeenCalled();

    const byKey = Object.fromEntries(result.fields.map((f) => [f.key, f]));
    expect(byKey.name.suggested).toBe('ACME INDUSTRIA LTDA');
    expect(byKey.fantasyName.suggested).toBe('ACME');
    expect(byKey.industry.suggested).toBe('Fabricação de artefatos');
    expect(byKey.size.suggested).toBe('MEDIUM'); // "DEMAIS" → MEDIUM
    expect(byKey.address.suggested).toContain('SAO PAULO');
    // Sem companyId → current é null.
    expect(byKey.name.current).toBeNull();
  });

  it('compara com a empresa atual quando companyId é informado', async () => {
    prismaMock.company.findFirst.mockResolvedValue({
      name: 'Nome Antigo',
      fantasyName: null,
      address: null,
      industry: null,
      size: null,
    } as never);
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(BRASILAPI), { status: 200 })
    );

    const result = await cnpjService.enrich('t1', '12345678000195', 'comp-1');
    const name = result.fields.find((f) => f.key === 'name')!;
    expect(name.current).toBe('Nome Antigo');
    expect(name.suggested).toBe('ACME INDUSTRIA LTDA');
    expect(prismaMock.company.update).not.toHaveBeenCalled();
  });

  it('empresa de outro tenant → 404', async () => {
    prismaMock.company.findFirst.mockResolvedValue(null as never);
    await expect(cnpjService.enrich('t1', '12345678000195', 'comp-x')).rejects.toMatchObject({
      statusCode: 404,
      code: 'COMPANY_NOT_FOUND',
    });
  });

  // Rate limit / backoff (req 20): 429 persistente em AMBOS os provedores →
  // erro 429 CLARO (não mascarado como 502). Retry-After: 0 mantém o teste rápido.
  it('429 persistente → 429 CNPJ_RATE_LIMITED (não 502), com retry/backoff', async () => {
    const make429 = () =>
      new Response(JSON.stringify({ message: 'rate limit' }), {
        status: 429,
        headers: { 'retry-after': '0' },
      });
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async () => make429());

    await expect(cnpjService.enrich('t1', '12345678000195')).rejects.toMatchObject({
      statusCode: 429,
      code: 'CNPJ_RATE_LIMITED',
    });

    // Houve retry: >1 chamada por provedor (BrasilAPI: 1 inicial + MAX_RETRIES_429).
    // Total mínimo = (1+2) BrasilAPI + (1+2) ReceitaWS = 6.
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4);
  }, 20000);

  it('429 → fallback bem-sucedido no segundo provedor não vira erro', async () => {
    let call = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      call += 1;
      // BrasilAPI (1ª chamada) responde 429 esgotando retries; ReceitaWS responde OK.
      if (call <= 1 + 2) {
        return new Response('{}', { status: 429, headers: { 'retry-after': '0' } });
      }
      return new Response(
        JSON.stringify({ status: 'OK', nome: 'BETA LTDA', porte: 'MICRO EMPRESA' }),
        { status: 200 }
      );
    });

    const result = await cnpjService.enrich('t1', '12345678000195');
    const byKey = Object.fromEntries(result.fields.map((f) => [f.key, f]));
    expect(byKey.name.suggested).toBe('BETA LTDA');
    expect(byKey.size.suggested).toBe('MICRO');
  }, 20000);
});
