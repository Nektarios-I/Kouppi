import { initGame, applyAction } from "@kouppi/game-core";
import type { Action } from "@kouppi/game-core";
import type { Room, PlayerSession, SpectatorSession, AvatarConfig } from "./types.js";
import { hashRoomPassword } from "./security/password.js";
import { generateJoinSessionToken, isValidJoinSessionToken } from "./security/joinToken.js";

const rooms = new Map<string, Room>();
/** Normalized uppercase code → room id */
const roomCodes = new Map<string, string>();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Generate a unique 6-character room code (no ambiguous 0/O/1/I). */
export function generateRoomCode(): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    if (!roomCodes.has(code)) return code;
  }
  throw new Error("code_generation_failed");
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Resolve a room id or public code to the internal room id. */
export function resolveRoomIdentifier(idOrCode: string): string | undefined {
  const trimmed = idOrCode.trim();
  if (rooms.has(trimmed)) return trimmed;
  const byCode = roomCodes.get(normalizeRoomCode(trimmed));
  if (byCode && rooms.has(byCode)) return byCode;
  return undefined;
}

export function registerRoomCode(room: Room): void {
  roomCodes.set(normalizeRoomCode(room.code), room.id);
}

export function unregisterRoomCode(room: Room): void {
  roomCodes.delete(normalizeRoomCode(room.code));
}

export type RoomPlayerPayload = {
  id: string;
  name: string;
  avatar?: AvatarConfig;
  ready: boolean;
  connected: boolean;
  reconnectRemainingSec: number | null;
};

export type RoomSpectatorPayload = {
  id: string;
  name: string;
  avatar?: AvatarConfig;
  connected: boolean;
  reconnectRemainingSec: number | null;
};

export function bumpRoomRevision(room: Room): number {
  room.revision = (room.revision ?? 0) + 1;
  return room.revision;
}

export function bumpStateRevision(room: Room): number {
  room.stateRevision = (room.stateRevision ?? 0) + 1;
  return room.stateRevision;
}

export function buildStatePayload(room: Room): (NonNullable<Room["state"]> & { version: number }) | undefined {
  if (!room.state) return undefined;
  return { ...room.state, version: room.stateRevision ?? 0 };
}

export function buildRoomUpdatePayload(room: Room): {
  roomId: string;
  code: string;
  version: number;
  players: RoomPlayerPayload[];
  spectators: RoomSpectatorPayload[];
  hostId?: string;
  chatMutedAll?: boolean;
  chatMutedPlayerIds?: string[];
} {
  const now = Date.now();
  return {
    roomId: room.id,
    code: room.code,
    version: room.revision ?? 0,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      ready: !!p.ready,
      connected: !!p.socketId && !p.disconnectedAt,
      reconnectRemainingSec: p.disconnectedAt
        ? Math.max(0, Math.ceil((p.disconnectedAt + RECONNECT_GRACE_MS - now) / 1000))
        : null,
    })),
    spectators:
      room.spectators?.map((s) => ({
        id: s.id,
        name: s.name,
        avatar: s.avatar,
        connected: !!s.socketId && !s.disconnectedAt,
        reconnectRemainingSec: s.disconnectedAt
          ? Math.max(0, Math.ceil((s.disconnectedAt + RECONNECT_GRACE_MS - now) / 1000))
          : null,
      })) || [],
    hostId: room.hostId,
    chatMutedAll: !!room.chatMutedAll,
    chatMutedPlayerIds: room.chatMutedPlayerIds ? [...room.chatMutedPlayerIds] : [],
  };
}

function hasReconnectGrace(room: Room): boolean {
  return (
    room.players.some((p) => p.disconnectedAt) ||
    !!room.spectators?.some((s) => s.disconnectedAt)
  );
}

export function startGraceTickBroadcast(room: Room, onTick: () => void): void {
  if (room.graceTickInterval) return;
  room.graceTickInterval = setInterval(() => {
    if (!hasReconnectGrace(room)) {
      stopGraceTickBroadcast(room);
      return;
    }
    onTick();
  }, 1000);
}

export function stopGraceTickBroadcast(room: Room): void {
  if (room.graceTickInterval) {
    clearInterval(room.graceTickInterval);
    room.graceTickInterval = undefined;
  }
}

// Default turn timeout in seconds
const DEFAULT_TURN_TIMEOUT = 30;
// Max consecutive AFKs before auto-kick
const MAX_AFK_COUNT = 2;
/** Grace period before removing a disconnected player from a room */
export const RECONNECT_GRACE_MS = 45_000;

/** Intents that clients may send; system flow is server-only */
export const CLIENT_INTENT_TYPES = new Set(["pass", "bet", "kouppi", "shistri"]);

export function createRoom(id: string, config: Room["config"], seed: number, maxPlayers = 8, code?: string): Room {
  const roomCode = code ?? (id.length <= 8 ? normalizeRoomCode(id) : generateRoomCode());
  const room: Room = { 
    id, 
    code: roomCode,
    config, 
    seed, 
    maxPlayers, 
    players: [], 
    state: undefined, 
    started: false,
    turnTimeout: DEFAULT_TURN_TIMEOUT,
    revision: 0,
    stateRevision: 0,
    listedInLobby: true,
    createdAt: Date.now(),
    sessionStats: { handsPlayed: 0, biggestPot: 0 },
  };
  rooms.set(id, room);
  registerRoomCode(room);
  return room;
}

export function createRoomWithCreator(
  id: string,
  creator: PlayerSession,
  config: Partial<Room["config"]>,
  seed: number,
  password?: string,
  code?: string,
  options?: { listedInLobby?: boolean; presetLabel?: string }
): Room {
  const merged = { ...defaultConfig(), ...(config || {}) };
  const publicCode = code ?? (id.length <= 8 && /^[A-Za-z0-9]+$/.test(id) ? normalizeRoomCode(id) : generateRoomCode());
  const base = createRoom(id, merged, seed, (config as any)?.maxPlayers ?? merged.maxPlayers ?? 8, publicCode);
  base.hostId = creator.id;
  const creatorToken = generateJoinSessionToken();
  base.players.push({ ...creator, afkCount: 0, ready: true, joinSessionToken: creatorToken });
  base.started = false;
  const hasPassword = !!(password && password.trim().length > 0);
  base.listedInLobby = options?.listedInLobby ?? !hasPassword;
  if (options?.presetLabel) base.presetLabel = options.presetLabel;
  // Hash optional password for private rooms
  if (password && password.trim().length > 0) {
    base.passwordHash = hashRoomPassword(password.trim());
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
    spectatorsAllowed: true,
    language: "en",
  } as any;
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

/** Clear all rooms and timers — for integration tests only. */
export function resetAllRoomsForTests(): void {
  for (const id of Array.from(rooms.keys())) {
    closeRoom(id);
  }
  roomCodes.clear();
}

export function joinRoom(
  id: string,
  player: PlayerSession,
  options?: { joinSessionToken?: string }
): Room {
  const roomId = resolveRoomIdentifier(id);
  if (!roomId) throw new Error("room_not_found");
  const room = rooms.get(roomId)!;
  if (isPlayerBanned(room, player.id)) throw new Error("player_banned");
  const exists = room.players.find(p => p.id === player.id);
  if (room.started && !exists) {
    throw new Error("game_in_progress");
  }
  if (room.players.length >= room.maxPlayers && !exists) throw new Error("room_full");
  if (!exists) {
    const token = generateJoinSessionToken();
    room.players.push({ ...player, afkCount: 0, ready: false, joinSessionToken: token });
  } else {
    const hasActiveSocket =
      !!exists.socketId && exists.socketId !== player.socketId && !exists.disconnectedAt;
    if (hasActiveSocket) {
      throw new Error("slot_taken");
    }
    if (exists.joinSessionToken) {
      if (!isValidJoinSessionToken(options?.joinSessionToken) || options!.joinSessionToken !== exists.joinSessionToken) {
        throw new Error("invalid_session_token");
      }
    } else {
      exists.joinSessionToken = generateJoinSessionToken();
    }
    cancelDisconnectGrace(exists);
    exists.socketId = player.socketId;
    if (player.name) exists.name = player.name;
    if (player.avatar) exists.avatar = player.avatar;
  }
  bumpRoomRevision(room);
  return room;
}

export function getPlayerJoinSessionToken(roomId: string, playerId: string): string | undefined {
  const resolved = resolveRoomIdentifier(roomId);
  if (!resolved) return undefined;
  const room = rooms.get(resolved);
  return room?.players.find((p) => p.id === playerId)?.joinSessionToken;
}

export function joinSpectator(
  room: Room,
  spectator: SpectatorSession,
  options?: { joinSessionToken?: string }
): void {
  const exists = room.spectators?.find((s) => s.id === spectator.id);
  if (exists) {
    const hasActiveSocket =
      !!exists.socketId && exists.socketId !== spectator.socketId && !exists.disconnectedAt;
    if (hasActiveSocket) throw new Error("slot_taken");
    if (exists.joinSessionToken) {
      if (!isValidJoinSessionToken(options?.joinSessionToken) || options!.joinSessionToken !== exists.joinSessionToken) {
        throw new Error("invalid_session_token");
      }
    } else {
      exists.joinSessionToken = generateJoinSessionToken();
    }
    cancelSpectatorDisconnectGrace(exists);
    exists.socketId = spectator.socketId;
    if (spectator.name) exists.name = spectator.name;
    if (spectator.avatar) exists.avatar = spectator.avatar;
  } else {
    if (!room.spectators) room.spectators = [];
    room.spectators.push({
      ...spectator,
      joinSessionToken: generateJoinSessionToken(),
    });
  }
}

export function getSpectatorJoinSessionToken(roomId: string, spectatorId: string): string | undefined {
  const resolved = resolveRoomIdentifier(roomId);
  if (!resolved) return undefined;
  const room = rooms.get(resolved);
  return room?.spectators?.find((s) => s.id === spectatorId)?.joinSessionToken;
}

export function setPlayerReady(roomId: string, playerId: string, ready: boolean): Room {
  const resolved = resolveRoomIdentifier(roomId);
  if (!resolved) throw new Error("room_not_found");
  const room = rooms.get(resolved)!;
  if (room.started) throw new Error("game_in_progress");
  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new Error("not_in_room");
  if (player.disconnectedAt) throw new Error("player_disconnected");
  player.ready = ready;
  bumpRoomRevision(room);
  return room;
}

export function kickPlayer(roomId: string, hostId: string, targetId: string): Room {
  const resolved = resolveRoomIdentifier(roomId);
  if (!resolved) throw new Error("room_not_found");
  const room = rooms.get(resolved)!;
  if (room.hostId !== hostId) throw new Error("not_host");
  if (targetId === hostId) throw new Error("cannot_kick_self");
  const target = room.players.find((p) => p.id === targetId);
  if (!target) throw new Error("player_not_found");
  if (room.started && room.state?.phase === "Round") {
    const currentId = room.state.players[room.state.currentIndex]?.id;
    if (currentId === targetId) throw new Error("cannot_kick_current_player");
  }
  cancelDisconnectGrace(target);
  room.players = room.players.filter((p) => p.id !== targetId);
  bumpRoomRevision(room);
  return room;
}

export function transferHost(roomId: string, hostId: string, newHostId: string): Room {
  const resolved = resolveRoomIdentifier(roomId);
  if (!resolved) throw new Error("room_not_found");
  const room = rooms.get(resolved)!;
  if (room.hostId !== hostId) throw new Error("not_host");
  if (newHostId === hostId) throw new Error("already_host");
  const target = room.players.find((p) => p.id === newHostId);
  if (!target) throw new Error("player_not_found");
  if (target.disconnectedAt) throw new Error("player_disconnected");
  room.hostId = newHostId;
  bumpRoomRevision(room);
  return room;
}

export function isPlayerBanned(room: Room, playerId: string): boolean {
  return (room.bannedPlayerIds || []).includes(playerId);
}

export function banPlayerFromRoom(roomId: string, hostId: string, targetId: string): Room {
  const resolved = resolveRoomIdentifier(roomId);
  if (!resolved) throw new Error("room_not_found");
  const room = rooms.get(resolved)!;
  if (room.hostId !== hostId) throw new Error("not_host");
  if (targetId === hostId) throw new Error("cannot_kick_self");
  const target = room.players.find((p) => p.id === targetId);
  if (!target) throw new Error("player_not_found");
  if (!room.bannedPlayerIds) room.bannedPlayerIds = [];
  if (!room.bannedPlayerIds.includes(targetId)) room.bannedPlayerIds.push(targetId);
  cancelDisconnectGrace(target);
  room.players = room.players.filter((p) => p.id !== targetId);
  bumpRoomRevision(room);
  return room;
}

export function setRoomChatMuted(roomId: string, hostId: string, muted: boolean): Room {
  const resolved = resolveRoomIdentifier(roomId);
  if (!resolved) throw new Error("room_not_found");
  const room = rooms.get(resolved)!;
  if (room.hostId !== hostId) throw new Error("not_host");
  room.chatMutedAll = muted;
  bumpRoomRevision(room);
  return room;
}

export function setPlayerChatMuted(roomId: string, hostId: string, targetId: string, muted: boolean): Room {
  const resolved = resolveRoomIdentifier(roomId);
  if (!resolved) throw new Error("room_not_found");
  const room = rooms.get(resolved)!;
  if (room.hostId !== hostId) throw new Error("not_host");
  if (!room.players.some((p) => p.id === targetId)) throw new Error("player_not_found");
  if (!room.chatMutedPlayerIds) room.chatMutedPlayerIds = [];
  if (muted) {
    if (!room.chatMutedPlayerIds.includes(targetId)) room.chatMutedPlayerIds.push(targetId);
  } else {
    room.chatMutedPlayerIds = room.chatMutedPlayerIds.filter((id) => id !== targetId);
  }
  bumpRoomRevision(room);
  return room;
}

export function isChatSendBlocked(room: Room, playerId: string): boolean {
  if (room.chatMutedAll && playerId !== room.hostId) return true;
  return (room.chatMutedPlayerIds || []).includes(playerId);
}

export const CHAT_MIN_INTERVAL_MS = 1000;
export const CHAT_MAX_PER_MINUTE = 20;

export function checkChatRateLimit(player: PlayerSession): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (player.chatSendTimestamps || []).filter((t) => t > windowStart);
  if (timestamps.length >= CHAT_MAX_PER_MINUTE) {
    const retryAfterMs = timestamps[0] + 60_000 - now;
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }
  const last = timestamps[timestamps.length - 1];
  if (last && now - last < CHAT_MIN_INTERVAL_MS) {
    return { allowed: false, retryAfterMs: CHAT_MIN_INTERVAL_MS - (now - last) };
  }
  return { allowed: true };
}

export function recordChatSend(player: PlayerSession): void {
  const now = Date.now();
  const windowStart = now - 60_000;
  player.chatSendTimestamps = [...(player.chatSendTimestamps || []).filter((t) => t > windowStart), now];
}

export function allPlayersReady(room: Room): boolean {
  if (room.players.length < 2) return false;
  return room.players.every((p) => p.ready && !p.disconnectedAt);
}

export function findPlayerBySocket(room: Room, socketId: string): PlayerSession | undefined {
  return room.players.find((p) => p.socketId === socketId);
}

export function promoteHost(room: Room): string | undefined {
  if (room.players.length === 0) {
    room.hostId = undefined;
    return undefined;
  }
  if (room.hostId && room.players.some((p) => p.id === room.hostId)) {
    return room.hostId;
  }
  room.hostId = room.players[0].id;
  return room.hostId;
}

export function cancelDisconnectGrace(player: PlayerSession | undefined): void {
  if (!player) return;
  player.disconnectedAt = undefined;
  if (player.pendingRemovalTimer) {
    clearTimeout(player.pendingRemovalTimer);
    player.pendingRemovalTimer = undefined;
  }
}

export function cancelSpectatorDisconnectGrace(spectator: SpectatorSession | undefined): void {
  if (!spectator) return;
  spectator.disconnectedAt = undefined;
  if (spectator.pendingRemovalTimer) {
    clearTimeout(spectator.pendingRemovalTimer);
    spectator.pendingRemovalTimer = undefined;
  }
}

export function beginSpectatorDisconnectGrace(
  room: Room,
  spectatorId: string,
  graceMs: number,
  onExpire: () => void
): void {
  const spectator = room.spectators?.find((s) => s.id === spectatorId);
  if (!spectator) return;
  cancelSpectatorDisconnectGrace(spectator);
  spectator.disconnectedAt = Date.now();
  spectator.socketId = "";
  spectator.pendingRemovalTimer = setTimeout(onExpire, graceMs);
}

export function beginDisconnectGrace(
  room: Room,
  playerId: string,
  graceMs: number,
  onExpire: () => void
): void {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return;
  cancelDisconnectGrace(player);
  player.disconnectedAt = Date.now();
  player.socketId = "";
  player.pendingRemovalTimer = setTimeout(onExpire, graceMs);
}

export function leaveRoom(id: string, playerId: string): Room | undefined {
  const room = rooms.get(id);
  if (!room) return undefined;
  room.players = room.players.filter(p => p.id !== playerId);
  bumpRoomRevision(room);
  return room;
}

export function removeSpectator(room: Room, spectatorId: string): void {
  if (!room.spectators) return;
  const spectator = room.spectators.find((s) => s.id === spectatorId);
  cancelSpectatorDisconnectGrace(spectator);
  room.spectators = room.spectators.filter((s) => s.id !== spectatorId);
  bumpRoomRevision(room);
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
    bumpStateRevision(room);
  }
}

export function closeRoom(id: string): void {
  const room = rooms.get(id);
  if (!room) return;
  stopGraceTickBroadcast(room);
  if (room.turnTimer) clearTimeout(room.turnTimer);
  if (room.flowTimer) clearTimeout(room.flowTimer);
  if (room.timerIntervalId) clearInterval(room.timerIntervalId);
  if (room.decision?.timer) clearTimeout(room.decision.timer);
  if (room.decision?.interval) clearInterval(room.decision.interval);
  for (const p of room.players) cancelDisconnectGrace(p);
  unregisterRoomCode(room);
  rooms.delete(id);
}

/** Apply a client gameplay intent (pass/bet/kouppi/shistri only). */
export function handleClientIntent(id: string, playerId: string, intent: Action): Room {
  if (!CLIENT_INTENT_TYPES.has(intent.type)) {
    throw new Error("forbidden_intent");
  }
  return handleIntent(id, playerId, intent);
}

/** Apply a system intent (server-only flow control). */
export function applySystemIntent(id: string, intent: Action): Room {
  const room = rooms.get(id);
  if (!room) throw new Error("room_not_found");
  if (!room.state) throw new Error("room_not_ready");
  room.state = applyAction(room.state, intent);
  bumpStateRevision(room);
  return room;
}

/** Apply a player gameplay intent (current player only). */
export function handleIntent(id: string, playerId: string, intent: Action): Room {
  const room = rooms.get(id);
  if (!room) throw new Error("room_not_found");
  if (!room.state) throw new Error("room_not_ready");
  const currentPlayer = room.state.players[room.state.currentIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error("not_current_player");
  }
  room.state = applyAction(room.state, intent);
  bumpStateRevision(room);
  return room;
}

export function snapshot(id: string): Room["state"] | undefined {
  return rooms.get(id)?.state;
}

/** Return lobby info for listed public rooms */
export function roomsInfo(): Array<{
  id: string;
  code: string;
  playerCount: number;
  maxPlayers: number;
  started: boolean;
  hostId?: string;
  spectatorsAllowed?: boolean;
  spectatorCount?: number;
  isPrivate?: boolean;
  listedInLobby?: boolean;
  seatsOpen?: boolean;
  createdAt?: number;
  presetLabel?: string;
}> {
  return Array.from(rooms.values())
    .filter((r) => r.listedInLobby !== false)
    .map((r) => ({
      id: r.id,
      code: r.code,
      playerCount: r.players.length,
      maxPlayers: r.maxPlayers,
      started: !!r.state && r.started === true,
      hostId: r.hostId,
      spectatorsAllowed: r.config.spectatorsAllowed ?? true,
      spectatorCount: r.spectators?.length ?? 0,
      isPrivate: !!r.passwordHash,
      listedInLobby: r.listedInLobby !== false,
      seatsOpen: r.players.length < r.maxPlayers,
      createdAt: r.createdAt,
      presetLabel: r.presetLabel,
    }));
}

export function trackSessionPot(room: Room): void {
  if (!room.state?.round) return;
  const pot = room.state.round.pot ?? 0;
  if (!room.sessionStats) room.sessionStats = { handsPlayed: 0, biggestPot: 0 };
  if (pot > room.sessionStats.biggestPot) room.sessionStats.biggestPot = pot;
}

export function buildSessionSummary(room: Room): {
  handsPlayed: number;
  biggestPot: number;
  mvp: { id: string; name: string; bankroll: number } | null;
} {
  const stats = room.sessionStats ?? { handsPlayed: 0, biggestPot: 0 };
  let mvp: { id: string; name: string; bankroll: number } | null = null;
  if (room.state?.players?.length) {
    const sorted = [...room.state.players].sort((a, b) => (b.bankroll ?? 0) - (a.bankroll ?? 0));
    const top = sorted[0];
    if (top) mvp = { id: top.id, name: top.name, bankroll: top.bankroll ?? 0 };
  }
  return { handsPlayed: stats.handsPlayed, biggestPot: stats.biggestPot, mvp };
}

/** Reset room to waiting lobby for a rematch with the same players */
export function resetRoomForPlayAgain(roomId: string, hostId: string): Room {
  const resolved = resolveRoomIdentifier(roomId);
  if (!resolved) throw new Error("room_not_found");
  const room = rooms.get(resolved)!;
  if (room.hostId !== hostId) throw new Error("not_host");

  if (room.started) {
    if (!room.state || room.state.phase !== "RoundEnd") throw new Error("game_in_progress");
    if (room.decision?.active) throw new Error("decision_in_progress");
  }

  if (room.turnTimer) clearTimeout(room.turnTimer);
  if (room.flowTimer) clearTimeout(room.flowTimer);
  if (room.timerIntervalId) clearInterval(room.timerIntervalId);
  if (room.decision?.timer) clearTimeout(room.decision.timer);
  if (room.decision?.interval) clearInterval(room.decision.interval);

  room.state = undefined;
  room.started = false;
  room.decision = undefined;
  room.turnStartTime = undefined;
  room.seed = Math.floor(Math.random() * 1e9);
  room.sessionStats = { handsPlayed: 0, biggestPot: 0 };

  for (const p of room.players) {
    p.ready = p.id === hostId;
    p.afkCount = 0;
  }

  bumpRoomRevision(room);
  return room;
}

/** Cleanup empty rooms - removes rooms with no players and no spectators */
export function cleanupEmptyRooms(): number {
  const toRemove: string[] = [];
  for (const [id, room] of rooms.entries()) {
    const hasPlayers = room.players.length > 0;
    const hasSpectators = (room.spectators?.length ?? 0) > 0;
    if (!hasPlayers && !hasSpectators) {
      toRemove.push(id);
    }
  }
  for (const id of toRemove) {
    closeRoom(id);
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
  const resolved = resolveRoomIdentifier(id);
  if (!resolved) throw new Error("room_not_found");
  const room = rooms.get(resolved)!;
  if (room.hostId !== by) throw new Error("not_host");
  if (room.players.length < 2) throw new Error("not_enough_players");
  if (!allPlayersReady(room)) throw new Error("not_all_ready");
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
  bumpStateRevision(room);
  bumpRoomRevision(room);
  return room;
}

/** Start the first turn of a round */
export function startFirstTurn(id: string): Room {
  const room = rooms.get(id);
  if (!room || !room.state) throw new Error("room_not_found");
  room.state = applyAction(room.state, { type: "startTurn" });
  bumpStateRevision(room);
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
export function addChatMessage(
  roomId: string,
  playerId: string,
  playerName: string,
  message: string,
  isSystem = false
): ChatMessage | null {
  const resolved = resolveRoomIdentifier(roomId) || roomId;
  const room = rooms.get(resolved);
  if (!room) return null;
  
  if (!room.chatMessages) {
    room.chatMessages = [];
  }
  
  const chatMessage: ChatMessage = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    playerId,
    playerName,
    message: message.trim().slice(0, 500),
    timestamp: Date.now(),
    isSystem,
  };
  
  room.chatMessages.push(chatMessage);
  
  if (room.chatMessages.length > MAX_CHAT_MESSAGES) {
    room.chatMessages = room.chatMessages.slice(-MAX_CHAT_MESSAGES);
  }
  
  return chatMessage;
}

export function addSystemChatMessage(roomId: string, message: string): ChatMessage | null {
  return addChatMessage(roomId, "system", "System", message, true);
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
