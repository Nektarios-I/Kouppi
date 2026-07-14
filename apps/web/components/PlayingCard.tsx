"use client";

import React, { useState, useEffect } from "react";

const SUIT_MAP: Record<string, string> = {
  S: "S",
  H: "H",
  D: "D",
  C: "C",
};

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

const CARDS_CDN = "https://cdn.jsdelivr.net/npm/cardsjs@1.1.0/cards";

export type CardSize = "small" | "medium" | "large";

const SIZE_CLASSES: Record<CardSize, string> = {
  small: "w-11 h-[66px] sm:w-[52px] sm:h-[78px]",
  medium: "w-16 h-24 sm:w-[72px] sm:h-[108px]",
  large: "w-24 h-36 sm:w-28 sm:h-[168px]",
};

const CORNER_TEXT: Record<CardSize, string> = {
  small: "text-[9px] sm:text-[10px]",
  medium: "text-xs sm:text-sm",
  large: "text-sm sm:text-base",
};

const CENTER_TEXT: Record<CardSize, string> = {
  small: "text-base sm:text-lg",
  medium: "text-xl sm:text-2xl",
  large: "text-3xl sm:text-4xl",
};

function getSuitSymbol(suit: string): string {
  switch (suit.toUpperCase()) {
    case "S":
      return "♠";
    case "H":
      return "♥";
    case "D":
      return "♦";
    case "C":
      return "♣";
    default:
      return suit;
  }
}

function isRedSuit(suit: string): boolean {
  const s = suit.toUpperCase();
  return s === "H" || s === "D";
}

interface CardShellProps {
  size: CardSize;
  highlight?: boolean;
  animate?: "deal" | "none";
  faceDown?: boolean;
  className?: string;
  children: React.ReactNode;
}

function CardShell({
  size,
  highlight = false,
  animate = "none",
  faceDown = false,
  className = "",
  children,
}: CardShellProps) {
  return (
    <div
      className={`
        playing-card-shell ${SIZE_CLASSES[size]} relative
        ${animate === "deal" ? "animate-card-deal" : ""}
        ${highlight ? "playing-card-highlight animate-card-glow z-10" : ""}
        ${faceDown ? "playing-card-back-shell" : ""}
        ${className}
      `}
    >
      <div className="playing-card-bevel absolute inset-0">
        <div className="playing-card-face absolute inset-[3px] sm:inset-1 overflow-hidden rounded-[5px]">
          {children}
        </div>
      </div>
    </div>
  );
}

function CardFallbackFace({
  rankStr,
  suit,
  size,
  faceDown,
}: {
  rankStr: string;
  suit: string;
  size: CardSize;
  faceDown: boolean;
}) {
  if (faceDown) {
    return (
      <div className="absolute inset-0 playing-card-kouppi-back flex items-center justify-center">
        <div className="text-center">
          <div className={`font-display font-bold text-gold/90 tracking-widest ${CORNER_TEXT[size]}`}>
            K
          </div>
          <div className={`text-gold/40 ${CORNER_TEXT[size]}`}>♦</div>
        </div>
      </div>
    );
  }

  const color = isRedSuit(suit) ? "text-red-600" : "text-gray-900";

  return (
    <div className={`absolute inset-0 bg-white font-ui ${color}`}>
      {/* Top-left index */}
      <div className={`absolute top-1 left-1.5 leading-none flex flex-col items-center ${CORNER_TEXT[size]}`}>
        <span className="font-bold">{rankStr}</span>
        <span>{getSuitSymbol(suit)}</span>
      </div>
      {/* Center pip */}
      <div className={`absolute inset-0 flex items-center justify-center ${CENTER_TEXT[size]}`}>
        {getSuitSymbol(suit)}
      </div>
      {/* Bottom-right index (inverted) */}
      <div
        className={`absolute bottom-1 right-1.5 leading-none flex flex-col items-center rotate-180 ${CORNER_TEXT[size]}`}
      >
        <span className="font-bold">{rankStr}</span>
        <span>{getSuitSymbol(suit)}</span>
      </div>
    </div>
  );
}

interface PlayingCardProps {
  rank: number;
  suit: string;
  highlight?: boolean;
  size?: CardSize;
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
  const [imgFailed, setImgFailed] = useState(false);
  const rankStr = RANK_MAP[rank] || String(rank);
  const suitStr = SUIT_MAP[suit.toUpperCase()] || "S";
  const cardFile = faceDown ? "Back" : `${rankStr}${suitStr}`;
  const cardUrl = `${CARDS_CDN}/${cardFile}.svg`;

  useEffect(() => {
    setImgFailed(false);
  }, [cardUrl]);

  const showFallback = imgFailed || faceDown;

  return (
    <CardShell size={size} highlight={highlight} animate={animate} faceDown={faceDown} className={className}>
      {!showFallback && (
        <img
          src={cardUrl}
          alt={faceDown ? "Card back" : `${rankStr} of ${suit}`}
          className="w-full h-full object-cover"
          draggable={false}
          onError={() => setImgFailed(true)}
        />
      )}
      {showFallback && (
        <CardFallbackFace rankStr={rankStr} suit={suit} size={size} faceDown={faceDown} />
      )}
      {!faceDown && !imgFailed && (
        <div className="absolute inset-0 playing-card-glass-sheen pointer-events-none rounded-[5px]" />
      )}
    </CardShell>
  );
}

export function CardBack({
  size = "medium",
  className = "",
}: {
  size?: CardSize;
  className?: string;
}) {
  return <PlayingCard rank={1} suit="S" faceDown size={size} className={className} />;
}

export function HiddenCard({
  size = "medium",
  className = "",
}: {
  size?: CardSize;
  className?: string;
}) {
  return (
    <CardShell size={size} className={className}>
      <div className="absolute inset-0 playing-card-hidden-face flex items-center justify-center">
        <span className={`font-display font-bold text-gold/80 ${CENTER_TEXT[size]}`}>?</span>
      </div>
    </CardShell>
  );
}

interface FlipCardProps {
  rank: number;
  suit: string;
  revealed: boolean;
  highlight?: boolean;
  size?: CardSize;
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
      const timer = setTimeout(() => {
        setIsFlipped(true);
        if (onFlipComplete) setTimeout(onFlipComplete, 600);
      }, 100);
      return () => clearTimeout(timer);
    }
    if (!revealed) setIsFlipped(false);
  }, [revealed, isFlipped, onFlipComplete]);

  return (
    <div className={`card-flip-container ${SIZE_CLASSES[size]} ${className}`}>
      <div className={`card-flip-inner ${isFlipped ? "flipped" : ""}`}>
        <div className="card-flip-front">
          <PlayingCard rank={1} suit="S" faceDown size={size} />
        </div>
        <div className="card-flip-back">
          <PlayingCard rank={rank} suit={suit} highlight={highlight} size={size} animate="deal" />
        </div>
      </div>
    </div>
  );
}

export default PlayingCard;
