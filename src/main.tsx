import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Sentry as early as possible so React mount errors are captured.
// No-op when VITE_SENTRY_DSN is unset (local dev).
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (SENTRY_DSN) {
  // Dynamic import so the bundle stays small when Sentry is not configured.
  void import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      // Don't send PII by default
      sendDefaultPii: false,
    });
  });
}

// Auto-recover from a stale lazy-loaded chunk after a deploy: when a dynamic
// import fails because the hashed asset no longer exists (a new build shipped
// while this page was open), reload once to pick up the fresh index.html.
window.addEventListener("vite:preloadError", () => {
  const KEY = "vite-preload-reloaded-at";
  const last = Number(sessionStorage.getItem(KEY) || 0);
  // Guard against reload loops if the asset is genuinely unreachable.
  if (Date.now() - last < 10_000) return;
  sessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
