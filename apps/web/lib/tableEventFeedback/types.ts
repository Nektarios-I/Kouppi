/**
 * Shared table event feedback types (presentation only).
 * Discriminated unions — no game-rule side effects.
 */

export type TableEffectsLevel = "full" | "reduced" | "off";
export type TableSoundPreference = "on" | "off";

export type FeedbackPriority = "low" | "normal" | "high";

export type FeedbackTone = "neutral" | "win" | "loss" | "shistri" | "action";

/** Physical Layer 1 intents (derived; never invent amounts). */
export type PhysicalFeedbackIntent =
  | {
      kind: "chip_to_pot";
      playerId: string;
      amount: number;
      eventId: string;
    }
  | {
      kind: "chip_from_pot";
      playerId: string;
      amount: number;
      eventId: string;
    }
  | {
      kind: "seat_win_highlight";
      playerId: string;
      eventId: string;
      durationMs: number;
    }
  | {
      kind: "seat_loss_dim";
      playerId: string;
      eventId: string;
      durationMs: number;
    }
  | {
      kind: "shistri_badge";
      playerId: string;
      amount?: number;
      eventId: string;
      durationMs: number;
    };

export type TableFeedbackEventBase = {
  id: string;
  /** Millis epoch for client ordering only — not shown unless product already displays time */
  createdAt: number;
  priority: FeedbackPriority;
  tone: FeedbackTone;
  /** Ribbon / live-region text */
  ribbonText: string;
  /** Event log line */
  logText: string;
  /** aria-live politeness */
  ariaLive: "polite" | "assertive" | "off";
  physical: PhysicalFeedbackIntent[];
  /** Optional sound cue key (never thrown if missing) */
  soundCue?: "chip_place" | "chip_collect" | "shistri" | "round_complete" | "none";
  /** Ribbon display duration ms */
  durationMs: number;
  /** Major match outcomes must not enter ribbon queue */
  channel: "table" | "major";
};

export type TableFeedbackEvent = TableFeedbackEventBase;

export type LastResolutionLike = {
  kind: "bet" | "kouppi" | "shistri" | "pass";
  playerId: string;
  amount?: number;
  win?: boolean;
  reveal?: { rank: number; suit: string } | null;
};

export type PlayerNameLookup = {
  id: string;
  name: string;
  isBot?: boolean;
};

export type NormalizeResolutionInput = {
  resolution: LastResolutionLike;
  players: PlayerNameLookup[];
  localPlayerId: string | null | undefined;
  /** Extra salt for dedupe (e.g. history length) */
  sequenceSalt?: string | number;
};
