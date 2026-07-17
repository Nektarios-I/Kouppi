"use client";

import React from "react";
import { Chip } from "@/components/ChipAnimation";
import { formatSeatAmount } from "@/components/game/seatLayout";

export interface PlayerBetMarkerProps {
  amount: number;
  isCurrentTurn?: boolean;
  compact?: boolean;
}

export default function PlayerBetMarker({
  amount,
  isCurrentTurn = false,
  compact = false,
}: PlayerBetMarkerProps) {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return (
    <div
      className={`player-bet-marker ${isCurrentTurn ? "player-bet-marker--active" : ""} ${
        compact ? "player-bet-marker--compact" : ""
      }`}
      aria-label={`Bet ${amount}`}
    >
      <Chip amount={amount} size="small" className={compact ? "scale-75" : "scale-90"} />
      <span className="player-bet-marker__amount font-ui tabular-nums">
        {formatSeatAmount(amount)}
      </span>
    </div>
  );
}
