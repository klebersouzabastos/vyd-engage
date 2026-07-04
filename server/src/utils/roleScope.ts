/**
 * Helpers de escopo por papel (spec papeis-comerciais + Upgrade RD P1).
 *
 * Hierarquia: ADMIN > GESTOR > USER > VIEWER.
 * - GESTOR/ADMIN (e platform-admin): visão de todo o tenant.
 * - USER (analista): só os próprios registros (assignedTo = ele).
 * - VIEWER: comportamento inalterado (tenant-wide, só-leitura) — a spec não
 *   restringe o escopo de dados do VIEWER.
 *
 * COMPATIBILIDADE (P1): `ownerScope` permanece SÍNCRONO e devolve EXATAMENTE o
 * mesmo resultado de hoje (analista → userId; senão → requested). É o floor
 * fail-closed usado pelas 18 rotas existentes, que não são reescritas. A camada
 * de visibilidade por entidade/equipe (perfis custom) é ADITIVA e assíncrona,
 * exposta via `visibilityScope` (reexport de permissionService) — rotas que
 * quiserem expandir escopo por perfil optam por ela explicitamente. Sem perfil
 * custom, `visibilityScope('deals')` reduz ao MESMO valor de `ownerScope`.
 */

import { visibilityScope as permissionVisibilityScope } from '../services/permissionService.js';

interface RequestUser {
  userId: string;
  role?: string;
  isPlatformAdmin?: boolean;
}

/** GESTOR/ADMIN/platform-admin têm acesso a todo o tenant (não são "analistas"). */
export function isManager(user?: RequestUser): boolean {
  return (
    !!user && (user.isPlatformAdmin === true || user.role === 'ADMIN' || user.role === 'GESTOR')
  );
}

/** Analista = papel USER (visão restrita ao próprio responsável). */
export function isAnalyst(user?: RequestUser): boolean {
  return !!user && user.isPlatformAdmin !== true && user.role === 'USER';
}

/**
 * Filtro de "responsável" efetivo para listagens/agregações (SÍNCRONO, floor
 * fail-closed): força `assignedTo = userId` quando o chamador é USER (analista);
 * caso contrário, mantém o filtro pedido pelo cliente (GESTOR/ADMIN/VIEWER).
 *
 * Este é o comportamento de HOJE das 18 rotas fail-closed — preservado byte a
 * byte. Sem perfil custom, é idêntico a `visibilityScope(user,'deals',requested)`.
 */
export function ownerScope(
  user: RequestUser | undefined,
  requestedAssignedTo?: string
): string | undefined {
  if (isAnalyst(user)) {
    return user!.userId;
  }
  return requestedAssignedTo;
}

/**
 * Reexport da visibilidade por entidade/equipe (assíncrona, ADITIVA) do
 * permissionService. Rotas que adotam perfis custom usam esta função; sem perfil
 * custom ela devolve o MESMO que `ownerScope` (deals PROPRIA p/ analista,
 * requested p/ manager) — fail-closed por construção.
 */
export const visibilityScope = permissionVisibilityScope;
