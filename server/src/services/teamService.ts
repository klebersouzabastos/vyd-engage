/**
 * teamService — CRUD de equipes de vendas (Upgrade RD P1, req 12).
 *
 * Multi-tenant: TODA query filtra por `tenantId`, incluindo lookups por id.
 * Vínculo de membros: setar `User.teamId` dos membros escolhidos em transação,
 * removendo cada um de qualquer equipe anterior (um usuário pertence a no máximo
 * uma equipe). Fail-safe: só toca usuários do mesmo tenant.
 *
 * ADITIVO: sem equipes configuradas, o comportamento do app é IDÊNTICO ao de hoje
 * (nenhum usuário tem `teamId`, logo `visibilityScope` EQUIPE nunca é acionado).
 */
import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';

const MEMBER_SELECT = { id: true, name: true, email: true } as const;

const TEAM_INCLUDE = {
  leader: { select: MEMBER_SELECT },
  members: { select: MEMBER_SELECT, orderBy: { name: 'asc' as const } },
} as const;

export interface TeamWriteInput {
  name: string;
  leaderId?: string | null;
  memberIds?: string[];
}

/** Update aceita todos os campos como opcionais (patch parcial). */
export type TeamUpdateInput = Partial<TeamWriteInput>;

/** Confirma que todos os ids pertencem ao tenant; lança 400 com a lista faltante. */
async function assertUsersInTenant(tenantId: string, ids: string[]): Promise<void> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return;
  const found = await prisma.user.findMany({
    where: { id: { in: unique }, tenantId },
    select: { id: true },
  });
  const foundIds = new Set(found.map((u) => u.id));
  const missing = unique.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw createError(
      `Usuário(s) não pertencente(s) a este tenant: ${missing.join(', ')}`,
      400,
      'INVALID_USER_REFERENCE'
    );
  }
}

/** Aplica o conjunto de membros de uma equipe em transação (idempotente). */
async function setTeamMembers(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  tenantId: string,
  teamId: string,
  memberIds: string[]
): Promise<void> {
  const desired = Array.from(new Set(memberIds.filter(Boolean)));
  // Remove da equipe quem não deve mais fazer parte (só usuários do tenant/equipe).
  await tx.user.updateMany({
    where: { tenantId, teamId, id: { notIn: desired.length > 0 ? desired : ['__none__'] } },
    data: { teamId: null },
  });
  // Adiciona os desejados (tira de qualquer equipe anterior ao setar este teamId).
  if (desired.length > 0) {
    await tx.user.updateMany({
      where: { tenantId, id: { in: desired } },
      data: { teamId },
    });
  }
}

export async function listTeams(tenantId: string) {
  return prisma.team.findMany({
    where: { tenantId },
    include: TEAM_INCLUDE,
    orderBy: { name: 'asc' },
  });
}

export async function getTeam(tenantId: string, id: string) {
  const team = await prisma.team.findFirst({
    where: { id, tenantId },
    include: TEAM_INCLUDE,
  });
  if (!team) throw createError('Equipe não encontrada', 404, 'TEAM_NOT_FOUND');
  return team;
}

export async function createTeam(tenantId: string, input: TeamWriteInput) {
  const memberIds = input.memberIds ?? [];
  const refs = [...memberIds];
  if (input.leaderId) refs.push(input.leaderId);
  await assertUsersInTenant(tenantId, refs);

  const created = await prisma.$transaction(async (tx) => {
    const team = await tx.team.create({
      data: { tenantId, name: input.name.trim(), leaderId: input.leaderId ?? null },
    });
    await setTeamMembers(tx, tenantId, team.id, memberIds);
    return tx.team.findFirstOrThrow({ where: { id: team.id, tenantId }, include: TEAM_INCLUDE });
  });
  return created;
}

export async function updateTeam(tenantId: string, id: string, input: TeamUpdateInput) {
  const existing = await prisma.team.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw createError('Equipe não encontrada', 404, 'TEAM_NOT_FOUND');

  const refs: string[] = [];
  if (input.memberIds) refs.push(...input.memberIds);
  if (input.leaderId) refs.push(input.leaderId);
  await assertUsersInTenant(tenantId, refs);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.team.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.leaderId !== undefined ? { leaderId: input.leaderId ?? null } : {}),
      },
    });
    if (input.memberIds !== undefined) {
      await setTeamMembers(tx, tenantId, id, input.memberIds);
    }
    return tx.team.findFirstOrThrow({ where: { id, tenantId }, include: TEAM_INCLUDE });
  });
  return updated;
}

export async function deleteTeam(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.team.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw createError('Equipe não encontrada', 404, 'TEAM_NOT_FOUND');
  // FK SetNull em User.teamId e ledTeams; Goal.teamId Cascade. Exclusão direta.
  await prisma.team.delete({ where: { id } });
}

export const teamService = {
  listTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
};

export default teamService;
