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

export function createRoomWithCreator(id: string, creator: PlayerSession, config: Partial<Room["config"]>, seed: number, password?: string): Room {
  const base = createRoom(id, { ...defaultConfig(), ...(config || {}) }, seed, (config as any)?.maxPlayers ?? 2);
  base.hostId = creator.id;
  base.players.push({ ...creator, afkCount: 0 });
  base.started = false;
  // Set optional password for private rooms
  if (password && password.trim().length > 0) {
    base.password = password.trim();
  }
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

/** Sync the game state's players to match the current room players order, preserving bankrolls.
 *  Also clears turn state if the leaving player had an active turn.
 */
export function syncGamePlayersToRoom(id: string): void {
  const room = rooms.get(id);
  if (!room || !room.state) return;
  
  const allowedIds = new Set(room.players.map(p => p.id));
  
  // Identify players being removed
  const removedPlayers = room.state.players.filter(p => !allowedIds.has(p.id));
  
  // Check if the current turn belongs to a player who is leaving
  const currentPlayer = room.state.players[room.state.currentIndex];
  const currentPlayerLeaving = currentPlayer && !allowedIds.has(currentPlayer.id);
  
  // Check if the active turn belongs to a leaving player
  const turnPlayerLeaving = room.state.turn && !allowedIds.has(room.state.turn.playerId);
  
  // Filter state players to those still in room, preserve order according to room.players
  const byId: Record<string, typeof room.state.players[number]> = {} as any;
  for (const p of room.state.players) byId[p.id] = p;
  const newPlayers = room.players
    .map(s => byId[s.id])
    .filter(Boolean) as typeof room.state.players;

  // If no change, skip
  const same = newPlayers.length === room.state.players.length && newPlayers.every((p, i) => p.id === room.state!.players[i].id);
  if (!same) {
    // Calculate the new currentIndex before removing players
    let newCurrentIndex = 0;
    if (currentPlayer && !currentPlayerLeaving) {
      // Find the current player's new position
      const newIdx = newPlayers.findIndex(p => p.id === currentPlayer.id);
      newCurrentIndex = newIdx >= 0 ? newIdx : 0;
    } else if (currentPlayerLeaving && newPlayers.length > 0) {
      // Current player is leaving - use their old index position (clamped)
      newCurrentIndex = Math.min(room.state.currentIndex, newPlayers.length - 1);
    }
    
    room.state.players = newPlayers;
    
    // Clear turn if the turn player left
    if (turnPlayerLeaving) {
      room.state.turn = null;
      room.state.history.push("Turn cleared - player left the game");
    }
    
    // Update indices
    if (room.state.players.length === 0) {
      room.state.currentIndex = 0;
      room.state.round.starterIndex = 0;
    } else {
      room.state.currentIndex = newCurrentIndex;
      room.state.round.starterIndex = Math.min(room.state.round.starterIndex, room.state.players.length - 1);
    }
    
    // Log removed players
    for (const removed of removedPlayers) {
      room.state.history.push(`${removed.name} left the game`);
    }
    room.state.history.push("Players synced to room");
  }
}

export function closeRoom(id: string): void {
  // Clear any active turn timers before deleting
  const room = rooms.get(id);
  if (room?.turnTimer) {
    clearTimeout(room.turnTimer);
  }
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
export function roomsInfo(): Array<{ id: string; playerCount: number; maxPlayers: number; started: boolean; hostId?: string; spectatorsAllowed?: boolean; spectatorCount?: number; isPrivate?: boolean }> {
  return Array.from(rooms.values()).map(r => ({
    id: r.id,
    playerCount: r.players.length,
    maxPlayers: r.maxPlayers,
    started: !!r.state && r.started === true,
    hostId: r.hostId,
    spectatorsAllowed: r.config.spectatorsAllowed ?? false,
    spectatorCount: r.spectators?.length ?? 0,
    isPrivate: !!r.password, // Has password = private room (don't expose actual password)
  }));
}

/** Cleanup empty rooms - removes rooms with no players and no spectators */
export function cleanupEmptyRooms(): number {
  const toRemove: string[] = [];
  for (const [id, room] of rooms.entries()) {
    const hasPlayers = room.players.length > 0;
    const hasSpectators = (room.spectators?.length ?? 0) > 0;
    if (!hasPlayers && !hasSpectators) {
      // Clear any timers
      if (room.turnTimer) {
        clearTimeout(room.turnTimer);
      }
      toRemove.push(id);
    }
  }
  for (const id of toRemove) {
    rooms.delete(id);
  }
  return toRemove.length;
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

// Chat functions

import type { ChatMessage } from "./types.js";

const MAX_CHAT_MESSAGES = 100; // Keep last 100 messages per room

/** Add a chat message to the room */
export function addChatMessage(roomId: string, playerId: string, playerName: string, message: string): ChatMessage | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  
  // Initialize chat messages array if not exists
  if (!room.chatMessages) {
    room.chatMessages = [];
  }
  
  const chatMessage: ChatMessage = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    playerId,
    playerName,
    message: message.trim().slice(0, 500), // Limit message length to 500 chars
    timestamp: Date.now(),
  };
  
  room.chatMessages.push(chatMessage);
  
  // Keep only the last MAX_CHAT_MESSAGES
  if (room.chatMessages.length > MAX_CHAT_MESSAGES) {
    room.chatMessages = room.chatMessages.slice(-MAX_CHAT_MESSAGES);
  }
  
  return chatMessage;
}

/** Get all chat messages for a room */
export function getChatMessages(roomId: string): ChatMessage[] {
  const room = rooms.get(roomId);
  if (!room || !room.chatMessages) return [];
  return room.chatMessages;
}

/** Clear chat messages for a room (called when room is closed) */
export function clearChatMessages(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.chatMessages = [];
  }
}
