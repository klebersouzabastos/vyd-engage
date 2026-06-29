import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuggestionStatus, SuggestionType } from '@prisma/client';
import { prismaMock } from '../helpers/prismaMock.js';

/**
 * Cobertura do suggestionService (Definição de Concluído da spec sugestoes-feedback):
 *  - create atribui tenantId/userId do contexto e notifica platform admins (best-effort);
 *  - escopo: usuário comum só as próprias; platform admin all (cross-tenant) vs mine;
 *  - automação de resolvedAt nas transições de/para estados terminais;
 *  - regras de delete (dono só PENDING; 404 mascarado; admin qualquer).
 *
 * notificationService é mockado para isolar a lógica (evita socket/DB).
 */
vi.mock('../../services/notificationService.js', () => ({
  notificationService: { create: vi.fn(async () => ({ id: 'notif-1' })) },
}));

import { suggestionService } from '../../services/suggestionService.js';

const tenantId = 'tenant-1';
const userId = 'user-1';

// O deep-mock do Prisma não tipa `.mock.calls`; cast para any (padrão dos testes do repo).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arg0 = (fn: any) => fn.mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('suggestionService.create', () => {
  it('atribui tenantId e userId do contexto (nunca do corpo)', async () => {
    prismaMock.suggestion.create.mockResolvedValue({
      id: 's1',
      title: 'X',
      type: SuggestionType.IMPROVEMENT,
      route: null,
      user: { name: 'Ana' },
    } as never);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'admin-1', tenantId: 't-admin' }] as never);

    await suggestionService.create(tenantId, userId, {
      title: 'Melhorar X',
      description: 'Detalhe da melhoria',
      type: SuggestionType.IMPROVEMENT,
      route: null,
    });

    expect(arg0(prismaMock.suggestion.create).data).toMatchObject({
      tenantId,
      userId,
      type: SuggestionType.IMPROVEMENT,
    });
  });

  it('não falha a criação se a notificação aos admins falhar (best-effort)', async () => {
    prismaMock.suggestion.create.mockResolvedValue({
      id: 's1',
      title: 'X',
      type: SuggestionType.IMPROVEMENT,
      route: null,
      user: null,
    } as never);
    prismaMock.user.findMany.mockRejectedValue(new Error('db down') as never);

    await expect(
      suggestionService.create(tenantId, userId, {
        title: 'abc',
        description: 'defgh',
        type: SuggestionType.IMPROVEMENT,
      })
    ).resolves.toBeTruthy();
  });
});

describe('suggestionService.findAll — escopo', () => {
  it('usuário comum vê apenas as próprias (filtra userId), ignorando scope=all', async () => {
    prismaMock.suggestion.findMany.mockResolvedValue([] as never);
    await suggestionService.findAll(tenantId, userId, false, { scope: 'all' });
    expect(arg0(prismaMock.suggestion.findMany).where.userId).toBe(userId);
  });

  it('platform admin com scope=all vê todas (sem filtro de userId/tenantId)', async () => {
    prismaMock.suggestion.findMany.mockResolvedValue([] as never);
    await suggestionService.findAll(tenantId, userId, true, { scope: 'all' });
    const where = arg0(prismaMock.suggestion.findMany).where;
    expect(where.userId).toBeUndefined();
    expect(where.tenantId).toBeUndefined();
  });

  it('platform admin com scope=mine filtra por userId', async () => {
    prismaMock.suggestion.findMany.mockResolvedValue([] as never);
    await suggestionService.findAll(tenantId, userId, true, { scope: 'mine' });
    expect(arg0(prismaMock.suggestion.findMany).where.userId).toBe(userId);
  });
});

describe('suggestionService.update — automação de resolvedAt', () => {
  it('seta resolvedAt ao ir de PENDING para DONE', async () => {
    prismaMock.suggestion.findFirst.mockResolvedValue({
      id: 's1',
      status: SuggestionStatus.PENDING,
      resolvedAt: null,
    } as never);
    prismaMock.suggestion.update.mockResolvedValue({ id: 's1' } as never);

    await suggestionService.update('s1', { status: SuggestionStatus.DONE });

    expect(arg0(prismaMock.suggestion.update).data.resolvedAt).toBeInstanceOf(Date);
  });

  it('limpa resolvedAt ao voltar de DONE para IN_REVIEW', async () => {
    prismaMock.suggestion.findFirst.mockResolvedValue({
      id: 's1',
      status: SuggestionStatus.DONE,
      resolvedAt: new Date(),
    } as never);
    prismaMock.suggestion.update.mockResolvedValue({ id: 's1' } as never);

    await suggestionService.update('s1', { status: SuggestionStatus.IN_REVIEW });

    expect(arg0(prismaMock.suggestion.update).data.resolvedAt).toBeNull();
  });
});

describe('suggestionService.delete — regras de autorização', () => {
  it('usuário comum não deleta sugestão não-PENDING (400 SUGGESTION_NOT_DELETABLE)', async () => {
    prismaMock.suggestion.findFirst.mockResolvedValue({
      id: 's1',
      status: SuggestionStatus.DONE,
    } as never);

    await expect(suggestionService.delete(userId, false, 's1')).rejects.toMatchObject({
      statusCode: 400,
      code: 'SUGGESTION_NOT_DELETABLE',
    });
    expect(prismaMock.suggestion.delete).not.toHaveBeenCalled();
  });

  it('usuário comum sem acesso → 404 mascarado', async () => {
    prismaMock.suggestion.findFirst.mockResolvedValue(null as never);

    await expect(suggestionService.delete(userId, false, 's1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'SUGGESTION_NOT_FOUND',
    });
  });

  it('platform admin deleta qualquer sugestão (mesmo não-PENDING)', async () => {
    prismaMock.suggestion.findFirst.mockResolvedValue({
      id: 's1',
      status: SuggestionStatus.DONE,
    } as never);
    prismaMock.suggestion.delete.mockResolvedValue({ id: 's1' } as never);

    const result = await suggestionService.delete('admin', true, 's1');
    expect(result).toEqual({ deleted: true });
    expect(prismaMock.suggestion.delete).toHaveBeenCalledTimes(1);
  });
});
