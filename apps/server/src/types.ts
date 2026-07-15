import type { GameState, TableConfig } from "@kouppi/game-core";

// Avatar configuration
export type AvatarConfig = {
  emoji: string;
  color: string;
  borderColor: string;
};

export type PlayerSession = {
  id: string;
  name: string;
  socketId: string;
  afkCount?: number; // consecutive AFK turns
  avatar?: AvatarConfig; // player's chosen avatar
  ready?: boolean;
  disconnectedAt?: number;
  pendingRemovalTimer?: ReturnType<typeof setTimeout>;
  /** Timestamps of recent chat sends for rate limiting */
  chatSendTimestamps?: number[];
};

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  isSystem?: boolean;
};

// Emote system - easily extensible list of emotes
export type EmoteEvent = {
  id: string;
  playerId: string;
  playerName: string;
  emote: string; // The emoji/emote string
  timestamp: number;
};

// Spectator session (simpler than player - no game state)
export type SpectatorSession = {
  id: string;
  name: string;
  socketId: string;
  avatar?: AvatarConfig;
  disconnectedAt?: number;
  pendingRemovalTimer?: ReturnType<typeof setTimeout>;
};

export type Room = {
  id: string;
  /** Short public code for invites (6 chars, case-insensitive lookup) */
  code: string;
  seed: number;
  config: TableConfig;
  maxPlayers: number;
  players: PlayerSession[];
  spectators?: SpectatorSession[]; // Spectators watching the game
  hostId?: string;
  passwordHash?: string; // scrypt hash for private rooms (never store plaintext)
  started?: boolean;
  autoRoundTimer?: any;
  state?: GameState;
  // Turn timer
  turnStartTime?: number; // timestamp when current turn started
  turnTimeout?: number; // configurable turn timeout in seconds (default 30)
  turnTimer?: any; // NodeJS.Timeout for auto-pass
  timerIntervalId?: ReturnType<typeof setInterval>;
  flowTimer?: ReturnType<typeof setTimeout>;
  // Round decision phase (after pot is emptied)
  decision?: {
    active: boolean;
    deadlineTs: number; // epoch ms when decision window ends
    choices: Record<string, "stay" | "leave" | null>; // per-player choice
    timer?: any; // setTimeout handle
    interval?: any; // setInterval for countdown updates
  };
  // Chat messages (cleared when room is closed)
  chatMessages?: ChatMessage[];
  /** Broadcasts reconnect countdown while any player is in grace */
  graceTickInterval?: ReturnType<typeof setInterval>;
  /** Monotonic counter for room metadata updates */
  revision?: number;
  /** Monotonic counter for game state snapshots */
  stateRevision?: number;
};
