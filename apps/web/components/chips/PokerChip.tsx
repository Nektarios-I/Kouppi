"use client";

import React from "react";
import type { ChipDenomination } from "@/lib/chips/denominations";
import type { PokerChipSize } from "@/lib/chips/types";

const SIZE_PX: Record<PokerChipSize, { outer: number; text: string; showLabel: boolean }> = {
  xs: { outer: 18, text: "text-[5px]", showLabel: false },
  sm: { outer: 24, text: "text-[6px]", showLabel: true },
  md: { outer: 32, text: "text-[8px]", showLabel: true },
  lg: { outer: 40, text: "text-[10px]", showLabel: true },
};

export type PokerChipProps = {
  denomination: ChipDenomination;
  size?: PokerChipSize;
  /** Stack depth index (0 = bottom). */
  stackIndex?: number;
  /** When true, chip is decorative (parent announces amount). */
  decorative?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Cosmetic skin class (e.g. gold-edge) */
  skinClass?: string;
};

/**
 * Stateless casino chip primitive. Value comes from denomination metadata — never invents amounts.
 */
export function PokerChip({
  denomination,
  size = "sm",
  stackIndex = 0,
  decorative = true,
  className = "",
  style,
  skinClass = "",
}: PokerChipProps) {
  const sz = SIZE_PX[size];
  const { fill, edge, stripe, text, label, ariaLabel } = denomination;

  return (
    <div
      className={`kouppi-poker-chip relative shrink-0 ${skinClass} ${className}`}
      style={{
        width: sz.outer,
        height: sz.outer,
        ...style,
      }}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : ariaLabel}
      role={decorative ? undefined : "img"}
      data-chip-key={denomination.key}
      data-chip-value={denomination.value}
      data-stack-index={stackIndex}
    >
      {/* Outer rim / edge cylinder */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 32% 28%, ${lighten(fill, 0.12)} 0%, ${fill} 42%, ${edge} 100%)`,
          boxShadow: `
            0 2px 4px rgba(0,0,0,0.55),
            0 1px 1px rgba(0,0,0,0.35),
            inset 0 1px 2px rgba(255,255,255,0.22),
            inset 0 -2px 4px rgba(0,0,0,0.4)
          `,
        }}
      />
      {/* Alternating edge inlays */}
      <div
        className="absolute inset-[2px] rounded-full pointer-events-none"
        style={{
          border: `2px dashed ${stripe}`,
          opacity: 0.5,
        }}
        aria-hidden="true"
      />
      {/* Inner disc */}
      <div
        className="absolute inset-[18%] rounded-full flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${lighten(fill, 0.18)} 0%, ${fill} 55%, ${edge} 100%)`,
          border: `1px solid ${stripe}55`,
          boxShadow: "inset 0 1px 2px rgba(255,255,255,0.15)",
        }}
      >
        {sz.showLabel ? (
          <span
            className={`relative z-10 font-bold font-ui leading-none ${sz.text}`}
            style={{
              color: text,
              textShadow: "0 1px 1px rgba(0,0,0,0.45)",
            }}
          >
            {label}
          </span>
        ) : null}
      </div>
      {/* Soft top highlight */}
      <div
        className="absolute inset-x-[18%] top-[10%] h-[22%] rounded-full pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, transparent 100%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}

function lighten(hex: string, amount: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const n = parseInt(raw, 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (n & 0xff) + Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export default PokerChip;
