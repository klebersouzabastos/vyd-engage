import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Upgrade RD parity — P2 (B1 fundação): storageService.
 *
 * Prova o contrato da abstração de armazenamento (provider "db"):
 *  - put respeita o limite do tenant → 422 STORAGE_LIMIT quando excede.
 *  - put dentro do limite cria o blob e o Attachment (source default UPLOAD).
 *  - get lê os bytes do AttachmentBlob (provider "db").
 *  - remove faz soft-delete (updateMany deletedAt).
 *  - usage retorna { usedMB, limitMB } (limitMB 0 = ilimitado).
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

const { resolveStorageLimitMBMock } = vi.hoisted(() => ({
  resolveStorageLimitMBMock: vi.fn(),
}));
vi.mock('../../services/planLimitsService.js', () => ({
  planLimitsService: { resolveStorageLimitMB: resolveStorageLimitMBMock },
}));

import prisma from '../../config/database.js';
import { storageService } from '../../services/storageService.js';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const MB = 1024 * 1024;

/** Primeiro argumento da primeira chamada (cast via unknown p/ contornar a
 * inferência de tupla do mockDeep sob strict). */
function firstCallArg(mockFn: unknown): any {
  const calls = (mockFn as { mock: { calls: unknown[][] } }).mock.calls;
  return calls[0]?.[0] ?? {};
}

beforeEach(() => {
  mockReset(prismaMock);
  resolveStorageLimitMBMock.mockReset();
});

describe('storageService.put — limite de armazenamento', () => {
  it('recusa com 422 STORAGE_LIMIT quando o arquivo estoura o limite do tenant', async () => {
    resolveStorageLimitMBMock.mockResolvedValue(50); // 50MB
    // Uso atual: 49.9MB; novo arquivo de 1MB estoura.
    prismaMock.attachment.aggregate.mockResolvedValue({ _sum: { size: 49.9 * MB } } as never);

    await expect(
      storageService.put('tenant-1', {
        name: 'grande.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(1 * MB),
      })
    ).rejects.toMatchObject({ statusCode: 422, code: 'STORAGE_LIMIT' });

    expect(prismaMock.attachment.create).not.toHaveBeenCalled();
  });

  it('cria blob + Attachment quando dentro do limite (source default UPLOAD)', async () => {
    resolveStorageLimitMBMock.mockResolvedValue(50);
    prismaMock.attachment.aggregate.mockResolvedValue({ _sum: { size: 0 } } as never);
    prismaMock.attachmentBlob.create.mockResolvedValue({ id: 'blob-1' } as never);
    prismaMock.attachment.create.mockResolvedValue({
      id: 'att-1',
      source: 'UPLOAD',
      storageProvider: 'db',
      storageKey: 'blob-1',
    } as never);

    const buffer = Buffer.from('conteúdo');
    const att = await storageService.put('tenant-1', {
      name: 'nota.txt',
      mimeType: 'text/plain',
      buffer,
    });

    expect(prismaMock.attachmentBlob.create).toHaveBeenCalledWith({ data: { data: buffer } });
    const createArg = firstCallArg(prismaMock.attachment.create).data as Record<string, unknown>;
    expect(createArg).toMatchObject({
      tenantId: 'tenant-1',
      name: 'nota.txt',
      size: buffer.length,
      storageProvider: 'db',
      storageKey: 'blob-1',
      source: 'UPLOAD',
    });
    expect(att.id).toBe('att-1');
  });

  it('não checa limite quando o plano é ilimitado (Infinity)', async () => {
    resolveStorageLimitMBMock.mockResolvedValue(Infinity);
    prismaMock.attachmentBlob.create.mockResolvedValue({ id: 'blob-2' } as never);
    prismaMock.attachment.create.mockResolvedValue({ id: 'att-2' } as never);

    await storageService.put('tenant-1', {
      name: 'x.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(10 * MB),
      source: 'PROPOSAL',
    });

    // Ilimitado → não soma o uso atual.
    expect(prismaMock.attachment.aggregate).not.toHaveBeenCalled();
    const createArg = firstCallArg(prismaMock.attachment.create).data as Record<string, unknown>;
    expect(createArg.source).toBe('PROPOSAL');
  });
});

describe('storageService.get — provider "db"', () => {
  it('lê os bytes do AttachmentBlob', async () => {
    prismaMock.attachmentBlob.findUnique.mockResolvedValue({
      id: 'blob-1',
      data: Buffer.from('olá'),
    } as never);

    const buf = await storageService.get({ storageProvider: 'db', storageKey: 'blob-1' });
    expect(buf.toString()).toBe('olá');
  });

  it('lança 404 quando o blob não existe', async () => {
    prismaMock.attachmentBlob.findUnique.mockResolvedValue(null as never);
    await expect(
      storageService.get({ storageProvider: 'db', storageKey: 'missing' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('storageService.remove — soft-delete', () => {
  it('marca deletedAt via updateMany escopado por tenant', async () => {
    prismaMock.attachment.updateMany.mockResolvedValue({ count: 1 } as never);
    await storageService.remove('tenant-1', 'att-1');
    const arg = firstCallArg(prismaMock.attachment.updateMany);
    expect(arg.where).toMatchObject({ id: 'att-1', tenantId: 'tenant-1', deletedAt: null });
    expect((arg.data as Record<string, unknown>).deletedAt).toBeInstanceOf(Date);
  });
});

describe('storageService.usage', () => {
  it('retorna usedMB e limitMB (0 = ilimitado)', async () => {
    prismaMock.attachment.aggregate.mockResolvedValue({ _sum: { size: 2 * MB } } as never);
    resolveStorageLimitMBMock.mockResolvedValue(Infinity);

    const usage = await storageService.usage('tenant-1');
    expect(usage.usedMB).toBe(2);
    expect(usage.limitMB).toBe(0);
  });

  it('retorna o limite finito quando o plano tem teto', async () => {
    prismaMock.attachment.aggregate.mockResolvedValue({ _sum: { size: 0 } } as never);
    resolveStorageLimitMBMock.mockResolvedValue(500);

    const usage = await storageService.usage('tenant-1');
    expect(usage).toEqual({ usedMB: 0, limitMB: 500 });
  });
});
