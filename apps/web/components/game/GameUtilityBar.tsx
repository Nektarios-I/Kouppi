"use client";

import type { ReactNode } from "react";
import { useSounds } from "@/hooks/useSounds";
import type { TurnTimerProps } from "./GameHUD";

export interface GameUtilityBarProps {
  modeLabel: string;
  settings: ReactNode;
  turnTimer?: TurnTimerProps | null;
  badges?: ReactNode;
}

export default function GameUtilityBar({
  modeLabel,
  settings,
  turnTimer,
  badges,
}: GameUtilityBarProps) {
  const { isMuted, toggleMute, sounds } = useSounds();
  const percentage = turnTimer
    ? Math.max(0, Math.min(100, (turnTimer.remaining / turnTimer.total) * 100))
    : 0;

  return (
    <header className="game-utility-bar">
      <div className="game-utility-brand">
        <span className="game-utility-mark" aria-hidden="true">K</span>
        <span className="font-display game-utility-title">KOUPPI</span>
        <span className="game-utility-mode font-ui">{modeLabel}</span>
      </div>
      <div className="game-utility-cluster">
        {badges}
        {turnTimer ? (
          <div
            className="game-utility-timer font-ui"
            role="timer"
            aria-label={`Turn timer: ${turnTimer.remaining} seconds`}
            style={{ "--timer-pct": `${percentage}%` } as React.CSSProperties}
          >
            {turnTimer.remaining}s
          </div>
        ) : null}
        <button
          type="button"
          className="game-utility-icon"
          aria-label={isMuted ? "Unmute" : "Mute"}
          aria-pressed={isMuted}
          onClick={() => {
            toggleMute();
            if (isMuted) sounds.click();
          }}
        >
          <span aria-hidden="true">{isMuted ? "🔇" : "🔊"}</span>
        </button>
        {settings}
      </div>
    </header>
  );
}
