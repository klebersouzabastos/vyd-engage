import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRole } from '@prisma/client';
import { prismaMock } from '../helpers/prismaMock.js';

/**
 * Upgrade RD parity — P1 (B2: Times / Perfis / Metas).
 * Foco: teamService CRUD (vínculo de membros em transação, multi-tenant),
 * permissionProfileService (builtins imutáveis) e validação XOR de metas.
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/permissionService.js', () => ({
  ensureBuiltinProfiles: vi.fn(async () => undefined),
}));

import { teamService } from '../../services/teamService.js';
import { permissionProfileService } from '../../services/permissionProfileService.js';
import { upsertGoalSchema } from '../../routes/goals.js';

const tenantId = 't1';

// $transaction(callback) → executa o callback com o próprio prismaMock como `tx`.
function wireTransaction() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prismaMock.$transaction as any).mockImplementation(async (cb: any) => cb(prismaMock));
}

beforeEach(() => {
  vi.clearAllMocks();
  wireTransaction();
});

// ── teamService ───────────────────────────────────────────────────────────────

describe('teamService.createTeam', () => {
  it('cria a equipe e vincula os membros (updateMany) em transação, tenant-scoped', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }] as never); // assertUsersInTenant
    prismaMock.team.create.mockResolvedValue({ id: 'team-1', tenantId, name: 'Vendas' } as never);
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.team.findFirstOrThrow.mockResolvedValue({
      id: 'team-1',
      name: 'Vendas',
      members: [{ id: 'm1' }, { id: 'm2' }],
    } as never);

    const team = await teamService.createTeam(tenantId, {
      name: 'Vendas',
      memberIds: ['m1', 'm2'],
    });

    expect(team.id).toBe('team-1');
    // create com tenantId correto
    expect(prismaMock.team.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId, name: 'Vendas' }) })
    );
    // dois updateMany: remover não-membros + adicionar desejados (ambos tenant-scoped)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = (prismaMock.user.updateMany.mock.calls as any[]).map((c) => c[0]);
    expect(calls).toHaveLength(2);
    expect(calls[0].where).toEqual(
      expect.objectContaining({ tenantId, teamId: 'team-1', id: { notIn: ['m1', 'm2'] } })
    );
    expect(calls[1]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, id: { in: ['m1', 'm2'] } }),
        data: { teamId: 'team-1' },
      })
    );
  });

  it('rejeita (400) quando um membro não pertence ao tenant', async () => {
    // Só 'm1' existe no tenant; 'm2' faltando.
    prismaMock.user.findMany.mockResolvedValue([{ id: 'm1' }] as never);

    await expect(
      teamService.createTeam(tenantId, { name: 'X', memberIds: ['m1', 'm2'] })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.team.create).not.toHaveBeenCalled();
  });
});

describe('teamService.updateTeam', () => {
  it('404 quando a equipe não existe no tenant', async () => {
    prismaMock.team.findFirst.mockResolvedValue(null as never);
    await expect(teamService.updateTeam(tenantId, 'ghost', { name: 'Y' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('não mexe em membros quando memberIds é omitido (patch parcial só do nome)', async () => {
    prismaMock.team.findFirst.mockResolvedValue({ id: 'team-1' } as never);
    prismaMock.team.update.mockResolvedValue({ id: 'team-1' } as never);
    prismaMock.team.findFirstOrThrow.mockResolvedValue({ id: 'team-1', name: 'Novo' } as never);

    await teamService.updateTeam(tenantId, 'team-1', { name: 'Novo' });

    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.team.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'team-1' }, data: { name: 'Novo' } })
    );
  });
});

describe('teamService.deleteTeam', () => {
  it('404 quando não existe; delete quando existe', async () => {
    prismaMock.team.findFirst.mockResolvedValueOnce(null as never);
    await expect(teamService.deleteTeam(tenantId, 'ghost')).rejects.toMatchObject({
      statusCode: 404,
    });

    prismaMock.team.findFirst.mockResolvedValueOnce({ id: 'team-1' } as never);
    prismaMock.team.delete.mockResolvedValue({ id: 'team-1' } as never);
    await teamService.deleteTeam(tenantId, 'team-1');
    expect(prismaMock.team.delete).toHaveBeenCalledWith({ where: { id: 'team-1' } });
  });
});

// ── permissionProfileService: builtins imutáveis ───────────────────────────────

describe('permissionProfileService — builtins read-only', () => {
  it('updateProfile em builtin → 400 (não edita)', async () => {
    prismaMock.permissionProfile.findFirst.mockResolvedValue({
      id: 'b1',
      tenantId,
      isBuiltin: true,
      baseRole: UserRole.USER,
    } as never);

    await expect(
      permissionProfileService.updateProfile(tenantId, 'b1', { name: 'Hackeado' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'BUILTIN_PROFILE_READONLY' });
    expect(prismaMock.permissionProfile.update).not.toHaveBeenCalled();
  });

  it('deleteProfile em builtin → 400 (não exclui)', async () => {
    prismaMock.permissionProfile.findFirst.mockResolvedValue({
      id: 'b1',
      tenantId,
      isBuiltin: true,
      baseRole: UserRole.ADMIN,
    } as never);

    await expect(permissionProfileService.deleteProfile(tenantId, 'b1')).rejects.toMatchObject({
      statusCode: 400,
      code: 'BUILTIN_PROFILE_READONLY',
    });
    expect(prismaMock.permissionProfile.delete).not.toHaveBeenCalled();
  });

  it('updateProfile em custom aplica os overrides', async () => {
    prismaMock.permissionProfile.findFirst.mockResolvedValue({
      id: 'c1',
      tenantId,
      isBuiltin: false,
      baseRole: UserRole.USER,
    } as never);
    prismaMock.permissionProfile.update.mockResolvedValue({ id: 'c1' } as never);

    await permissionProfileService.updateProfile(tenantId, 'c1', {
      capabilities: { configure: true },
      visibility: { deals: 'GERAL' },
    });

    expect(prismaMock.permissionProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: expect.objectContaining({
          capabilities: { configure: true },
          visibility: { deals: 'GERAL' },
        }),
      })
    );
  });

  it('createProfile grava isBuiltin=false e o baseRole informado, tenant-scoped', async () => {
    prismaMock.permissionProfile.create.mockResolvedValue({ id: 'c2' } as never);
    await permissionProfileService.createProfile(tenantId, {
      name: 'Vendedor Sênior',
      baseRole: UserRole.USER,
      capabilities: { transferOwner: true },
    });
    expect(prismaMock.permissionProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId,
          isBuiltin: false,
          baseRole: UserRole.USER,
          capabilities: { transferOwner: true },
        }),
      })
    );
  });
});

// ── Metas: exclusividade userId XOR teamId ─────────────────────────────────────

describe('upsertGoalSchema — userId XOR teamId', () => {
  const base = { month: 3, year: 2026, targetRevenue: 1000 };

  it('aceita meta individual (só userId)', () => {
    const r = upsertGoalSchema.safeParse({ ...base, userId: '11111111-1111-1111-1111-111111111111' });
    expect(r.success).toBe(true);
  });

  it('aceita meta de equipe (só teamId)', () => {
    const r = upsertGoalSchema.safeParse({ ...base, teamId: '22222222-2222-2222-2222-222222222222' });
    expect(r.success).toBe(true);
  });

  it('rejeita quando ambos são informados', () => {
    const r = upsertGoalSchema.safeParse({
      ...base,
      userId: '11111111-1111-1111-1111-111111111111',
      teamId: '22222222-2222-2222-2222-222222222222',
    });
    expect(r.success).toBe(false);
  });

  it('rejeita quando nenhum é informado', () => {
    const r = upsertGoalSchema.safeParse({ ...base });
    expect(r.success).toBe(false);
  });
});
