"use client";

import React from "react";

export type PlayerStatusBadgeKind = "bot" | "turn" | "offline" | "you";

export interface PlayerStatusBadgeProps {
  kind: PlayerStatusBadgeKind;
  label?: string;
  className?: string;
}

const KIND_CLASS: Record<PlayerStatusBadgeKind, string> = {
  bot: "player-status-badge player-status-badge--bot",
  turn: "player-status-badge player-status-badge--turn",
  offline: "player-status-badge player-status-badge--offline",
  you: "player-status-badge player-status-badge--you",
};

const DEFAULT_LABEL: Record<PlayerStatusBadgeKind, string> = {
  bot: "BOT",
  turn: "TURN",
  offline: "OFF",
  you: "YOU",
};

export default function PlayerStatusBadge({
  kind,
  label,
  className = "",
}: PlayerStatusBadgeProps) {
  return (
    <span className={`${KIND_CLASS[kind]} ${className}`.trim()}>
      {label ?? DEFAULT_LABEL[kind]}
    </span>
  );
}
