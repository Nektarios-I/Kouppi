"use client";

import { PlayingCard, HiddenCard, FlipCard } from "@/components/PlayingCard";
import type { CenterCardsPresentation } from "./useCenterCardsPresentation";

interface CenterCardsProps {
  presentation: CenterCardsPresentation;
  size?: "small" | "medium" | "large";
}

export default function CenterCards({ presentation, size = "medium" }: CenterCardsProps) {
  if (presentation.mode === "waiting") {
    return (
      <div className="center-cards-waiting text-gray-400/90 text-sm py-4 font-ui text-center max-w-[220px] rounded-lg px-3">
        {presentation.message}
      </div>
    );
  }

  const gapClass = presentation.gap === "wide" ? "gap-3 sm:gap-5" : "gap-2 sm:gap-3";

  return (
    <div className="center-cards-stage relative">
      {/* Subtle felt pad under cards */}
      <div className="center-cards-pad absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
      <div className={`relative z-10 flex items-center justify-center ${gapClass}`}>
        {presentation.items.map((item, index) => {
          switch (item.type) {
            case "card":
              return (
                <PlayingCard
                  key={`card-${index}`}
                  rank={item.card.rank}
                  suit={item.card.suit}
                  size={size}
                  animate={item.animate ? "deal" : "none"}
                />
              );
            case "hidden":
              return <HiddenCard key={`hidden-${index}`} size={size} />;
            case "flip":
              return (
                <FlipCard
                  key={`flip-${index}`}
                  rank={item.card.rank}
                  suit={item.card.suit}
                  revealed={item.revealed}
                  highlight={item.highlight}
                  size={size}
                />
              );
            case "pass":
              return (
                <div
                  key={`pass-${index}`}
                  className="flex flex-col items-center justify-center px-3 py-2 min-w-[52px] rounded-lg border border-gold/25 bg-black/40 backdrop-blur-sm"
                >
                  <span className="text-gold-light font-display font-bold text-sm sm:text-base tracking-[0.2em] drop-shadow">
                    PASS
                  </span>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
