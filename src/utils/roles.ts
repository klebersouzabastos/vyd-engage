// Helper de papel no frontend (spec papeis-comerciais).
// GESTOR/ADMIN (e platform-admin) são "gestores" e veem painéis de nível-time;
// USER (analista) e VIEWER não.

interface RoleUser {
  role?: string;
  isPlatformAdmin?: boolean;
}

export function isManagerRole(user?: RoleUser | null): boolean {
  return (
    !!user && (user.isPlatformAdmin === true || user.role === 'ADMIN' || user.role === 'GESTOR')
  );
}
