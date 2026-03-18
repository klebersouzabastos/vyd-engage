import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./utils/sentry";
import { reportWebVitals } from "./utils/webVitals";

// Initialize Sentry before rendering (loads from CDN if VITE_SENTRY_DSN is set)
initSentry();

createRoot(document.getElementById("root")!).render(<App />);

// Report Web Vitals metrics
reportWebVitals();
  