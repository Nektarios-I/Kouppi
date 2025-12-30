"use client";

import React, { useState, useEffect } from "react";

// Card suits mapping to cardsJS file format
const SUIT_MAP: Record<string, string> = {
  S: "S", // Spades
  H: "H", // Hearts
  D: "D", // Diamonds
  C: "C", // Clubs
};

// Rank mapping to cardsJS file format
const RANK_MAP: Record<number, string> = {
  1: "A",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
};

// Use cardsJS CDN (MIT License - Vectorized Playing Cards by Chris Aguilar)
const CARDS_CDN = "https://cdn.jsdelivr.net/npm/cardsjs@1.1.0/cards";

interface PlayingCardProps {
  rank: number;
  suit: string;
  highlight?: boolean;
  size?: "small" | "medium" | "large";
  faceDown?: boolean;
  className?: string;
  animate?: "deal" | "none";
}

export function PlayingCard({
  rank,
  suit,
  highlight = false,
  size = "medium",
  faceDown = false,
  className = "",
  animate = "none",
}: PlayingCardProps) {
  const sizeClasses = {
    small: "w-12 h-[72px]",
    medium: "w-20 h-[120px]",
    large: "w-28 h-[168px]",
  };

  const rankStr = RANK_MAP[rank] || String(rank);
  const suitStr = SUIT_MAP[suit.toUpperCase()] || "S";
  
  // cardsJS naming: {Rank}{Suit}.svg (e.g., KS.svg for King of Spades)
  const cardFile = faceDown ? "Back" : `${rankStr}${suitStr}`;
  const cardUrl = `${CARDS_CDN}/${cardFile}.svg`;
  
  const animationClass = animate === "deal" ? "animate-card-deal" : "";
  const glowClass = highlight ? "animate-card-glow" : "";

  return (
    <div
      className={`
        ${sizeClasses[size]}
        relative rounded-lg overflow-hidden shadow-lg
        transition-all duration-200
        ${highlight ? "ring-4 ring-yellow-400 scale-110 z-10" : ""}
        ${animationClass}
        ${glowClass}
        ${className}
      `}
    >
      <img
        src={cardUrl}
        alt={faceDown ? "Card back" : `${rankStr} of ${suit}`}
        className="w-full h-full object-contain bg-white rounded-lg"
        draggable={false}
        onError={(e) => {
          // Fallback to text display if image fails
          (e.target as HTMLImageElement).style.display = "none";
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
        }}
      />
      {/* Fallback text display */}
      <div className="hidden absolute inset-0 bg-white rounded-lg flex items-center justify-center font-bold text-black text-lg">
        {faceDown ? "🂠" : `${rankStr}${getSuitSymbol(suit)}`}
      </div>
    </div>
  );
}

function getSuitSymbol(suit: string): string {
  switch (suit.toUpperCase()) {
    case "S": return "♠";
    case "H": return "♥";
    case "D": return "♦";
    case "C": return "♣";
    default: return suit;
  }
}

// Card back component
export function CardBack({
  size = "medium",
  className = "",
}: {
  size?: "small" | "medium" | "large";
  className?: string;
}) {
  return <PlayingCard rank={1} suit="S" faceDown size={size} className={className} />;
}

// Hidden card placeholder (question mark)
export function HiddenCard({
  size = "medium",
  className = "",
}: {
  size?: "small" | "medium" | "large";
  className?: string;
}) {
  const sizeClasses = {
    small: "w-12 h-[72px]",
    medium: "w-20 h-[120px]",
    large: "w-28 h-[168px]",
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-lg bg-gradient-to-br from-blue-800 to-blue-900
        border-2 border-blue-600 flex items-center justify-center
        shadow-lg ${className}
      `}
    >
      <span className="text-4xl text-blue-400">?</span>
    </div>
  );
}

// Flip card component - shows card back, then flips to reveal
interface FlipCardProps {
  rank: number;
  suit: string;
  revealed: boolean;
  highlight?: boolean;
  size?: "small" | "medium" | "large";
  className?: string;
  onFlipComplete?: () => void;
}

export function FlipCard({
  rank,
  suit,
  revealed,
  highlight = false,
  size = "medium",
  className = "",
  onFlipComplete,
}: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(revealed);
  
  useEffect(() => {
    if (revealed && !isFlipped) {
      // Slight delay before flip for dramatic effect
      const timer = setTimeout(() => {
        setIsFlipped(true);
        if (onFlipComplete) {
          setTimeout(onFlipComplete, 600); // After flip animation completes
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [revealed, isFlipped, onFlipComplete]);
  
  const sizeClasses = {
    small: "w-12 h-[72px]",
    medium: "w-20 h-[120px]",
    large: "w-28 h-[168px]",
  };

  return (
    <div className={`card-flip-container ${sizeClasses[size]} ${className}`}>
      <div className={`card-flip-inner ${isFlipped ? "flipped" : ""}`}>
        {/* Back of card */}
        <div className="card-flip-front">
          <PlayingCard rank={1} suit="S" faceDown size={size} />
        </div>
        {/* Front of card (revealed) */}
        <div className="card-flip-back">
          <PlayingCard rank={rank} suit={suit} highlight={highlight} size={size} />
        </div>
      </div>
    </div>
  );
}

export default PlayingCard;
