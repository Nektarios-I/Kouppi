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
};

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
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
};

export type Room = {
  id: string;
  seed: number;
  config: TableConfig;
  maxPlayers: number;
  players: PlayerSession[];
  spectators?: SpectatorSession[]; // Spectators watching the game
  hostId?: string;
  password?: string; // Optional password for private rooms
  started?: boolean;
  autoRoundTimer?: any;
  state?: GameState;
  // Turn timer
  turnStartTime?: number; // timestamp when current turn started
  turnTimeout?: number; // configurable turn timeout in seconds (default 30)
  turnTimer?: any; // NodeJS.Timeout for auto-pass
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
};
