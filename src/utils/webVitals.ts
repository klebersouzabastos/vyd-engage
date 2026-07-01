type WebVitalMetric = {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  id: string;
};

type ReportCallback = (metric: WebVitalMetric) => void;

const thresholds: Record<string, [number, number]> = {
  CLS: [0.1, 0.25],
  FID: [100, 300],
  FCP: [1800, 3000],
  LCP: [2500, 4000],
  TTFB: [800, 1800],
  INP: [200, 500],
};

function getRating(name: string, value: number): WebVitalMetric['rating'] {
  const [good, poor] = thresholds[name] || [Infinity, Infinity];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

export function reportWebVitals(onReport?: ReportCallback) {
  const callback = onReport || logVital;

  if (typeof window === 'undefined') return;

  // Use PerformanceObserver for modern metrics
  try {
    // LCP (Largest Contentful Paint)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        callback({
          name: 'LCP',
          value: lastEntry.startTime,
          rating: getRating('LCP', lastEntry.startTime),
          id: `lcp-${Date.now()}`,
        });
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    // FCP (First Contentful Paint)
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fcpEntry = entries.find((e) => e.name === 'first-contentful-paint');
      if (fcpEntry) {
        callback({
          name: 'FCP',
          value: fcpEntry.startTime,
          rating: getRating('FCP', fcpEntry.startTime),
          id: `fcp-${Date.now()}`,
        });
      }
    });
    fcpObserver.observe({ type: 'paint', buffered: true });

    // CLS (Cumulative Layout Shift)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput) {
          clsValue += (entry as PerformanceEntry & { value: number }).value;
        }
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    // Report CLS on page hide
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && clsValue > 0) {
        callback({
          name: 'CLS',
          value: clsValue,
          rating: getRating('CLS', clsValue),
          id: `cls-${Date.now()}`,
        });
      }
    });

    // TTFB (Time to First Byte)
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      const ttfb = navEntries[0].responseStart - navEntries[0].requestStart;
      callback({
        name: 'TTFB',
        value: ttfb,
        rating: getRating('TTFB', ttfb),
        id: `ttfb-${Date.now()}`,
      });
    }
  } catch {
    // PerformanceObserver not supported
  }
}

function logVital(metric: WebVitalMetric) {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

  if (import.meta.env.DEV) {
    // Cores do console DEV (%c) exigem hex literal — o console não resolve var().
    // Valores resolvidos do DS (success/warning/danger). gate-allow: dev console.
    const color =
      metric.rating === 'good'
        ? '#2E9E6B' // gate-allow: dev console
        : metric.rating === 'needs-improvement'
          ? '#D9920A' // gate-allow: dev console
          : '#D24545'; // gate-allow: dev console
    console.log(
      `%c[Web Vital] ${metric.name}: ${Math.round(metric.value)}ms (${metric.rating})`,
      `color: ${color}; font-weight: bold;`
    );
  }

  // Send to Sentry if configured
  if (sentryDsn && typeof window !== 'undefined' && (window as Record<string, unknown>).Sentry) {
    const Sentry = (window as Record<string, unknown>).Sentry as {
      captureMessage: (msg: string, opts: Record<string, unknown>) => void;
    };
    if (metric.rating === 'poor') {
      Sentry.captureMessage(`Poor Web Vital: ${metric.name}`, {
        level: 'warning',
        extra: { value: metric.value, rating: metric.rating },
      });
    }
  }
}
