"use client";

import React from "react";
import ChipStack from "@/components/chips/ChipStack";
import { formatChipAmountExact } from "@/lib/chips/formatChipAmount";
import type { SeatLayoutBreakpoint } from "@/components/game/seatLayout";

export type PlayerChipStackProps = {
  amount: number;
  playerId: string;
  breakpoint?: SeatLayoutBreakpoint;
  /** Local hero seat — keep compact so action dock stays clear */
  isLocal?: boolean;
  className?: string;
};

/**
 * Local hero seat — keep compact so action dock stays clear.
 * Denomination labels still render (sm size matches bot/opponent stacks).
 */
export function PlayerChipStack({
  amount,
  playerId,
  breakpoint = "desktop",
  isLocal = false,
  className = "",
}: PlayerChipStackProps) {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const mobile = breakpoint === "mobile";
  // Match bot/opponent stacks: sm discs show denom labels on top (1, 5, 10, 25…).
  // Keep dense only on mobile / local hero for dock clearance — not unlabeled xs.
  const dense = mobile || isLocal;
  const size = "sm";

  return (
    <div
      className={`player-chip-stack pointer-events-none ${dense ? "player-chip-stack--dense" : ""} ${
        isLocal ? "player-chip-stack--local" : ""
      } ${className}`}
      data-player-chip-stack={playerId}
    >
      <ChipStack
        amount={amount}
        context="player-bankroll"
        size={size}
        dense={dense}
        ariaLabel={`Player bankroll: ${formatChipAmountExact(amount)} chips`}
      />
    </div>
  );
}

export default PlayerChipStack;
