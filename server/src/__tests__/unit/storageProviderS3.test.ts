import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Upgrade RD parity — P2 (CF-B, req 22): seleção de provider por env (s3 vs db).
 *
 * Prova o GATING GRACIOSO do storageService:
 *  - STORAGE_S3_* configurado → provider "s3" (usa s3StorageProvider.putObject);
 *  - sem env → provider "db" (default, AttachmentBlob);
 *  - falha na escrita S3 → FALLBACK "db" (upload não quebra);
 *  - get lê do S3 quando provider="s3"; purgeBytes apaga blob "db" | objeto S3.
 * O client S3 é totalmente MOCKADO (sem conta/rede).
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));
vi.mock('../../services/planLimitsService.js', () => ({
  planLimitsService: { resolveStorageLimitMB: vi.fn().mockResolvedValue(Infinity) },
}));

// Mocka o provider S3 inteiro — sem SDK real, sem rede.
const s3Mock = vi.hoisted(() => ({
  isS3Configured: vi.fn(),
  putObject: vi.fn(),
  getObject: vi.fn(),
  removeObject: vi.fn(),
}));
vi.mock('../../services/s3StorageProvider.js', () => s3Mock);

import prisma from '../../config/database.js';
import { storageService } from '../../services/storageService.js';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

/** Primeiro argumento da primeira chamada de um mock (cast via unknown p/ o tsc). */
function firstCallArg(mockFn: unknown): any {
  const calls = (mockFn as { mock: { calls: unknown[][] } }).mock.calls;
  return calls[0]?.[0] ?? {};
}

beforeEach(() => {
  mockReset(prismaMock);
  s3Mock.isS3Configured.mockReset();
  s3Mock.putObject.mockReset();
  s3Mock.getObject.mockReset();
  s3Mock.removeObject.mockReset();
});

describe('storageService.put — seleção de provider por env (req 22)', () => {
  it('usa provider "s3" quando STORAGE_S3_* configurado', async () => {
    s3Mock.isS3Configured.mockReturnValue(true);
    s3Mock.putObject.mockResolvedValue('tenant-1/obj-key');
    prismaMock.attachment.create.mockResolvedValue({ id: 'att-s3' } as never);

    await storageService.put('tenant-1', {
      name: 'x.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('bytes'),
    });

    expect(s3Mock.putObject).toHaveBeenCalledWith(
      'tenant-1',
      'x.pdf',
      'application/pdf',
      expect.any(Buffer)
    );
    // NÃO cria blob "db" quando o S3 aceitou.
    expect(prismaMock.attachmentBlob.create).not.toHaveBeenCalled();
    const createArg = firstCallArg(prismaMock.attachment.create).data as Record<string, unknown>;
    expect(createArg.storageProvider).toBe('s3');
    expect(createArg.storageKey).toBe('tenant-1/obj-key');
  });

  it('usa provider "db" quando STORAGE_S3_* NÃO configurado (default, sem regressão)', async () => {
    s3Mock.isS3Configured.mockReturnValue(false);
    prismaMock.attachmentBlob.create.mockResolvedValue({ id: 'blob-9' } as never);
    prismaMock.attachment.create.mockResolvedValue({ id: 'att-db' } as never);

    await storageService.put('tenant-1', {
      name: 'y.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('bytes'),
    });

    expect(s3Mock.putObject).not.toHaveBeenCalled();
    expect(prismaMock.attachmentBlob.create).toHaveBeenCalled();
    const createArg = firstCallArg(prismaMock.attachment.create).data as Record<string, unknown>;
    expect(createArg.storageProvider).toBe('db');
    expect(createArg.storageKey).toBe('blob-9');
  });

  it('FALLBACK para "db" quando a escrita no S3 falha (upload não quebra)', async () => {
    s3Mock.isS3Configured.mockReturnValue(true);
    s3Mock.putObject.mockRejectedValue(new Error('S3 down'));
    prismaMock.attachmentBlob.create.mockResolvedValue({ id: 'blob-fb' } as never);
    prismaMock.attachment.create.mockResolvedValue({ id: 'att-fb' } as never);

    await storageService.put('tenant-1', {
      name: 'z.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('bytes'),
    });

    expect(prismaMock.attachmentBlob.create).toHaveBeenCalled();
    const createArg = firstCallArg(prismaMock.attachment.create).data as Record<string, unknown>;
    expect(createArg.storageProvider).toBe('db');
    expect(createArg.storageKey).toBe('blob-fb');
  });
});

describe('storageService.get — provider "s3"', () => {
  it('lê os bytes do S3 quando provider="s3" e configurado', async () => {
    s3Mock.isS3Configured.mockReturnValue(true);
    s3Mock.getObject.mockResolvedValue(Buffer.from('s3-bytes'));

    const buf = await storageService.get({ storageProvider: 's3', storageKey: 'k1' });
    expect(buf.toString()).toBe('s3-bytes');
    expect(s3Mock.getObject).toHaveBeenCalledWith('k1');
  });

  it('lança 500 S3_UNAVAILABLE quando o anexo é "s3" mas as env sumiram', async () => {
    s3Mock.isS3Configured.mockReturnValue(false);
    await expect(
      storageService.get({ storageProvider: 's3', storageKey: 'k2' })
    ).rejects.toMatchObject({ statusCode: 500, code: 'S3_UNAVAILABLE' });
  });
});

describe('storageService.purgeBytes — apaga os bytes no expurgo', () => {
  it('provider "db": deleta o AttachmentBlob', async () => {
    prismaMock.attachmentBlob.delete.mockResolvedValue({} as never);
    await storageService.purgeBytes({ storageProvider: 'db', storageKey: 'blob-x' });
    expect(prismaMock.attachmentBlob.delete).toHaveBeenCalledWith({ where: { id: 'blob-x' } });
  });

  it('provider "s3": remove o objeto quando configurado', async () => {
    s3Mock.isS3Configured.mockReturnValue(true);
    s3Mock.removeObject.mockResolvedValue(undefined);
    await storageService.purgeBytes({ storageProvider: 's3', storageKey: 'obj-x' });
    expect(s3Mock.removeObject).toHaveBeenCalledWith('obj-x');
    expect(prismaMock.attachmentBlob.delete).not.toHaveBeenCalled();
  });

  it('provider "db": idempotente quando o blob já sumiu (não relança)', async () => {
    prismaMock.attachmentBlob.delete.mockRejectedValue(new Error('not found'));
    await expect(
      storageService.purgeBytes({ storageProvider: 'db', storageKey: 'gone' })
    ).resolves.toBeUndefined();
  });
});
