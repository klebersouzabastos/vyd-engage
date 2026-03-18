/**
 * Sentry Frontend Integration (Lightweight)
 *
 * Since @sentry/react is not in package.json, this module provides a
 * lightweight Sentry integration via the Sentry CDN loader script.
 * If VITE_SENTRY_DSN is set, it loads Sentry from CDN and initializes it.
 *
 * To upgrade to the full @sentry/react SDK:
 * 1. Install: npm install @sentry/react
 * 2. Replace this file with proper SDK init
 * 3. Wrap <App /> with Sentry.ErrorBoundary in main.tsx
 */

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const SENTRY_CDN_VERSION = '7'; // Major version for CDN bundle

interface SentryLike {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown, context?: Record<string, unknown>) => void;
  captureMessage: (message: string, level?: Record<string, unknown> | string) => void;
  setTag: (key: string, value: string) => void;
}

function getSentry(): SentryLike | null {
  if (typeof window !== 'undefined' && (window as Record<string, unknown>).Sentry) {
    return (window as Record<string, unknown>).Sentry as SentryLike;
  }
  return null;
}

/**
 * Initialize Sentry for the frontend.
 * Loads from CDN if VITE_SENTRY_DSN is configured.
 * No-ops gracefully if DSN is not set or load fails.
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    if (import.meta.env.DEV) {
      console.log('[Sentry] No VITE_SENTRY_DSN configured — Sentry disabled.');
    }
    return;
  }

  // If Sentry is already loaded (e.g., via script tag in index.html), just init
  const existing = getSentry();
  if (existing) {
    configureSentry(existing);
    return;
  }

  // Load Sentry from CDN
  const script = document.createElement('script');
  script.src = `https://browser.sentry-cdn.com/${SENTRY_CDN_VERSION}/bundle.min.js`;
  script.crossOrigin = 'anonymous';
  script.onload = () => {
    const sentry = getSentry();
    if (sentry) {
      configureSentry(sentry);
    }
  };
  script.onerror = () => {
    if (import.meta.env.DEV) {
      console.warn('[Sentry] Failed to load Sentry CDN bundle.');
    }
  };
  document.head.appendChild(script);
}

function configureSentry(sentry: SentryLike): void {
  sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',
    // Only send 10% of transactions in production to control volume
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // Don't send errors in development unless explicitly wanted
    enabled: import.meta.env.PROD || import.meta.env.VITE_SENTRY_FORCE_ENABLE === 'true',
  });

  sentry.setTag('app', 'vyd-engage-frontend');
  sentry.setTag('version', '0.1.0');

  // Global error handler for uncaught errors
  window.addEventListener('unhandledrejection', (event) => {
    sentry.captureException(event.reason, {
      extra: { type: 'unhandledrejection' },
    });
  });

  if (import.meta.env.DEV) {
    console.log('[Sentry] Initialized successfully.');
  }
}

/**
 * Capture an exception manually.
 * No-ops if Sentry is not loaded.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  const sentry = getSentry();
  if (sentry) {
    sentry.captureException(error, context ? { extra: context } : undefined);
  }
}

/**
 * Capture a message manually.
 * No-ops if Sentry is not loaded.
 */
export function captureMessage(message: string, level: string = 'info'): void {
  const sentry = getSentry();
  if (sentry) {
    sentry.captureMessage(message, level);
  }
}
