/**
 * Helpers de escopo por papel (spec papeis-comerciais).
 *
 * Hierarquia: ADMIN > GESTOR > USER > VIEWER.
 * - GESTOR/ADMIN (e platform-admin): visão de todo o tenant.
 * - USER (analista): só os próprios registros (assignedTo = ele).
 * - VIEWER: comportamento inalterado (tenant-wide, só-leitura) — a spec não
 *   restringe o escopo de dados do VIEWER.
 */

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
 * Filtro de "responsável" efetivo para listagens/agregações:
 * força `assignedTo = userId` quando o chamador é USER (analista);
 * caso contrário, mantém o filtro pedido pelo cliente (GESTOR/ADMIN/VIEWER).
 */
export function ownerScope(user: RequestUser | undefined, requestedAssignedTo?: string): string | undefined {
  if (isAnalyst(user)) {
    return user!.userId;
  }
  return requestedAssignedTo;
}
