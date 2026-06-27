import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSentry } from './utils/sentry';
import { reportWebVitals } from './utils/webVitals';
import { reloadForChunkError } from './utils/chunkReload';

// Initialize Sentry before rendering (loads from CDN if VITE_SENTRY_DSN is set)
initSentry();

// Recover from stale chunks after a new deploy: Vite fires `vite:preloadError`
// when a dynamically imported module fails to load (hash changed / old asset
// removed). Reload once to fetch the fresh assets. preventDefault() suppresses
// the thrown error; if the cooldown guard blocks the reload, we let the error
// propagate so the ErrorBoundary can show its fallback.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForChunkError()) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(<App />);

// Report Web Vitals metrics
reportWebVitals();
