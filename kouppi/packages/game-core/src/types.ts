export type Rank = 1|2|3|4|5|6|7|8|9|10|11|12|13; // A=1, J=11, Q=12, K=13
export type Suit = "S"|"H"|"D"|"C";

export interface Card { rank: Rank; suit: Suit; }
export type Chips = number;

export type MinBetPolicy =
  | { type: "fixed"; value: Chips }
  | { type: "voted"; options: Chips[]; tieBreaker: "random" };

export type DeckPolicy =
  | "single_no_reshuffle_until_empty"
  | "single_reshuffle_when_low";

export interface TableConfig {
  ante: Chips;                       // default 10
  startingBankroll: Chips;           // default 100
  minBetPolicy: MinBetPolicy;        // default fixed(10)
  shistri: { enabled: boolean; percent: number; minChip: number }; // 5%, min 1
  maxPlayers: number;                // up to 20
  deckPolicy: DeckPolicy;            // MVP: no reshuffle until empty
  allowKouppi: true;                 // always true for this game
  spectatorsAllowed: false;
  language: "en"|"el";
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
  turn: TurnInfo | null;
  history: string[]; // human-readable log
  phase: "Lobby"|"Round"|"RoundEnd";
  lastResolution?: Resolution | null; // <--- add this line
  awaitNext?: boolean;
}

export interface Resolution {
  playerId: string;
  upcards: Upcards;
  reveal: Card | undefined;
  amount: Chips;
  win: boolean;
}
