/**
 * permissionProfileService — CRUD de perfis de permissão (Upgrade RD P1, req 13/14).
 *
 * Multi-tenant: TODA query filtra por `tenantId`, incluindo lookups por id.
 *
 * REGRAS INVIOLÁVEIS:
 *  - Os 4 builtins (isBuiltin=true, 1 por baseRole) são IMUTÁVEIS: não podem ser
 *    renomeados, editados nem excluídos (400). Refletem os defaults do baseRole
 *    (== comportamento de hoje). Semear via permissionService.ensureBuiltinProfiles.
 *  - Perfis custom podem editar capabilities/visibility/requireApprovalFor; o
 *    `baseRole` é fixo após a criação (herança estável).
 *  - FAIL-CLOSED: um perfil só EXPANDE escopo quando um admin o configura e o
 *    atribui a um usuário. Sem atribuição, nada muda.
 */
import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { UserRole, type Prisma } from '@prisma/client';
import { ensureBuiltinProfiles } from './permissionService.js';

export interface CreateProfileInput {
  name: string;
  description?: string | null;
  baseRole: UserRole;
  capabilities?: Record<string, unknown>;
  visibility?: Record<string, unknown>;
  requireApprovalFor?: Record<string, unknown>;
}

export interface UpdateProfileInput {
  name?: string;
  description?: string | null;
  capabilities?: Record<string, unknown>;
  visibility?: Record<string, unknown>;
  requireApprovalFor?: Record<string, unknown>;
}

const json = (v: unknown): Prisma.InputJsonValue => (v ?? {}) as Prisma.InputJsonValue;

/** Lista todos os perfis do tenant (builtins primeiro, depois por nome). Semeia builtins. */
export async function listProfiles(tenantId: string) {
  await ensureBuiltinProfiles(tenantId);
  return prisma.permissionProfile.findMany({
    where: { tenantId },
    orderBy: [{ isBuiltin: 'desc' }, { name: 'asc' }],
  });
}

export async function getProfile(tenantId: string, id: string) {
  const profile = await prisma.permissionProfile.findFirst({ where: { id, tenantId } });
  if (!profile) throw createError('Perfil não encontrado', 404, 'PROFILE_NOT_FOUND');
  return profile;
}

export async function createProfile(tenantId: string, input: CreateProfileInput) {
  return prisma.permissionProfile.create({
    data: {
      tenantId,
      name: input.name.trim(),
      description: input.description ?? null,
      isBuiltin: false,
      baseRole: input.baseRole,
      capabilities: json(input.capabilities),
      visibility: json(input.visibility),
      requireApprovalFor: json(input.requireApprovalFor),
    },
  });
}

export async function updateProfile(tenantId: string, id: string, input: UpdateProfileInput) {
  const existing = await prisma.permissionProfile.findFirst({ where: { id, tenantId } });
  if (!existing) throw createError('Perfil não encontrado', 404, 'PROFILE_NOT_FOUND');
  if (existing.isBuiltin) {
    throw createError(
      'Perfis padrão são imutáveis: não podem ser editados nem renomeados.',
      400,
      'BUILTIN_PROFILE_READONLY'
    );
  }

  return prisma.permissionProfile.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.capabilities !== undefined ? { capabilities: json(input.capabilities) } : {}),
      ...(input.visibility !== undefined ? { visibility: json(input.visibility) } : {}),
      ...(input.requireApprovalFor !== undefined
        ? { requireApprovalFor: json(input.requireApprovalFor) }
        : {}),
    },
  });
}

export async function deleteProfile(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.permissionProfile.findFirst({ where: { id, tenantId } });
  if (!existing) throw createError('Perfil não encontrado', 404, 'PROFILE_NOT_FOUND');
  if (existing.isBuiltin) {
    throw createError(
      'Perfis padrão são imutáveis: não podem ser excluídos.',
      400,
      'BUILTIN_PROFILE_READONLY'
    );
  }

  // Caso extremo (req 13): perfil EM USO não pode ser excluído — o admin deve
  // primeiro migrar os usuários para outro perfil. Bloqueia com 400 explícito
  // (em vez de deixar o FK SetNull rebaixar os usuários silenciosamente).
  const inUse = await prisma.user.count({ where: { tenantId, permissionProfileId: id } });
  if (inUse > 0) {
    throw createError(
      `Perfil em uso por ${inUse} usuário(s). Migre-os para outro perfil antes de excluir.`,
      400,
      'PROFILE_IN_USE'
    );
  }

  await prisma.permissionProfile.delete({ where: { id } });
}

export const permissionProfileService = {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
};

export default permissionProfileService;
