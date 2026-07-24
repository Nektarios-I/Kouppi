"use client";

import React, { useMemo } from "react";
import {
  KOUPPI_CHIP_DENOMINATIONS,
  buildVisualChipStack,
  getChipDenominationByKey,
  type ChipDenominationKey,
} from "@/lib/chips";
import ChipStackOfficial from "@/components/chips/ChipStack";
import PokerChip from "@/components/chips/PokerChip";

/** @deprecated Use ChipDenominationKey from @/lib/chips */
export type ChipColor = ChipDenominationKey | "gold";

/** Map legacy color names onto official denominations. */
function legacyColorToKey(color: ChipColor): ChipDenominationKey {
  if (color === "gold") return "green"; // former 50 → nearest standard (25 green)
  return color;
}

export function getChipColor(amount: number): ChipColor {
  const n = Number.isFinite(amount) ? Math.floor(amount) : 0;
  for (const d of KOUPPI_CHIP_DENOMINATIONS) {
    if (n >= d.value) return d.key;
  }
  return "ivory";
}

/** @deprecated Prefer decomposeAmountToChips / buildVisualChipStack */
export function breakdownChips(total: number, maxChips = 6): ChipColor[] {
  const stack = buildVisualChipStack(total, "transfer", {
    maxTotalDiscs: maxChips,
    maxVisiblePerDenomination: maxChips,
  });
  const colors: ChipColor[] = [];
  for (const sub of stack.renderedStacks) {
    for (let i = 0; i < sub.visibleChipCount; i++) {
      colors.push(sub.denomination.key);
      if (colors.length >= maxChips) return colors;
    }
  }
  if (colors.length === 0 && total > 0) colors.push("ivory");
  return colors;
}

interface ChipProps {
  amount?: number;
  label?: string;
  size?: "small" | "medium" | "large";
  color?: ChipColor;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP = {
  small: "xs" as const,
  medium: "sm" as const,
  large: "md" as const,
};

/** @deprecated Prefer PokerChip from @/components/chips/PokerChip */
export function Chip({
  amount,
  label,
  size = "medium",
  color,
  className = "",
  style,
}: ChipProps) {
  const key = legacyColorToKey(color ?? getChipColor(amount ?? 0));
  const denom =
    getChipDenominationByKey(key) ?? KOUPPI_CHIP_DENOMINATIONS[KOUPPI_CHIP_DENOMINATIONS.length - 1];
  const pokerSize = SIZE_MAP[size];

  // If a custom label is requested and differs, still render denomination text on chip;
  // parent can overlay amount separately.
  void label;

  return (
    <PokerChip
      denomination={denom}
      size={pokerSize}
      decorative
      className={className}
      style={style}
    />
  );
}

interface ChipStackProps {
  amount: number;
  animate?: boolean;
  size?: "small" | "medium" | "large";
  className?: string;
}

/** @deprecated Prefer ChipStack / PotChipStack from @/components/chips */
export function ChipStack({
  amount,
  animate = false,
  size = "medium",
  className = "",
}: ChipStackProps) {
  const pokerSize = SIZE_MAP[size];
  return (
    <ChipStackOfficial
      amount={amount}
      context="pot"
      size={pokerSize}
      animate={animate}
      className={className}
    />
  );
}

/** @deprecated Unused in production — kept for API stability */
export function ChipFlyAnimation(_props: {
  active: boolean;
  amount: number;
  onComplete?: () => void;
}) {
  return null;
}

/** @deprecated Prefer PotChipStack */
export function AnimatedPot({
  amount,
  className = "",
}: {
  amount: number;
  previousAmount?: number;
  className?: string;
}) {
  const display = useMemo(
    () => (Number.isFinite(amount) ? Math.floor(amount) : 0),
    [amount]
  );
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ChipStack amount={display} size="small" />
      <span className="font-display text-xl font-bold text-gold-light">{display}</span>
    </div>
  );
}

export default Chip;
