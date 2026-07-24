"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PreGameShell } from "@/components/game/LobbyUI";
import { HudButton } from "@/components/game/HudButton";
import { useRemoteGameStore } from "@/store/remoteGameStore";

export default function HomePage() {
  useEffect(() => {
    const { roomId, disconnect } = useRemoteGameStore.getState();
    if (!roomId) disconnect();
  }, []);

  return (
    <PreGameShell>
      <div className="w-full max-w-lg text-center">
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-gold-light tracking-[0.25em] mb-3">
          KOUPPI
        </h1>
        <p className="text-gray-400 font-ui text-sm sm:text-base max-w-md mx-auto mb-10">
          Fast, casual Cypriot card game playable on web and mobile.
        </p>

        <div className="flex flex-col items-center gap-4">
          <Link href="/career" className="w-full max-w-xs no-underline">
            <HudButton variant="kouppi" size="lg" fullWidth>
              Career Mode
            </HudButton>
          </Link>

          <Link href="/rewards" className="w-full max-w-xs no-underline">
            <HudButton variant="ghost" size="lg" fullWidth>
              Reward Center
            </HudButton>
          </Link>

          <div className="flex flex-wrap justify-center gap-3 mt-2 w-full">
            <Link href="/play/single" className="no-underline">
              <HudButton variant="ghost">Single Player</HudButton>
            </Link>
            <Link href="/lobby" className="no-underline">
              <HudButton variant="success">Multiplayer</HudButton>
            </Link>
            <Link href="/how-to-play" className="no-underline">
              <HudButton variant="ghost">How to Play</HudButton>
            </Link>
          </div>
        </div>

        <footer className="mt-12 text-gray-500 text-xs sm:text-sm font-ui">
          For entertainment only. Chips have no monetary value.
          <span className="block mt-2 space-x-3">
            <Link href="/privacy" className="text-gold/70 hover:text-gold-light underline">
              Privacy
            </Link>
            <Link href="/terms" className="text-gold/70 hover:text-gold-light underline">
              Terms
            </Link>
            <Link href="/3d-preview" className="text-gold/70 hover:text-gold-light underline">
              3D preview
            </Link>
          </span>
        </footer>
      </div>
    </PreGameShell>
  );
}
