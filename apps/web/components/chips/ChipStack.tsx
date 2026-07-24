"use client";

import React from "react";
import { buildVisualChipStack } from "@/lib/chips/chipPresentation";
import { formatChipAmountExact } from "@/lib/chips/formatChipAmount";
import type { ChipStackContext, PokerChipSize } from "@/lib/chips/types";
import PokerChip from "@/components/chips/PokerChip";
import { useRewardStore } from "@/store/rewardStore";
import { getChipSkinClass } from "@/lib/cosmetics";

export type ChipStackProps = {
  amount: number;
  context?: ChipStackContext;
  size?: PokerChipSize;
  /** Show exact numeric label beside/under stack */
  showExactLabel?: boolean;
  /** Dense layout for mobile / wager markers */
  dense?: boolean;
  className?: string;
  /** Accessible name for the stack container (chips inside are decorative). */
  ariaLabel?: string;
  /** Animate entry of discs */
  animate?: boolean;
};

/**
 * Visual chip stack from a real numeric amount. Does not own game state.
 * Highest denomination groups render toward the back/left; lower toward front/right.
 */
export function ChipStack({
  amount,
  context = "player-bankroll",
  size = "sm",
  showExactLabel = false,
  dense = false,
  className = "",
  ariaLabel,
  animate = false,
}: ChipStackProps) {
  const stack = buildVisualChipStack(amount, context);
  const exact = formatChipAmountExact(stack.sourceAmount);
  const chipSkinId = useRewardStore((s) => s.state?.equipped?.chipSkinId);
  const skinClass = getChipSkinClass(chipSkinId);

  if (stack.sourceAmount <= 0 || stack.renderedStacks.length === 0) {
    return null;
  }

  const gap = dense ? 2 : 4;
  const stackOffset = size === "xs" ? 2 : size === "sm" ? 3 : size === "md" ? 4 : 5;

  // On mobile dense player stacks, prefer top groups only visually (already capped).
  const groups =
    dense && context === "player-bankroll"
      ? stack.renderedStacks.slice(0, 3)
      : stack.renderedStacks;

  return (
    <div
      className={`kouppi-chip-stack inline-flex flex-col items-center ${className}`}
      role="group"
      aria-label={ariaLabel ?? `Chip stack ${exact}`}
      data-chip-context={context}
      data-chip-amount={stack.sourceAmount}
    >
      <div
        className="relative flex flex-row items-end justify-center"
        style={{ gap }}
        aria-hidden="true"
      >
        {groups.map((sub, gi) => {
                  const discs = Array.from({ length: sub.visibleChipCount }, (_, i) => i);
                  const totalCount = Math.round(
                    sub.representedValue / sub.denomination.value
                  );
                  const markerNeeded = totalCount > sub.visibleChipCount;

          return (
            <div
              key={`${sub.denomination.key}-${gi}`}
              className="relative flex flex-col items-center"
              style={{ minWidth: size === "xs" ? 16 : 22 }}
            >
              <div
                className="relative"
                style={{
                  height:
                    Math.max(1, sub.visibleChipCount) * stackOffset +
                    (size === "xs" ? 16 : size === "sm" ? 22 : size === "md" ? 30 : 38),
                  width: size === "xs" ? 18 : size === "sm" ? 24 : size === "md" ? 32 : 40,
                }}
              >
                {discs.map((i) => (
                  <div
                    key={i}
                    className={animate ? "animate-chip-stack" : undefined}
                    style={{
                      position: "absolute",
                      bottom: i * stackOffset,
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: i,
                      animationDelay: animate ? `${(gi * 5 + i) * 0.04}s` : undefined,
                    }}
                  >
                    <PokerChip
                      denomination={sub.denomination}
                      size={size}
                      stackIndex={i}
                      decorative
                      skinClass={skinClass}
                    />
                  </div>
                ))}
                {sub.visibleChipCount === 0 && markerNeeded ? (
                  <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2"
                    style={{ zIndex: 1 }}
                  >
                    <PokerChip
                      denomination={sub.denomination}
                      size={size}
                      decorative
                      skinClass={skinClass}
                    />
                  </div>
                ) : null}
              </div>
              {markerNeeded ? (
                <span
                  className="kouppi-chip-count-marker font-ui tabular-nums text-[8px] sm:text-[9px] text-white/85 leading-none mt-0.5 px-0.5 rounded bg-black/45"
                  title={`${totalCount} × ${sub.denomination.label}`}
                >
                  ×{totalCount}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {showExactLabel ? (
        <span className="mt-0.5 font-ui tabular-nums text-[10px] sm:text-xs text-gold-light/90">
          {exact}
        </span>
      ) : null}
    </div>
  );
}

export default ChipStack;
