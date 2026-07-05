import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';

/**
 * Upgrade RD parity — P2 (CF-B, req 22): anexos na Lixeira + expurgo dos bytes.
 *
 * Prova a integração dos anexos ao trashService:
 *  - list: anexos soft-deletados aparecem (label=name, autor via uploadedById);
 *  - restore: deletedAt=null (404 se não estiver na lixeira);
 *  - purge (item único): apaga os BYTES (storageService.purgeBytes) + o metadado;
 *  - purgeExpiredForEntity: expurga > cutoff, apagando bytes de cada anexo;
 *  - ALL_TRASH_ENTITIES inclui attachments; TRASH_ENTITIES (approvalService) NÃO.
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// storageService.purgeBytes é o efeito colateral que apaga blob "db" | objeto S3.
const purgeBytesMock = vi.hoisted(() => vi.fn());
vi.mock('../../services/storageService.js', () => ({
  storageService: { purgeBytes: purgeBytesMock },
}));

import {
  listTrash,
  restoreItem,
  purgeItem,
  purgeExpiredForEntity,
  TRASH_ENTITIES,
  ALL_TRASH_ENTITIES,
  isTrashEntity,
  isAnyTrashEntity,
  ATTACHMENTS_ENTITY,
} from '../../services/trashService.js';

const tenantId = 't1';

/** Primeiro argumento da primeira chamada de um mock (cast via unknown p/ o tsc). */
function firstCallArg(mockFn: unknown): any {
  const calls = (mockFn as { mock: { calls: unknown[][] } }).mock.calls;
  return calls[0]?.[0] ?? {};
}

beforeEach(() => {
  vi.clearAllMocks();
  purgeBytesMock.mockResolvedValue(undefined);
});

describe('registro de entidades', () => {
  it('ALL_TRASH_ENTITIES inclui attachments; TRASH_ENTITIES (approvalService) NÃO', () => {
    expect(ALL_TRASH_ENTITIES).toContain('attachments');
    expect(TRASH_ENTITIES).not.toContain('attachments');
  });

  it('isAnyTrashEntity aceita attachments; isTrashEntity (estrita) NÃO', () => {
    expect(isAnyTrashEntity('attachments')).toBe(true);
    expect(isTrashEntity('attachments')).toBe(false);
    expect(isTrashEntity('leads')).toBe(true);
  });
});

describe('listTrash("attachments")', () => {
  it('lista anexos na lixeira com label=name e autor via uploadedById', async () => {
    prismaMock.attachment.findMany.mockResolvedValue([
      { id: 'a1', name: 'nota.pdf', deletedAt: new Date(), uploadedById: 'u1', createdAt: new Date() },
    ] as never);
    prismaMock.attachment.count.mockResolvedValue(1 as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'Ana', email: 'ana@x.com' },
    ] as never);

    const res = await listTrash(tenantId, ATTACHMENTS_ENTITY, 1);

    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({
      id: 'a1',
      entity: 'attachments',
      label: 'nota.pdf',
    });
    expect(res.items[0].deletedBy).toMatchObject({ id: 'u1', name: 'Ana' });
    // Query filtra por tenant e deletedAt != null.
    const arg = firstCallArg(prismaMock.attachment.findMany) as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({ tenantId, deletedAt: { not: null } });
  });
});

describe('restoreItem("attachments")', () => {
  it('restaura (deletedAt=null) via updateMany tenant-scoped', async () => {
    prismaMock.attachment.updateMany.mockResolvedValue({ count: 1 } as never);
    await restoreItem(tenantId, ATTACHMENTS_ENTITY, 'a1');
    const arg = firstCallArg(prismaMock.attachment.updateMany) as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toMatchObject({ id: 'a1', tenantId, deletedAt: { not: null } });
    expect(arg.data).toEqual({ deletedAt: null });
  });

  it('404 quando o anexo não está na lixeira', async () => {
    prismaMock.attachment.updateMany.mockResolvedValue({ count: 0 } as never);
    await expect(restoreItem(tenantId, ATTACHMENTS_ENTITY, 'nope')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('purgeItem("attachments") — apaga os bytes + metadado', () => {
  it('chama purgeBytes(provider,key) e depois deleta o Attachment', async () => {
    prismaMock.attachment.findFirst.mockResolvedValue({
      id: 'a1',
      storageProvider: 'db',
      storageKey: 'blob-1',
    } as never);
    prismaMock.attachment.delete.mockResolvedValue({} as never);

    await purgeItem(tenantId, ATTACHMENTS_ENTITY, 'a1');

    expect(purgeBytesMock).toHaveBeenCalledWith(
      expect.objectContaining({ storageProvider: 'db', storageKey: 'blob-1' })
    );
    expect(prismaMock.attachment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });

  it('404 quando o anexo não está na lixeira (não apaga nada)', async () => {
    prismaMock.attachment.findFirst.mockResolvedValue(null as never);
    await expect(purgeItem(tenantId, ATTACHMENTS_ENTITY, 'x')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(purgeBytesMock).not.toHaveBeenCalled();
    expect(prismaMock.attachment.delete).not.toHaveBeenCalled();
  });
});

describe('purgeExpiredForEntity("attachments") — job >30d', () => {
  it('expurga cada anexo stale: bytes + metadado; só deletedAt < cutoff', async () => {
    const cutoff = new Date('2026-06-01T00:00:00Z');
    prismaMock.attachment.findMany.mockResolvedValue([
      { id: 'old1', storageProvider: 'db', storageKey: 'b1' },
      { id: 'old2', storageProvider: 's3', storageKey: 'k2' },
    ] as never);
    prismaMock.attachment.delete.mockResolvedValue({} as never);

    const purged = await purgeExpiredForEntity(tenantId, ATTACHMENTS_ENTITY, cutoff);

    expect(purged).toBe(2);
    const findArg = firstCallArg(prismaMock.attachment.findMany) as { where: Record<string, unknown> };
    expect(findArg.where).toMatchObject({ tenantId, deletedAt: { lt: cutoff } });
    expect(purgeBytesMock).toHaveBeenCalledTimes(2);
    expect(prismaMock.attachment.delete).toHaveBeenCalledTimes(2);
  });

  it('best-effort: falha ao expurgar um item não aborta o lote', async () => {
    const cutoff = new Date('2026-06-01T00:00:00Z');
    prismaMock.attachment.findMany.mockResolvedValue([
      { id: 'ok', storageProvider: 'db', storageKey: 'b1' },
      { id: 'boom', storageProvider: 'db', storageKey: 'b2' },
    ] as never);
    prismaMock.attachment.delete
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error('FK'));

    const purged = await purgeExpiredForEntity(tenantId, ATTACHMENTS_ENTITY, cutoff);
    expect(purged).toBe(1); // só o "ok" contou
  });
});
