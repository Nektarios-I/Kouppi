export type Rank = 1|2|3|4|5|6|7|8|9|10|11|12|13; // A=1, J=11, Q=12, K=13
export type Suit = "S"|"H"|"D"|"C";

export const ALLOWED_DECK_COUNTS = [1, 3, 5, 7, 9] as const;
export type DeckCount = (typeof ALLOWED_DECK_COUNTS)[number];
export type DeckShufflePolicy = "RESET_EACH_ROUND" | "CONTINUOUS_SHOE";
export const DEFAULT_DECK_COUNT: DeckCount = 1;
export const DEFAULT_DECK_SHUFFLE_POLICY: DeckShufflePolicy = "RESET_EACH_ROUND";

export interface Card { id: string; rank: Rank; suit: Suit; }
export type Chips = number;

/** Default SHISTRI stake as percent of pot (product rule). */
export const SHISTRI_DEFAULT_PERCENT = 7;
export const SHISTRI_DEFAULT_MIN_CHIP = 1;

export type MinBetPolicy =
  | { type: "fixed"; value: Chips }
  | { type: "voted"; options: Chips[]; tieBreaker: "random" };

export type AnteProgressionStrategy = "MULTIPLY" | "ADD";

/** Authoritative ante progression (derived ante; do not compound mutate alone). */
export interface AnteProgressionConfig {
  enabled: boolean;
  intervalRounds: number;
  strategy: AnteProgressionStrategy;
  multiplier: number;
  incrementAmount: number | null;
  maxAnte?: number | null;
  startingAnte: Chips;
}

export interface TableConfig {
  ante: Chips;                       // current derived ante (broadcast); default 10
  startingBankroll: Chips;           // default 100
  minBetPolicy: MinBetPolicy;        // default fixed(10)
  shistri: { enabled: boolean; percent: number; minChip: number }; // default 7%, min 1
  maxPlayers: number;                // up to 20
  deckCount?: DeckCount;
  shufflePolicy?: DeckShufflePolicy;
  /** Legacy field kept for backward compatibility with older clients. */
  deckPolicy?: "single_no_reshuffle_until_empty" | "single_reshuffle_when_low";
  allowKouppi: boolean;              // always true for this game in practice
  spectatorsAllowed: boolean;
  language: "en"|"el";
  /** When omitted at create time, defaults to double every 5 completed rounds. */
  anteProgression?: AnteProgressionConfig;
}

export interface Player {
  id: string;
  name: string;
  bankroll: Chips;
  isBot: boolean;
  active: boolean; // false when bankrupt (no dealing this round)
}

export interface Upcards {
  a: Card;
  b: Card;
}

export interface TurnInfo {
  playerId: string;
  upcards?: Upcards;
  // Last bet amount placed by the current player (if any)
  betAmount?: Chips;
  // third card revealed on a bet
  reveal?: Card;
}

export interface Resolution {
  kind: "bet" | "kouppi" | "shistri" | "pass";
  playerId: string;
  upcards: Upcards;
  // present for bet/kouppi/shistri
  reveal: Card | undefined;
  amount: Chips; // amount won (if win) or lost (if loss)
  win: boolean;
}


export interface RoundInfo {
  starterIndex: number; // index in players array
  pot: Chips;
}

export interface GameState {
  seed: number;
  rng: () => number;
  deck: Card[];
  discard: Card[];
  players: Player[];
  currentIndex: number; // index of current player turn
  round: RoundInfo;
  config: TableConfig;
  shoe: {
    deckCount: DeckCount;
    shufflePolicy: DeckShufflePolicy;
    baseDeckSize: number;
    shoeSize: number;
    generation: number;
    shuffleCount: number;
    remaining: number;
  };
  turn: TurnInfo | null;
  history: string[]; // human-readable log
  phase: "Lobby"|"Round"|"RoundEnd";
  lastResolution?: Resolution | null; // <--- add this line
  awaitNext?: boolean;
  /** Completed pot-empty / forced round ends; drives ante progression. */
  completedRounds?: number;
}
