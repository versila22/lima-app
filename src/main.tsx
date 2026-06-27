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
      // "Build périmé" : un chunk lazy dont le hash a changé après un déploiement.
      // Transitoire et auto-réparé par le handler vite:preloadError ci-dessous, donc
      // non actionnable — on l'exclut du projet Sentry (issue récurrente sinon).
      ignoreErrors: [
        /Failed to fetch dynamically imported module/i,
        /error loading dynamically imported module/i,
        /Importing a module script failed/i,
      ],
    });
  });
}

// Auto-recover from a stale lazy-loaded chunk after a deploy: when a dynamic
// import fails because the hashed asset no longer exists (a new build shipped
// while this page was open), reload once to pick up the fresh index.html.
window.addEventListener("vite:preloadError", (event) => {
  // preventDefault() empêche Vite de relancer l'erreur : pas de flash d'error
  // boundary ni de capture parasite avant le reload, qu'on déclenche nous-mêmes.
  event.preventDefault();
  const KEY = "vite-preload-reloaded-at";
  const last = Number(sessionStorage.getItem(KEY) || 0);
  // Guard against reload loops if the asset is genuinely unreachable.
  if (Date.now() - last < 10_000) return;
  sessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
