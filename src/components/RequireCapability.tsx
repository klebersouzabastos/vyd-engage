import { type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { usePermissions } from '@/hooks/usePermissions';
import type { Capability } from '@/types/governance';

/**
 * Guarda de rota por CAPABILITY (perfil de permissão). Usado pelo módulo de
 * Atestados Técnicos, cujo acesso é restrito a um perfil específico
 * (`accessAtestados`). Aguarda o perfil carregar antes de decidir; em erro, é
 * otimista (como o resto da UI — o backend é o gate real). Redireciona para /app
 * quem não tem a capability.
 */
export function RequireCapability({ cap, children }: { cap: Capability; children: ReactNode }) {
  const { permissions, isLoading } = usePermissions();
  if (isLoading) return null;
  const allowed = !permissions || permissions.capabilities[cap] === true;
  if (!allowed) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
