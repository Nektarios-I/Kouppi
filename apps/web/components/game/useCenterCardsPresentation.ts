import type { Upcards } from "@kouppi/game-core";
import { useMemo } from "react";

export interface CardFace {
  rank: number;
  suit: string;
}

export type CenterCardItem =
  | { type: "card"; card: CardFace; animate?: boolean }
  | { type: "hidden" }
  | { type: "flip"; card: CardFace; highlight?: boolean; revealed: boolean }
  | { type: "pass" };

export type CenterCardsPresentation =
  | { mode: "cards"; items: CenterCardItem[]; gap?: "normal" | "wide" }
  | { mode: "waiting"; message: string };

export interface LastResolutionView {
  kind: "bet" | "kouppi" | "shistri" | "pass";
  upcards: { a: CardFace; b: CardFace };
  reveal?: CardFace;
}

export interface CenterCardsInput {
  awaitingNext: boolean;
  upcards?: { a: CardFace; b: CardFace } | null;
  reveal?: CardFace | null;
  lastResolution?: LastResolutionView | null;
  /** When true, left/right upcards are hidden (bankrupt player) */
  hideSideCards?: boolean;
  waitingMessage?: string;
}

export function getCenterCardsPresentation(
  input: CenterCardsInput
): CenterCardsPresentation {
  const {
    awaitingNext,
    upcards,
    reveal,
    lastResolution,
    hideSideCards = false,
    waitingMessage = "Waiting for cards...",
  } = input;

  if (awaitingNext && lastResolution) {
    if (lastResolution.kind === "pass") {
      return {
        mode: "cards",
        gap: "wide",
        items: [
          { type: "card", card: lastResolution.upcards.a, animate: true },
          { type: "pass" },
          { type: "card", card: lastResolution.upcards.b, animate: true },
        ],
      };
    }

    return {
      mode: "cards",
      items: [
        { type: "card", card: lastResolution.upcards.a, animate: true },
        lastResolution.reveal
          ? {
              type: "flip",
              card: lastResolution.reveal,
              highlight: true,
              revealed: true,
            }
          : { type: "hidden" },
        { type: "card", card: lastResolution.upcards.b, animate: true },
      ],
    };
  }

  if (upcards) {
    const left: CenterCardItem = hideSideCards
      ? { type: "hidden" }
      : { type: "card", card: upcards.a, animate: true };

    const center: CenterCardItem = reveal
      ? { type: "flip", card: reveal, highlight: true, revealed: true }
      : { type: "hidden" };

    const right: CenterCardItem = hideSideCards
      ? { type: "hidden" }
      : { type: "card", card: upcards.b, animate: true };

    return {
      mode: "cards",
      items: [left, center, right],
    };
  }

  return { mode: "waiting", message: waitingMessage };
}

export function useCenterCardsPresentation(input: CenterCardsInput): CenterCardsPresentation {
  return useMemo(
    () => getCenterCardsPresentation(input),
    [
      input.awaitingNext,
      input.upcards,
      input.reveal,
      input.lastResolution,
      input.hideSideCards,
      input.waitingMessage,
    ]
  );
}
