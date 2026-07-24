"use client";

import React from "react";
import ChipStack from "@/components/chips/ChipStack";
import { formatChipAmountExact } from "@/lib/chips/formatChipAmount";
import { formatSeatAmount } from "@/components/game/seatLayout";

export interface PlayerBetMarkerProps {
  amount: number;
  isCurrentTurn?: boolean;
  compact?: boolean;
}

/**
 * Active wager marker between bankroll stack and pot.
 * Only rendered when parent has authoritative per-seat bet amount (> 0).
 */
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
      aria-label={`Bet ${formatChipAmountExact(amount)}`}
      title={`Bet ${formatChipAmountExact(amount)}`}
    >
      <ChipStack
        amount={amount}
        context="player-bet"
        size={compact ? "xs" : "sm"}
        dense
        ariaLabel={`Wager ${formatChipAmountExact(amount)} chips`}
      />
      <span className="player-bet-marker__amount font-ui tabular-nums">
        {formatSeatAmount(amount)}
      </span>
    </div>
  );
}
