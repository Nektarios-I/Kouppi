import type { DeckCount, DeckShufflePolicy } from "@kouppi/game-core";

export const AUTO_TABLE_DECK_POLICY: { deckCount: DeckCount; shufflePolicy: DeckShufflePolicy } = {
  deckCount: 1,
  shufflePolicy: "RESET_EACH_ROUND",
};

export const CAREER_TABLE_DECK_POLICY: { deckCount: DeckCount; shufflePolicy: DeckShufflePolicy } = {
  deckCount: 1,
  shufflePolicy: "RESET_EACH_ROUND",
};
