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

createRoot(document.getElementById("root")!).render(<App />);
