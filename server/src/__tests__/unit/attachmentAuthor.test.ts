import { describe, it, expect, vi } from 'vitest';
import { toAttachmentDto, attachAuthors } from '../../services/attachmentService.js';

/**
 * Upgrade RD parity — P2 (CF-B, req 22): autor do anexo no DTO.
 *
 * A coluna "autor" da Central lê `uploadedBy?.name`. Prova:
 *  - toAttachmentDto expõe `uploadedBy` (null quando ausente);
 *  - attachAuthors resolve os nomes num único lookup batelado a User (tenant-scoped);
 *  - registros sem autor (ou autor inexistente) ficam com uploadedBy:null.
 */
function fakeRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'a1',
    tenantId: 't1',
    name: 'doc.pdf',
    mimeType: 'application/pdf',
    size: 10,
    storageProvider: 'db',
    dealId: null,
    companyId: null,
    source: 'UPLOAD',
    uploadedById: 'u1',
    createdAt: new Date('2026-07-06T00:00:00Z'),
    ...over,
  };
}

describe('toAttachmentDto — autor', () => {
  it('expõe uploadedBy quando fornecido no input', () => {
    const dto = toAttachmentDto({ ...fakeRow(), uploadedBy: { id: 'u1', name: 'Ana' } });
    expect(dto.uploadedBy).toEqual({ id: 'u1', name: 'Ana' });
  });

  it('uploadedBy null quando ausente (ex.: retorno do storageService.put)', () => {
    const dto = toAttachmentDto(fakeRow());
    expect(dto.uploadedBy).toBeNull();
    expect(dto).not.toHaveProperty('storageKey');
  });
});

describe('attachAuthors — lookup batelado (tenant-scoped)', () => {
  it('resolve nomes num único findMany e mapeia uploadedBy:{id,name}', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'u1', name: 'Ana' },
      { id: 'u2', name: 'Bruno' },
    ]);
    const db = { user: { findMany } };

    const rows = [
      fakeRow({ id: 'a1', uploadedById: 'u1' }),
      fakeRow({ id: 'a2', uploadedById: 'u2' }),
      fakeRow({ id: 'a3', uploadedById: 'u1' }), // repete u1 → 1 só query
    ];
    const dtos = await attachAuthors(db, 't1', rows);

    // Um único lookup, tenant-scoped, com ids únicos.
    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0][0] as { where: { id: { in: string[] }; tenantId: string } };
    expect(arg.where.tenantId).toBe('t1');
    expect([...arg.where.id.in].sort()).toEqual(['u1', 'u2']);

    expect(dtos[0].uploadedBy).toEqual({ id: 'u1', name: 'Ana' });
    expect(dtos[1].uploadedBy).toEqual({ id: 'u2', name: 'Bruno' });
    expect(dtos[2].uploadedBy).toEqual({ id: 'u1', name: 'Ana' });
  });

  it('uploadedBy:null para anexos sem autor e não faz query quando não há ids', async () => {
    const findMany = vi.fn();
    const db = { user: { findMany } };

    const dtos = await attachAuthors(db, 't1', [fakeRow({ uploadedById: null })]);
    expect(findMany).not.toHaveBeenCalled();
    expect(dtos[0].uploadedBy).toBeNull();
  });

  it('uploadedBy:null quando o autor não existe mais no tenant', async () => {
    const findMany = vi.fn().mockResolvedValue([]); // usuário sumiu
    const db = { user: { findMany } };

    const dtos = await attachAuthors(db, 't1', [fakeRow({ uploadedById: 'ghost' })]);
    expect(dtos[0].uploadedBy).toBeNull();
  });
});
