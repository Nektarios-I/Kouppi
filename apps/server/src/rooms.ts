import { initGame, applyAction } from "@kouppi/game-core";
import type { Action } from "@kouppi/game-core";
import type { Room, PlayerSession } from "./types.js";

const rooms = new Map<string, Room>();

// Default turn timeout in seconds
const DEFAULT_TURN_TIMEOUT = 30;
// Max consecutive AFKs before auto-kick
const MAX_AFK_COUNT = 2;

export function createRoom(id: string, config: Room["config"], seed: number, maxPlayers = 2): Room {
  const room: Room = { 
    id, 
    config, 
    seed, 
    maxPlayers, 
    players: [], 
    state: undefined, 
    started: false,
    turnTimeout: DEFAULT_TURN_TIMEOUT,
  };
  rooms.set(id, room);
  return room;
}

export function createRoomWithCreator(id: string, creator: PlayerSession, config: Partial<Room["config"]>, seed: number): Room {
  const base = createRoom(id, { ...defaultConfig(), ...(config || {}) }, seed, (config as any)?.maxPlayers ?? 2);
  base.hostId = creator.id;
  base.players.push({ ...creator, afkCount: 0 });
  base.started = false;
  // Allow custom turn timeout from config
  if ((config as any)?.turnTimeout) {
    base.turnTimeout = (config as any).turnTimeout;
  }
  return base;
}

function defaultConfig(): Room["config"] {
  return {
    ante: 10,
    startingBankroll: 100,
    minBetPolicy: { type: "fixed", value: 10 },
    shistri: { enabled: true, percent: 5, minChip: 1 },
    maxPlayers: 8,
    deckPolicy: "single_no_reshuffle_until_empty",
    allowKouppi: true,
    spectatorsAllowed: false,
    language: "en",
  } as any;
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

export function joinRoom(id: string, player: PlayerSession): Room {
  const room = rooms.get(id);
  if (!room) throw new Error("room_not_found");
  if (room.players.length >= room.maxPlayers) throw new Error("room_full");
  const exists = room.players.find(p => p.id === player.id);
  if (!exists) room.players.push({ ...player, afkCount: 0 });
  else {
    // Reconnecting player - update socket ID
    exists.socketId = player.socketId;
  }
  return room;
}

export function leaveRoom(id: string, playerId: string): Room | undefined {
  const room = rooms.get(id);
  if (!room) return undefined;
  room.players = room.players.filter(p => p.id !== playerId);
  return room;
}

export function closeRoom(id: string): void {
  rooms.delete(id);
}

export function handleIntent(id: string, playerId: string, intent: Action): Room {
  const room = rooms.get(id);
  if (!room) throw new Error("room_not_found");
  if (!room.state) throw new Error("room_not_ready");
  const currentPlayer = room.state.players[room.state.currentIndex];
  // Simple guard: only current player may act (bots handled server-side later)
  if (currentPlayer.id !== playerId && intent.type !== "startRound" && intent.type !== "ante" && intent.type !== "determineStarter" && intent.type !== "startTurn" && intent.type !== "nextPlayer" && intent.type !== "nextRound") {
    throw new Error("not_current_player");
  }
  room.state = applyAction(room.state, intent);
  return room;
}

export function snapshot(id: string): Room["state"] | undefined {
  return rooms.get(id)?.state;
}

/** Return lobby info for all rooms */
export function roomsInfo(): Array<{ id: string; playerCount: number; maxPlayers: number; started: boolean; hostId?: string }> {
  return Array.from(rooms.values()).map(r => ({
    id: r.id,
    playerCount: r.players.length,
    maxPlayers: r.maxPlayers,
    started: !!r.state && r.started === true,
    hostId: r.hostId,
  }));
}

/** Start the turn timer for the current player */
export function startTurnTimer(id: string, onTimeout: () => void): void {
  const room = rooms.get(id);
  if (!room) return;
  
  // Clear any existing timer
  clearTurnTimer(id);
  
  room.turnStartTime = Date.now();
  const timeout = (room.turnTimeout || DEFAULT_TURN_TIMEOUT) * 1000;
  
  room.turnTimer = setTimeout(() => {
    onTimeout();
  }, timeout);
}

/** Clear the turn timer */
export function clearTurnTimer(id: string): void {
  const room = rooms.get(id);
  if (!room) return;
  
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
  room.turnStartTime = undefined;
}

/** Get turn timer info */
export function getTurnTimerInfo(id: string): { remaining: number; total: number } | null {
  const room = rooms.get(id);
  if (!room || !room.turnStartTime) return null;
  
  const total = (room.turnTimeout || DEFAULT_TURN_TIMEOUT) * 1000;
  const elapsed = Date.now() - room.turnStartTime;
  const remaining = Math.max(0, total - elapsed);
  
  return { remaining: Math.ceil(remaining / 1000), total: room.turnTimeout || DEFAULT_TURN_TIMEOUT };
}

/** Reset AFK count for a player (they made a move) */
export function resetAfkCount(id: string, playerId: string): void {
  const room = rooms.get(id);
  if (!room) return;
  
  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.afkCount = 0;
  }
}

/** Increment AFK count for a player (they timed out) */
export function incrementAfkCount(id: string, playerId: string): number {
  const room = rooms.get(id);
  if (!room) return 0;
  
  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.afkCount = (player.afkCount || 0) + 1;
    return player.afkCount;
  }
  return 0;
}

/** Check if player should be kicked for AFK */
export function shouldKickForAfk(id: string, playerId: string): boolean {
  const room = rooms.get(id);
  if (!room) return false;
  
  const player = room.players.find(p => p.id === playerId);
  return (player?.afkCount || 0) >= MAX_AFK_COUNT;
}

/** If a room has a state in Lobby and at least 2 players, apply initial actions */
export function startRoom(id: string, by: string): Room {
  const room = rooms.get(id);
  if (!room) throw new Error("room_not_found");
  if (room.hostId !== by) throw new Error("not_host");
  if (room.players.length < 2) throw new Error("not_enough_players");
  room.state = initGame({
    players: room.players.map((p: PlayerSession) => ({ id: p.id, name: p.name })),
    seed: room.seed,
    config: room.config,
  });
  // Transition from Lobby into a playable Round immediately
  room.state = applyAction(room.state, { type: "startRound" });
  room.state = applyAction(room.state, { type: "ante" });
  room.state = applyAction(room.state, { type: "determineStarter" });
  room.started = true;
  // Reset all AFK counts
  room.players.forEach(p => p.afkCount = 0);
  return room;
}

/** Start the first turn of a round */
export function startFirstTurn(id: string): Room {
  const room = rooms.get(id);
  if (!room || !room.state) throw new Error("room_not_found");
  room.state = applyAction(room.state, { type: "startTurn" });
  return room;
}

/** Check if the current player is the given player */
export function isCurrentPlayer(id: string, playerId: string): boolean {
  const room = rooms.get(id);
  if (!room || !room.state) return false;
  return room.state.players[room.state.currentIndex]?.id === playerId;
}

/** Get current player ID */
export function getCurrentPlayerId(id: string): string | null {
  const room = rooms.get(id);
  if (!room || !room.state) return null;
  return room.state.players[room.state.currentIndex]?.id || null;
}
