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
 *
 * Mobile: bare amount first, chips to its RIGHT and slightly up,
 * sitting in the band between top-opponent chips and center cards.
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
      className={`pot-chip-stack ${className}`.trim()}
      data-pot-chip-stack="true"
      role="group"
      aria-label={`Pot: ${exact} chips`}
    >
      <div className="pot-chip-stack__label">
        <div className="table-pot-amount">
          <span className="table-pot-amount__value font-display font-bold text-gold-light tabular-nums drop-shadow-md">
            {exact}
          </span>
        </div>
        {showCaption ? (
          <span className="pot-chip-stack__caption font-ui uppercase">Pot</span>
        ) : null}
      </div>
      {safe > 0 ? (
        <ChipStack
          amount={safe}
          context="pot"
          size="sm"
          animate={animate}
          className="pot-chip-stack__chips"
          ariaLabel={`Pot chips ${exact}`}
        />
      ) : null}
    </div>
  );
}

export default PotChipStack;
