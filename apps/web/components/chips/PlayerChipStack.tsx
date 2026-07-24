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
 * Compact bankroll chip stack in front of a seat (toward table center).
 * Exact bankroll remains in PlayerSeat text — this is visual only.
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
  const dense = mobile || isLocal;
  const size = mobile ? "xs" : isLocal ? "xs" : "sm";

  return (
    <div
      className={`player-chip-stack pointer-events-none ${dense ? "player-chip-stack--dense" : ""} ${className}`}
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
