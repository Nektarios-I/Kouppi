"use client";

import React from "react";
import ChipStack from "@/components/chips/ChipStack";
import { formatChipAmountExact } from "@/lib/chips/formatChipAmount";

export type PotChipStackProps = {
  amount: number;
  /** Show "POT" caption under amount */
  showCaption?: boolean;
  className?: string;
  animate?: boolean;
};

/**
 * Central pot chip stack. Slightly larger than player stacks.
 * Exact pot number remains the authoritative readable value.
 */
export function PotChipStack({
  amount,
  showCaption = true,
  className = "",
  animate = true,
}: PotChipStackProps) {
  const safe = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  const exact = formatChipAmountExact(safe);

  return (
    <div
      className={`pot-chip-stack flex flex-col items-center gap-1 ${className}`}
      data-pot-chip-stack="true"
      role="group"
      aria-label={`Pot: ${exact} chips`}
    >
      {safe > 0 ? (
        <ChipStack
          amount={safe}
          context="pot"
          size="sm"
          animate={animate}
          className="scale-95 sm:scale-110"
          ariaLabel={`Pot chips ${exact}`}
        />
      ) : null}
      <div className="table-pot-amount px-4 py-1 rounded-full mt-0.5">
        <span className="font-display text-xl sm:text-2xl font-bold text-gold-light tabular-nums drop-shadow-md">
          {exact}
        </span>
      </div>
      {showCaption ? (
        <span className="text-[9px] sm:text-[10px] text-gold/50 font-ui tracking-[0.3em] uppercase">
          Pot
        </span>
      ) : null}
    </div>
  );
}

export default PotChipStack;
