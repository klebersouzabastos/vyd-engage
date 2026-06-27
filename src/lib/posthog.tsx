import { ReactNode } from 'react';
import { PostHogProvider as PHProvider } from '@posthog/react';

const apiKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const apiHost =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';

/**
 * PostHog provider — env-gated. No-op (renders children directly) unless
 * VITE_POSTHOG_KEY is set, so the app runs unchanged without analytics configured.
 *
 * Provider-only for now (anonymous autocapture + pageviews — no cross-tenant mixing).
 * Per-tenant identify()/group() is a follow-up (needs AuthContext wiring); the
 * higher-fidelity, tenant-grouped events are captured server-side.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  if (!apiKey) return <>{children}</>;
  return (
    <PHProvider apiKey={apiKey} options={{ api_host: apiHost }}>
      {children}
    </PHProvider>
  );
}
