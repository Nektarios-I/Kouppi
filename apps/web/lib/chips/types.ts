import {
  KOUPPI_CHIP_DENOMINATIONS,
  type ChipDenomination,
} from "./denominations";

export type ChipCount = {
  denomination: ChipDenomination;
  count: number;
};

export type ChipStackContext =
  | "player-bankroll"
  | "player-bet"
  | "pot"
  | "transfer";

export type RenderedChipSubStack = {
  denomination: ChipDenomination;
  visibleChipCount: number;
  representedValue: number;
  overflowCount: number;
};

export type VisualChipStack = {
  sourceAmount: number;
  representedAmount: number;
  remainderAmount: number;
  counts: ChipCount[];
  renderedStacks: RenderedChipSubStack[];
  compactLabel: string;
  /** True only when the visual cannot represent the amount (should stay false with count markers). */
  isApproximate: boolean;
};

export type ChipTransferKind =
  | "bet-to-pot"
  | "stake-to-pot"
  | "pot-to-winner"
  | "pot-to-winners"
  | "refund-to-player"
  | "shistri-loss"
  | "shistri-win";

export type ChipTransferAnchor =
  | { type: "pot" }
  | { type: "player-bankroll"; playerId: string }
  | { type: "player-bet"; playerId: string };

export type ChipTransfer = {
  id: string;
  kind: ChipTransferKind;
  amount: number;
  from: ChipTransferAnchor;
  to: ChipTransferAnchor;
  sourcePlayerId?: string;
  targetPlayerId?: string;
  sourceStateRevision?: number | string;
  durationMs: number;
  timestamp: number;
};

/** Visual disc caps by presentation context. */
export const CHIP_VISUAL_CAPS = {
  maxDenominationGroups: 7,
  maxVisiblePerDenomination: 5,
  "player-bankroll": 18,
  "player-bet": 12,
  pot: 22,
  transfer: 10,
} as const;

export type PokerChipSize = "xs" | "sm" | "md" | "lg";
