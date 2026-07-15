"use client";

import React, { useEffect, useState } from "react";
import { HudButton } from "./HudButton";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "kouppi_pwa_install_dismissed";

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !visible || !deferred) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] max-w-md mx-auto rounded-xl border border-gold/30 bg-bg-casino-mid/95 p-4 shadow-xl backdrop-blur-sm">
      <p className="font-display text-gold-light text-sm mb-1">Install KOUPPI</p>
      <p className="text-xs text-gray-400 font-ui mb-3">
        Add to your home screen for quick access with friends.
      </p>
      <div className="flex gap-2">
        <HudButton
          variant="success"
          size="sm"
          onClick={async () => {
            await deferred.prompt();
            const choice = await deferred.userChoice;
            if (choice.outcome === "accepted") setVisible(false);
            setDeferred(null);
          }}
        >
          Install
        </HudButton>
        <HudButton
          variant="ghost"
          size="sm"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
        >
          Not now
        </HudButton>
      </div>
    </div>
  );
}
