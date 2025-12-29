import type { GameState, TableConfig } from "@kouppi/game-core";

export type PlayerSession = {
  id: string;
  name: string;
  socketId: string;
  afkCount?: number; // consecutive AFK turns
};

export type Room = {
  id: string;
  seed: number;
  config: TableConfig;
  maxPlayers: number;
  players: PlayerSession[];
  hostId?: string;
  started?: boolean;
  autoRoundTimer?: any;
  state?: GameState;
  // Turn timer
  turnStartTime?: number; // timestamp when current turn started
  turnTimeout?: number; // configurable turn timeout in seconds (default 30)
  turnTimer?: any; // NodeJS.Timeout for auto-pass
};
