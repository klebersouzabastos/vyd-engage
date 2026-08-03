/*
 * Central de Suporte VYD no Engage — widget autocontido (piloto 4).
 *
 * Overlay IRMÃO no shell, nunca ancestral: o provider envolve só o botão, e
 * tudo vive atrás de um boundary com fallback vazio. Três camadas
 * independentes (provider não alcança o app · boundary contém exceção ·
 * guard de config) — receita provada nos pilotos Finance, Obras e engai.
 *
 * ⚠️ Boundary PRÓPRIO, não o ErrorBoundary do projeto: aquele trata
 * `fallback` falsy como "sem fallback" e renderiza a UI de erro de página
 * inteira — o OPOSTO da contenção que queremos aqui.
 *
 * Identidade: email/nome do useAuth do Engage (pré-preenchem a UI) +
 * getToken do VYD ID (o que o motor de fato aceita — ver lib/vydIdentity).
 * `context` leva o tenant (app multi-tenant): sem ele o atendente não sabe
 * de qual cliente veio o chamado; vai aninhado em app_context.app_meta.
 */
import { Component, useMemo, type ReactNode } from 'react';
import { SupportButton, VydSupportProvider } from '@vydhub/support';
import type { SupportIdentity } from '@vydhub/support';
import { useAuth } from '@/contexts/AuthContext';
import { getVydToken } from '@/lib/vydIdentity';
import { APP_CODE, PORTAL_URL, SUPPORT_URL, isSupportConfigured } from './config';
import { supportRoutes } from './routes';

class WidgetBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

function SupportWidgetInner() {
  const { user } = useAuth();

  // getToken é referência estável de módulo — fora das deps para não recriar
  // o transporte a cada render (refetch em cascata em "Meus chamados").
  const identity = useMemo<SupportIdentity>(
    () => ({ email: user?.email, name: user?.name, getToken: getVydToken }),
    [user?.email, user?.name]
  );

  const context = useMemo(
    () =>
      user?.tenantId
        ? {
            tenant_id: user.tenantId,
            tenant_slug: user.tenant?.slug,
            tenant_name: user.tenant?.name,
          }
        : undefined,
    [user?.tenantId, user?.tenant?.slug, user?.tenant?.name]
  );

  return (
    <VydSupportProvider
      appCode={APP_CODE}
      supportUrl={SUPPORT_URL}
      portalUrl={PORTAL_URL}
      identity={identity}
      routes={supportRoutes}
      context={context}
      capture={{ excludeSelectors: ['.vyd-support-fab', '[data-sonner-toaster]'] }}
    >
      <SupportButton />
    </VydSupportProvider>
  );
}

export function SupportWidget() {
  if (!isSupportConfigured) return null;
  return (
    <WidgetBoundary>
      <SupportWidgetInner />
    </WidgetBoundary>
  );
}
