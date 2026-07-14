"use client";

import { useState, useEffect, useMemo } from "react";

export type ChipColor = "red" | "green" | "blue" | "gold" | "black" | "purple";

interface ChipDenom {
  color: ChipColor;
  label: string;
  min: number;
}

const DENOMINATIONS: ChipDenom[] = [
  { color: "purple", label: "500", min: 500 },
  { color: "black", label: "100", min: 100 },
  { color: "gold", label: "50", min: 50 },
  { color: "green", label: "25", min: 25 },
  { color: "blue", label: "10", min: 10 },
  { color: "red", label: "5", min: 1 },
];

const CHIP_PALETTE: Record<
  ChipColor,
  { face: string; edge: string; stripe: string; text: string; rim: string }
> = {
  red: {
    face: "linear-gradient(145deg, #e03040 0%, #a01828 55%, #801020 100%)",
    edge: "#ff6068",
    stripe: "#fff",
    text: "#fff",
    rim: "rgba(255,255,255,0.35)",
  },
  blue: {
    face: "linear-gradient(145deg, #3080d8 0%, #1a5098 55%, #103870 100%)",
    edge: "#60a8f0",
    stripe: "#fff",
    text: "#fff",
    rim: "rgba(255,255,255,0.35)",
  },
  green: {
    face: "linear-gradient(145deg, #30a050 0%, #1a7838 55%, #105828 100%)",
    edge: "#58c878",
    stripe: "#fff",
    text: "#fff",
    rim: "rgba(255,255,255,0.35)",
  },
  gold: {
    face: "linear-gradient(145deg, #f0d060 0%, #d4af37 45%, #a8860a 100%)",
    edge: "#ffe890",
    stripe: "#fff",
    text: "#3a2808",
    rim: "rgba(255,255,255,0.45)",
  },
  black: {
    face: "linear-gradient(145deg, #3a3a3a 0%, #1a1a1a 55%, #0a0a0a 100%)",
    edge: "#666",
    stripe: "#d4af37",
    text: "#f0d060",
    rim: "rgba(212,175,55,0.4)",
  },
  purple: {
    face: "linear-gradient(145deg, #8040c0 0%, #582898 55%, #381868 100%)",
    edge: "#a870e8",
    stripe: "#fff",
    text: "#fff",
    rim: "rgba(255,255,255,0.35)",
  },
};

const SIZE_MAP = {
  small: { chip: "w-7 h-7 sm:w-8 sm:h-8", text: "text-[7px] sm:text-[8px]", edge: 3 },
  medium: { chip: "w-10 h-10 sm:w-11 sm:h-11", text: "text-[9px] sm:text-[10px]", edge: 4 },
  large: { chip: "w-14 h-14 sm:w-16 sm:h-16", text: "text-xs sm:text-sm", edge: 5 },
};

export function getChipColor(amount: number): ChipColor {
  for (const d of DENOMINATIONS) {
    if (amount >= d.min) return d.color;
  }
  return "red";
}

function formatAmount(amount: number): string {
  if (amount >= 1000) return `${Math.floor(amount / 1000)}K`;
  return `${amount}`;
}

/** Break pot into chip denominations for realistic stacks */
export function breakdownChips(total: number, maxChips = 6): ChipColor[] {
  let remaining = Math.max(0, total);
  const result: ChipColor[] = [];

  for (const d of DENOMINATIONS) {
    while (remaining >= d.min && result.length < maxChips) {
      result.push(d.color);
      remaining -= d.min;
    }
  }

  if (result.length === 0) result.push("red");
  return result;
}

interface ChipProps {
  amount?: number;
  label?: string;
  size?: "small" | "medium" | "large";
  color?: ChipColor;
  className?: string;
  style?: React.CSSProperties;
}

export function Chip({
  amount,
  label,
  size = "medium",
  color = "gold",
  className = "",
  style,
}: ChipProps) {
  const palette = CHIP_PALETTE[color];
  const sz = SIZE_MAP[size];
  const display = label ?? (amount !== undefined ? formatAmount(amount) : "");

  return (
    <div
      className={`casino-chip relative ${sz.chip} ${className}`}
      style={style}
      aria-hidden={!display}
    >
      {/* Edge cylinder */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: palette.face,
          boxShadow: `
            0 3px 6px rgba(0,0,0,0.55),
            0 1px 2px rgba(0,0,0,0.4),
            inset 0 2px 4px ${palette.rim},
            inset 0 -3px 6px rgba(0,0,0,0.35)
          `,
        }}
      />
      {/* Edge stripes ring */}
      <div
        className="absolute inset-[2px] rounded-full casino-chip-edge"
        style={{
          border: `${sz.edge}px dashed ${palette.stripe}`,
          opacity: 0.55,
        }}
      />
      {/* Inner inlay */}
      <div
        className="absolute inset-[18%] rounded-full flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${palette.edge}44 0%, transparent 60%)`,
          border: `1px solid ${palette.rim}`,
        }}
      >
        <span
          className={`relative z-10 font-bold font-ui leading-none ${sz.text}`}
          style={{ color: palette.text, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
        >
          {display}
        </span>
      </div>
      {/* Top highlight */}
      <div
        className="absolute inset-x-[15%] top-[8%] h-[25%] rounded-full pointer-events-none"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)" }}
      />
    </div>
  );
}

interface ChipFlyAnimationProps {
  active: boolean;
  amount: number;
  onComplete?: () => void;
}

export function ChipFlyAnimation({ active, amount, onComplete }: ChipFlyAnimationProps) {
  const [chips, setChips] = useState<Array<{ id: number; delay: number; x: number; color: ChipColor }>>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!active) return;

    const colors = breakdownChips(amount, 5);
    const newChips = colors.map((color, i) => ({
      id: i,
      delay: i * 0.08,
      x: 38 + Math.random() * 24,
      color,
    }));
    setChips(newChips);
    setIsVisible(true);

    const timer = setTimeout(() => {
      setIsVisible(false);
      setChips([]);
      onComplete?.();
    }, 900);

    return () => clearTimeout(timer);
  }, [active, amount, onComplete]);

  if (!isVisible || chips.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {chips.map((chip) => (
        <div
          key={chip.id}
          className="absolute animate-chip-fly"
          style={{ left: `${chip.x}%`, bottom: "28%", animationDelay: `${chip.delay}s` }}
        >
          <Chip color={chip.color} size="medium" />
        </div>
      ))}
    </div>
  );
}

interface ChipStackProps {
  amount: number;
  animate?: boolean;
  size?: "small" | "medium" | "large";
  className?: string;
}

export function ChipStack({ amount, animate = false, size = "medium", className = "" }: ChipStackProps) {
  const stack = useMemo(() => breakdownChips(amount, 5), [amount]);
  const offset = size === "small" ? 3 : size === "large" ? 5 : 4;

  return (
    <div className={`relative inline-flex items-end justify-center ${className}`} style={{ minHeight: size === "small" ? 28 : 44 }}>
      {stack.map((color, i) => {
        const denom = DENOMINATIONS.find((d) => d.color === color);
        const isTop = i === stack.length - 1;
        return (
          <div
            key={i}
            className={animate ? "animate-chip-stack" : ""}
            style={{
              position: i === 0 ? "relative" : "absolute",
              bottom: i * offset,
              left: i * 1.5,
              animationDelay: animate ? `${i * 0.08}s` : undefined,
              zIndex: i,
            }}
          >
            <Chip
              color={color}
              size={size}
              label={isTop ? formatAmount(amount) : denom?.label}
            />
          </div>
        );
      })}
    </div>
  );
}

interface AnimatedPotProps {
  amount: number;
  previousAmount?: number;
  className?: string;
}

export function AnimatedPot({ amount, previousAmount, className = "" }: AnimatedPotProps) {
  const [shouldPulse, setShouldPulse] = useState(false);
  const [displayAmount, setDisplayAmount] = useState(amount);

  useEffect(() => {
    if (previousAmount !== undefined && amount !== previousAmount) {
      setShouldPulse(true);
      const diff = amount - previousAmount;
      const steps = 10;
      const stepValue = diff / steps;
      let current = previousAmount;
      let step = 0;

      const interval = setInterval(() => {
        step++;
        current += stepValue;
        setDisplayAmount(Math.round(current));
        if (step >= steps) {
          setDisplayAmount(amount);
          clearInterval(interval);
        }
      }, 30);

      const pulseTimer = setTimeout(() => setShouldPulse(false), 400);
      return () => {
        clearInterval(interval);
        clearTimeout(pulseTimer);
      };
    }
    setDisplayAmount(amount);
  }, [amount, previousAmount]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ChipStack amount={amount} size="small" />
      <span className={`font-display text-xl font-bold text-gold-light ${shouldPulse ? "animate-pot-pulse" : ""}`}>
        {displayAmount}
      </span>
    </div>
  );
}

export default Chip;
