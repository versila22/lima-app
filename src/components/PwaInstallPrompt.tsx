import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "lima-pwa-install-dismissed";

export default function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    if (localStorage.getItem(DISMISS_KEY) === "true") {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const dismissPrompt = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setIsVisible(false);
  };

  const installApp = async () => {
    if (!promptEvent) {
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    if (choice.outcome !== "accepted") {
      dismissPrompt();
      return;
    }

    setIsVisible(false);
    setPromptEvent(null);
  };

  if (!isVisible || !promptEvent) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-white/10 bg-card/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">📱 Installer l&apos;app LIMA sur votre téléphone</p>
          <p className="text-xs text-muted-foreground">Accès rapide au planning, comme une vraie appli mobile.</p>
        </div>
        <div className="flex gap-2 sm:flex-shrink-0">
          <Button type="button" variant="ghost" size="sm" onClick={dismissPrompt}>
            Plus tard
          </Button>
          <Button type="button" size="sm" onClick={installApp}>
            Installer
          </Button>
        </div>
      </div>
    </div>
  );
}
