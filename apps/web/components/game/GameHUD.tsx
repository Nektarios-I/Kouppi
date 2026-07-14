"use client";

import React from "react";

export interface GameHUDBadge {
  id: string;
  label: React.ReactNode;
  className?: string;
  variant?: "default" | "gold" | "live" | "muted";
}

export interface TurnTimerProps {
  remaining: number;
  total: number;
}

function TurnTimerBar({ remaining, total }: TurnTimerProps) {
  const percentage = Math.max(0, Math.min(100, (remaining / total) * 100));
  const isLow = remaining <= 10;
  const isCritical = remaining <= 5;

  return (
    <div className="hud-timer" role="timer" aria-label={`Turn timer: ${remaining} seconds`}>
      <div className="hud-timer-ring" style={{ "--timer-pct": `${percentage}%` } as React.CSSProperties}>
        <span className={`hud-timer-value tabular-nums ${isCritical ? "text-error animate-pulse" : isLow ? "text-warning" : "text-gold-light"}`}>
          {remaining}
        </span>
      </div>
      <span className="hud-timer-label font-ui">sec</span>
    </div>
  );
}

export interface GameHUDProps {
  title: React.ReactNode;
  titleClassName?: string;
  badges?: GameHUDBadge[];
  leftExtra?: React.ReactNode;
  rightActions?: React.ReactNode;
  turnTimer?: TurnTimerProps | null;
  statusBanner?: React.ReactNode;
  resultBanner?: React.ReactNode;
  timeoutBanner?: React.ReactNode;
  className?: string;
}

const BADGE_VARIANT: Record<NonNullable<GameHUDBadge["variant"]>, string> = {
  default: "hud-badge",
  gold: "hud-badge hud-badge-gold",
  live: "hud-badge hud-badge-live",
  muted: "hud-badge hud-badge-muted",
};

export default function GameHUD({
  title,
  titleClassName = "",
  badges = [],
  leftExtra,
  rightActions,
  turnTimer,
  statusBanner,
  resultBanner,
  timeoutBanner,
  className = "",
}: GameHUDProps) {
  return (
    <div className={`space-y-3 mb-4 ${className}`}>
      <header className="hud-header-strip">
        <div className="hud-header-glow" aria-hidden="true" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
            <h1
              className={`font-display font-bold text-xl sm:text-2xl text-gold-light tracking-wider truncate ${titleClassName}`}
            >
              {title}
            </h1>
            {leftExtra}
            {badges.map((badge) => (
              <span
                key={badge.id}
                className={`${BADGE_VARIANT[badge.variant ?? "default"]} ${badge.className ?? ""}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end">
            {turnTimer && <TurnTimerBar {...turnTimer} />}
            {rightActions}
          </div>
        </div>
      </header>

      {timeoutBanner}
      {statusBanner}
      {resultBanner}
    </div>
  );
}

export function GameResultBanner({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "pass" | "win" | "loss";
}) {
  const styles = {
    pass: "hud-result-banner hud-result-pass",
    win: "hud-result-banner hud-result-win",
    loss: "hud-result-banner hud-result-loss",
  };

  return (
    <div className={styles[variant]} role="status">
      {children}
    </div>
  );
}

export function GameStatusBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="hud-status-banner font-ui" role="status">
      {children}
    </div>
  );
}
