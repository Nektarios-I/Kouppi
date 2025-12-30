"use client";

import { useState, useEffect } from "react";

interface ChipProps {
  amount?: number;
  size?: "small" | "medium" | "large";
  color?: "red" | "green" | "blue" | "gold" | "black";
  className?: string;
}

const CHIP_COLORS = {
  red: { bg: "from-red-600 to-red-700", border: "border-red-400", stripe: "bg-red-400" },
  green: { bg: "from-green-600 to-green-700", border: "border-green-400", stripe: "bg-green-400" },
  blue: { bg: "from-blue-600 to-blue-700", border: "border-blue-400", stripe: "bg-blue-400" },
  gold: { bg: "from-yellow-500 to-yellow-600", border: "border-yellow-300", stripe: "bg-yellow-300" },
  black: { bg: "from-gray-800 to-gray-900", border: "border-gray-500", stripe: "bg-gray-500" },
};

// Single chip display
export function Chip({ amount, size = "medium", color = "gold", className = "" }: ChipProps) {
  const sizeClasses = {
    small: "w-8 h-8 text-xs",
    medium: "w-12 h-12 text-sm",
    large: "w-16 h-16 text-base",
  };

  const colors = CHIP_COLORS[color];

  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-full bg-gradient-to-br ${colors.bg}
        border-4 ${colors.border}
        flex items-center justify-center font-bold text-white
        shadow-lg relative overflow-hidden
        ${className}
      `}
    >
      {/* Chip pattern */}
      <div className={`absolute w-full h-1 ${colors.stripe} top-1.5 opacity-60`} />
      <div className={`absolute w-full h-1 ${colors.stripe} bottom-1.5 opacity-60`} />
      <div className={`absolute w-1 h-full ${colors.stripe} left-1.5 opacity-60`} />
      <div className={`absolute w-1 h-full ${colors.stripe} right-1.5 opacity-60`} />
      
      {/* Center emblem */}
      <div className="relative z-10 font-bold drop-shadow">
        {amount !== undefined ? formatAmount(amount) : "💰"}
      </div>
    </div>
  );
}

function formatAmount(amount: number): string {
  if (amount >= 1000) return `${Math.floor(amount / 1000)}K`;
  if (amount >= 100) return `${amount}`;
  return `${amount}`;
}

function getChipColor(amount: number): ChipProps["color"] {
  if (amount >= 100) return "black";
  if (amount >= 50) return "gold";
  if (amount >= 25) return "green";
  if (amount >= 10) return "blue";
  return "red";
}

// Animated chip flying to pot
interface ChipAnimationProps {
  active: boolean;
  amount: number;
  startPosition?: { x: number; y: number };
  onComplete?: () => void;
}

export function ChipFlyAnimation({ active, amount, onComplete }: ChipAnimationProps) {
  const [chips, setChips] = useState<Array<{ id: number; delay: number; x: number }>>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (active) {
      // Generate 3-5 chips flying
      const chipCount = Math.min(5, Math.max(3, Math.ceil(amount / 20)));
      const newChips = Array.from({ length: chipCount }, (_, i) => ({
        id: i,
        delay: i * 0.1,
        x: 40 + Math.random() * 20, // Spread around center
      }));
      setChips(newChips);
      setIsVisible(true);

      const timer = setTimeout(() => {
        setIsVisible(false);
        setChips([]);
        if (onComplete) onComplete();
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [active, amount, onComplete]);

  if (!isVisible || chips.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {chips.map((chip) => (
        <div
          key={chip.id}
          className="absolute animate-chip-fly"
          style={{
            left: `${chip.x}%`,
            bottom: "30%",
            animationDelay: `${chip.delay}s`,
          }}
        >
          <Chip amount={amount} size="medium" color={getChipColor(amount)} />
        </div>
      ))}
    </div>
  );
}

// Chip stack that appears in pot
interface ChipStackProps {
  amount: number;
  animate?: boolean;
  size?: "small" | "medium" | "large";
  className?: string;
}

export function ChipStack({ amount, animate = false, size = "medium", className = "" }: ChipStackProps) {
  // Calculate number of chips to show (max 5 stacked)
  const stackCount = Math.min(5, Math.max(1, Math.ceil(amount / 25)));
  
  return (
    <div className={`relative ${className}`}>
      {Array.from({ length: stackCount }, (_, i) => (
        <div
          key={i}
          className={animate ? "animate-chip-stack" : ""}
          style={{
            position: i === 0 ? "relative" : "absolute",
            bottom: i * 4,
            left: i * 2,
            animationDelay: animate ? `${i * 0.1}s` : undefined,
            zIndex: stackCount - i,
          }}
        >
          <Chip amount={i === stackCount - 1 ? amount : undefined} size={size} color={getChipColor(amount)} />
        </div>
      ))}
    </div>
  );
}

// Animated pot display
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
      
      // Animate the number counting up
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
    } else {
      setDisplayAmount(amount);
    }
  }, [amount, previousAmount]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ChipStack amount={amount} size="small" />
      <span
        className={`
          font-mono text-xl font-bold text-yellow-400
          ${shouldPulse ? "animate-pot-pulse" : ""}
        `}
      >
        💰 {displayAmount}
      </span>
    </div>
  );
}

export default Chip;
