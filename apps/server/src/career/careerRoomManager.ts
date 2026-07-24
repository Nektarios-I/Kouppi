/**
 * Career Room Manager
 *
 * Manages Career Mode rooms with:
 * - Explicit Ready gate: countdown starts only when required players are present and ready
 * - Auto-start: 60-second timer after both Ready
 * - Join lock while countdown/starting
 * - Cleanup: Proper resource release after games end
 * - Naming: Unique room IDs with "career-" prefix to avoid conflicts
 */

import { v4 as uuidv4 } from "uuid";
import { Server, Socket } from "socket.io";
import { getAnteOptionById, CAREER_TIERS, canAffordAnte, type AnteTier, type AnteOption } from "./tiers.js";
import type { MatchFound } from "./queue.js";
import { getUserById, getPublicPlayerCosmetics } from "@kouppi/database";
import { 
  createRoomWithCreator, 
  joinRoom, 
  startRoom, 
  startFirstTurn, 
  getRoom,
  closeRoom,
  snapshot,
  setPlayerReady,
  RECONNECT_GRACE_MS,
} from "../rooms.js";
import { runCareerGameKickoff } from "./careerGameKickoff.js";
import type { TableConfig } from "@kouppi/game-core";
import { SHISTRI_DEFAULT_MIN_CHIP, SHISTRI_DEFAULT_PERCENT } from "@kouppi/game-core";

/** Career ranked waiting / Quick Match tables are 1v1. */
const MAX_PLAYERS_PER_ROOM = 2;
/** Production default: 60s after both players Ready. */
let AUTO_START_DELAY_MS = 60_000;
const DEFAULT_AUTO_START_DELAY_MS = 60_000;
const CAREER_ROOM_PREFIX = "career-";

function safePublicCosmetics(userId: string) {
  try {
    return getPublicPlayerCosmetics(userId);
  } catch {
    return undefined;
  }
}

/** Read current auto-start delay (tests / diagnostics). */
export function getAutoStartDelayMs(): number {
  return AUTO_START_DELAY_MS;
}

/** Test-only: override auto-start delay without changing production default callers. */
export function setAutoStartDelayMsForTests(ms: number): void {
  AUTO_START_DELAY_MS = ms;
}

/** Test-only: restore production default delay. */
export function resetAutoStartDelayMsForTests(): void {
  AUTO_START_DELAY_MS = DEFAULT_AUTO_START_DELAY_MS;
}

export interface CareerPlayer {
  odlayerId: string;
  odlayerName: string;
  odlating: number;
  odankroll: number;
  odocketId: string;
  userId: string;
  username: string;
  rating: number;
  bankroll: number;
  socketId: string;
  avatarId: string;
  cosmetics?: import("../types.js").PlayerCosmetics;
  joinedAt: number;
  ready: boolean;
  /** Multiplayer-style reconnect grace (waiting/starting tables). */
  disconnectedAt?: number;
  pendingRemovalTimer?: ReturnType<typeof setTimeout>;
}

export interface CareerRoom {
  id: string;
  anteId: string;
  tierId: string;
  ante: number;
  minBet: number;
  maxBet: number;
  buyIn: number;
  players: CareerPlayer[];
  maxPlayers: number;
  status: "waiting" | "starting" | "in-game" | "finished";
  autoStartTimer: NodeJS.Timeout | null;
  autoStartAt: number | null; // Timestamp when game will start
  createdAt: number;
  startedAt: number | null;
  gameRoomId: string | null; // Link to actual game room once started
}

// In-memory storage for career rooms
const careerRooms = new Map<string, CareerRoom>();
// Map socket IDs to room IDs for quick lookup
const socketToRoom = new Map<string, string>();
// Map user IDs to room IDs (prevent multi-room joins)
const userToRoom = new Map<string, string>();
// Map game room IDs to career room IDs (for tracking game completion)
const careerGameMapping = new Map<string, string>();

/**
 * Test-only: clear all Career waiting/in-game room state and timers.
 * Does not clear the module-level stale-room interval.
 */
export function clearAllCareerRoomsForTests(): void {
  for (const room of careerRooms.values()) {
    if (room.autoStartTimer) {
      clearTimeout(room.autoStartTimer);
      room.autoStartTimer = null;
    }
    for (const player of room.players) {
      cancelCareerDisconnectGrace(player);
    }
  }
  careerRooms.clear();
  socketToRoom.clear();
  userToRoom.clear();
  careerGameMapping.clear();
}

/** Cancel pending reconnect-grace removal for a Career seat. */
export function cancelCareerDisconnectGrace(player: CareerPlayer | undefined): void {
  if (!player) return;
  player.disconnectedAt = undefined;
  if (player.pendingRemovalTimer) {
    clearTimeout(player.pendingRemovalTimer);
    player.pendingRemovalTimer = undefined;
  }
}

/**
 * Generate a unique career room ID
 */
function generateRoomId(): string {
  return `${CAREER_ROOM_PREFIX}${uuidv4().slice(0, 8)}`;
}

/**
 * Find an available room for a specific ante that hasn't started yet
 */
export function findAvailableRoom(anteId: string): CareerRoom | null {
  for (const room of careerRooms.values()) {
    if (
      room.anteId === anteId &&
      room.status === "waiting" &&
      room.players.length < room.maxPlayers
    ) {
      return room;
    }
  }
  return null;
}

/**
 * Create a new career room
 */
export function createCareerRoom(anteId: string): CareerRoom | null {
  const option = getAnteOptionById(anteId);
  if (!option) return null;

  const room: CareerRoom = {
    id: generateRoomId(),
    anteId,
    tierId: option.tier.id,
    ante: option.ante.ante,
    minBet: option.ante.minBet,
    maxBet: option.ante.maxBet,
    buyIn: option.ante.buyIn,
    players: [],
    maxPlayers: MAX_PLAYERS_PER_ROOM,
    status: "waiting",
    autoStartTimer: null,
    autoStartAt: null,
    createdAt: Date.now(),
    startedAt: null,
    gameRoomId: null,
  };

  careerRooms.set(room.id, room);
  console.log(`[Career] Created room ${room.id} for ante ${anteId}`);
  return room;
}

/**
 * Add a player to a career room
 * Returns the room if successful, null if failed
 */
export function joinCareerRoom(
  roomId: string,
  player: CareerPlayer,
  io: Server,
  opts?: { socket?: Socket }
): { success: boolean; room?: CareerRoom; error?: string } {
  const room = careerRooms.get(roomId);
  if (!room) {
    return { success: false, error: "Room not found" };
  }

  if (room.status !== "waiting") {
    return { success: false, error: "Room has already started" };
  }

  if (room.players.length >= room.maxPlayers) {
    return { success: false, error: "Room is full" };
  }

  // Check if user is already in a room
  const existingRoomId = userToRoom.get(player.userId);
  if (existingRoomId && existingRoomId !== roomId) {
    return { success: false, error: "Already in another room" };
  }

  // Check if player has enough bankroll
  if (player.bankroll < room.buyIn) {
    return { success: false, error: "Insufficient bankroll" };
  }

  // Add player (not ready until they explicitly Ready)
  room.players.push({ ...player, ready: player.ready ?? false });
  socketToRoom.set(player.socketId, roomId);
  userToRoom.set(player.userId, roomId);

  console.log(
    `[Career] Player ${player.username} joined room ${roomId} (${room.players.length}/${room.maxPlayers})`
  );

  // Join the Socket.IO room BEFORE broadcasting so the joiner receives career:roomUpdate
  if (opts?.socket) {
    void opts.socket.join(roomId);
  }

  // Broadcast updated room state — countdown starts only after all present players Ready
  broadcastRoomState(room, io);
  maybeStartCountdown(room, io);

  return { success: true, room };
}

/**
 * Find or create a room for a player based on ante selection
 */
export function findOrCreateRoom(
  anteId: string,
  player: CareerPlayer,
  io: Server
): { success: boolean; room?: CareerRoom; error?: string } {
  // Check if user is already in a room
  const existingRoomId = userToRoom.get(player.userId);
  if (existingRoomId) {
    const existingRoom = careerRooms.get(existingRoomId);
    if (existingRoom && existingRoom.status === "waiting") {
      return { success: false, error: "Already in a waiting room", room: existingRoom };
    }
  }

  // Try to find an existing room
  let room = findAvailableRoom(anteId);

  // Create new room if none available
  if (!room) {
    room = createCareerRoom(anteId);
    if (!room) {
      return { success: false, error: "Failed to create room" };
    }
  }

  // Join the room
  return joinCareerRoom(room.id, player, io);
}

/**
 * Remove a player from their career room (explicit leave — immediate, no grace).
 */
export function leaveCareerRoom(
  socketId: string,
  io: Server
): { success: boolean; room?: CareerRoom } {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) {
    return { success: false };
  }

  const room = careerRooms.get(roomId);
  if (!room) {
    socketToRoom.delete(socketId);
    return { success: false };
  }

  // Find and remove player
  const playerIndex = room.players.findIndex((p) => p.socketId === socketId);
  if (playerIndex === -1) {
    socketToRoom.delete(socketId);
    return { success: false };
  }

  const player = room.players[playerIndex];
  cancelCareerDisconnectGrace(player);
  return finalizeCareerPlayerRemoval(room, playerIndex, io);
}

/**
 * Remove a seated Career player by userId (grace expiry / forced removal).
 */
export function removeCareerPlayerByUserId(
  roomId: string,
  userId: string,
  io: Server
): { success: boolean; room?: CareerRoom } {
  const room = careerRooms.get(roomId);
  if (!room) return { success: false };
  const playerIndex = room.players.findIndex((p) => p.userId === userId);
  if (playerIndex === -1) return { success: false };
  const player = room.players[playerIndex];
  cancelCareerDisconnectGrace(player);
  return finalizeCareerPlayerRemoval(room, playerIndex, io);
}

function finalizeCareerPlayerRemoval(
  room: CareerRoom,
  playerIndex: number,
  io: Server
): { success: boolean; room?: CareerRoom } {
  const player = room.players[playerIndex];
  room.players.splice(playerIndex, 1);
  if (player.socketId) {
    socketToRoom.delete(player.socketId);
  }
  userToRoom.delete(player.userId);

  console.log(
    `[Career] Player ${player.username} left room ${room.id} (${room.players.length}/${room.maxPlayers})`
  );

  // Leaving before game start cancels countdown and returns remaining player(s) to waiting
  if (room.status === "starting" || room.autoStartTimer) {
    cancelAutoStartTimer(room, io, "player_left");
  }
  for (const remaining of room.players) {
    remaining.ready = false;
  }
  if (room.status === "starting") {
    room.status = "waiting";
  }

  broadcastRoomState(room, io);

  // Cleanup empty rooms (waiting only — do not wipe in-game).
  // Status "starting" was already normalized to "waiting" above when a player left.
  if (room.players.length === 0 && room.status === "waiting") {
    cleanupRoom(room.id);
  }

  return { success: true, room };
}

/**
 * Multiplayer-aligned reconnect grace: keep the seat briefly on disconnect so
 * Create Waiting Table / Quick Match lobbies survive socket blips and client reconnects.
 */
export function beginCareerDisconnectGrace(
  socketId: string,
  io: Server,
  graceMs: number = RECONNECT_GRACE_MS
): void {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return;

  const room = careerRooms.get(roomId);
  if (!room) {
    socketToRoom.delete(socketId);
    return;
  }

  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) {
    socketToRoom.delete(socketId);
    return;
  }

  // In-game / finished Career metadata rooms: drop socket mapping only (game room has its own grace)
  if (room.status === "in-game" || room.status === "finished") {
    socketToRoom.delete(socketId);
    player.socketId = "";
    player.odocketId = "";
    return;
  }

  cancelCareerDisconnectGrace(player);
  player.disconnectedAt = Date.now();
  socketToRoom.delete(socketId);
  player.socketId = "";
  player.odocketId = "";

  if (room.status === "starting" || room.autoStartTimer) {
    cancelAutoStartTimer(room, io, "player_disconnected");
    for (const remaining of room.players) {
      remaining.ready = false;
    }
    room.status = "waiting";
  }

  console.log(
    `[Career] Player ${player.username} disconnected from ${room.id} (reconnect grace ${graceMs}ms)`
  );
  broadcastRoomState(room, io);

  const userId = player.userId;
  player.pendingRemovalTimer = setTimeout(() => {
    console.log(`[Career] Reconnect grace expired for ${userId} in ${roomId}`);
    removeCareerPlayerByUserId(roomId, userId, io);
  }, graceMs);
}

/**
 * Set Career waiting-room Ready flag. Countdown starts only when
 * the room is full (maxPlayers) and every seated player is ready.
 */
export function setCareerPlayerReady(
  socketId: string,
  ready: boolean,
  io: Server
): { success: boolean; room?: CareerRoom; error?: string } {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) {
    return { success: false, error: "Not in a career room" };
  }
  const room = careerRooms.get(roomId);
  if (!room) {
    return { success: false, error: "Room not found" };
  }
  if (room.status !== "waiting" && room.status !== "starting") {
    return { success: false, error: "Game already in progress" };
  }

  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) {
    return { success: false, error: "Player not in room" };
  }

  player.ready = !!ready;

  // Un-ready during countdown cancels and returns to waiting
  if (!player.ready && (room.status === "starting" || room.autoStartTimer)) {
    cancelAutoStartTimer(room, io, "ready_cleared");
    room.status = "waiting";
  }

  broadcastRoomState(room, io);
  maybeStartCountdown(room, io);
  return { success: true, room };
}

function allSeatedPlayersReady(room: CareerRoom): boolean {
  return (
    room.players.length >= 2 &&
    room.players.length >= room.maxPlayers &&
    room.players.every((p) => p.ready && !!p.socketId && !p.disconnectedAt)
  );
}

function maybeStartCountdown(room: CareerRoom, io: Server): void {
  if (room.status !== "waiting") return;
  if (room.autoStartTimer) return;
  if (!allSeatedPlayersReady(room)) return;
  startAutoStartTimer(room, io);
}

/**
 * Start the auto-start countdown (after both Ready).
 */
function startAutoStartTimer(room: CareerRoom, io: Server) {
  if (room.autoStartTimer) {
    clearTimeout(room.autoStartTimer);
  }

  room.autoStartAt = Date.now() + AUTO_START_DELAY_MS;
  room.status = "starting"; // Locks further joins

  console.log(`[Career] Auto-start timer started for room ${room.id} (${AUTO_START_DELAY_MS}ms)`);

  io.to(room.id).emit("career:autoStartTimer", {
    roomId: room.id,
    startsAt: room.autoStartAt,
    secondsRemaining: AUTO_START_DELAY_MS / 1000,
  });

  room.autoStartTimer = setTimeout(() => {
    triggerGameStart(room, io);
  }, AUTO_START_DELAY_MS);
}

/**
 * Cancel the auto-start timer
 */
function cancelAutoStartTimer(
  room: CareerRoom,
  io?: Server,
  reason: string = "cancelled"
) {
  if (room.autoStartTimer) {
    clearTimeout(room.autoStartTimer);
    room.autoStartTimer = null;
  }
  room.autoStartAt = null;
  console.log(`[Career] Auto-start timer cancelled for room ${room.id} (${reason})`);
  if (io) {
    io.to(room.id).emit("career:countdownCancelled", {
      roomId: room.id,
      reason,
    });
  }
}

/**
 * Trigger the game start when timer expires
 */
function triggerGameStart(room: CareerRoom, io: Server) {
  if (room.players.length < 2 || !allSeatedPlayersReady(room)) {
    console.log(`[Career] Cannot start room ${room.id} - not enough ready players`);
    cancelAutoStartTimer(room, io, "not_ready");
    room.status = "waiting";
    for (const p of room.players) p.ready = false;
    broadcastRoomState(room, io);
    return;
  }

  // Phase 3: Identity Verification - verify all player sockets are still authenticated
  for (const player of room.players) {
    const socket = io.sockets.sockets.get(player.socketId);
    if (!socket) {
      console.error(`[Career] Player ${player.username} socket ${player.socketId} not connected`);
      cancelAutoStartTimer(room, io, "player_disconnected");
      room.status = "waiting";
      for (const p of room.players) p.ready = false;
      io.to(room.id).emit("career:error", {
        code: "player_disconnected",
        message: `${player.username} disconnected before game could start`,
      });
      broadcastRoomState(room, io);
      return;
    }
  }

  room.status = "starting";
  room.startedAt = Date.now();
  room.autoStartTimer = null;
  room.autoStartAt = null;

  console.log(`[Career] Starting game in room ${room.id} with ${room.players.length} players`);

  // Generate game room ID (prefixed to avoid conflicts with multiplayer)
  const gameRoomId = `career-game-${uuidv4().slice(0, 8)}`;
  
  // Create game config
  const gameConfig: TableConfig = {
    ante: room.ante,
    startingBankroll: room.players[0].bankroll, // Use player's bankroll
    minBetPolicy: { type: "fixed", value: room.minBet },
    maxPlayers: room.maxPlayers,
    shistri: { enabled: true, percent: SHISTRI_DEFAULT_PERCENT, minChip: SHISTRI_DEFAULT_MIN_CHIP },
    deckPolicy: "single_no_reshuffle_until_empty",
    allowKouppi: true,
    spectatorsAllowed: false,
    language: "en",
  } as TableConfig;

  try {
    // Create the game room with the first player as host
    const firstPlayer = room.players[0];
    const gameRoom = createRoomWithCreator(
      gameRoomId,
      {
        id: firstPlayer.userId,
        name: firstPlayer.username,
        socketId: firstPlayer.socketId,
        avatar: {
          id: firstPlayer.avatarId,
        },
        cosmetics: firstPlayer.cosmetics ?? safePublicCosmetics(firstPlayer.userId),
      },
      gameConfig,
      Math.floor(Math.random() * 1e9),
      undefined, // password
      undefined, // publicCode
      {
        listedInLobby: false, // Don't show career games in casual lobby
        presetLabel: `Career - ${room.ante} ante`,
      },
      {
        matchType: "career",
        tierId: room.tierId,
        anteId: room.anteId,
        careerRoomId: room.id,
      }
    );

    // Add remaining players to the game room
    for (let i = 1; i < room.players.length; i++) {
      const player = room.players[i];
      joinRoom(gameRoomId, {
        id: player.userId,
        name: player.username,
        socketId: player.socketId,
        avatar: {
          id: player.avatarId,
        },
        cosmetics: player.cosmetics ?? safePublicCosmetics(player.userId),
      });
    }

    // Career auto-start is server-authoritative: mark everyone ready so startRoom can proceed.
    // (Casual MP requires explicit Ready; Career countdown already served that purpose.)
    for (const player of room.players) {
      setPlayerReady(gameRoomId, player.userId, true);
    }

    // Start the game shell; turn kickoff runs after sockets join the game room
    // so they receive the initial `turnTimer` / `state` broadcasts.
    startRoom(gameRoomId, firstPlayer.userId);

    // Mark this career room as in-game
    room.status = "in-game";
    room.gameRoomId = gameRoomId;

    // Store career room reference for game end tracking
    careerGameMapping.set(gameRoomId, room.id);

    console.log(`[Career] Game room ${gameRoomId} created and started`);

    // Have all player sockets join the game room before turn kickoff broadcasts
    for (const player of room.players) {
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        playerSocket.join(gameRoomId);
      }
    }

    runCareerGameKickoff(gameRoomId);
    // Unit-test / no-IO fallback: ensure at least one startTurn was applied.
    const started = getRoom(gameRoomId);
    if (started?.state && !started.state.turn && started.state.phase === "Round") {
      startFirstTurn(gameRoomId);
    }

    // Get the game state snapshot
    const gameSnapshot = snapshot(gameRoomId);

    // Emit transition event to all players with game state
    io.to(room.id).emit("career:transitionToGame", {
      careerRoomId: room.id,
      gameRoomId,
      config: gameConfig,
      snapshot: gameSnapshot,
    });

    // Also emit the initial game state to the game room
    io.to(gameRoomId).emit("state", gameSnapshot);

  } catch (error) {
    console.error(`[Career] Failed to create game room:`, error);
    room.status = "waiting";
    room.startedAt = null;
    
    io.to(room.id).emit("career:error", {
      code: "game_start_failed",
      message: "Failed to start game. Please try again.",
    });
  }
}

/**
 * Mark a career room as in-game (after game room is created)
 */
export function markRoomInGame(roomId: string, gameRoomId: string): boolean {
  const room = careerRooms.get(roomId);
  if (!room) return false;

  room.status = "in-game";
  room.gameRoomId = gameRoomId;
  careerGameMapping.set(gameRoomId, room.id);
  console.log(`[Career] Room ${roomId} now in-game as ${gameRoomId}`);
  return true;
}

/**
 * Mark a career room as finished and schedule cleanup
 */
export function markRoomFinished(roomId: string, io: Server): boolean {
  const room = careerRooms.get(roomId);
  if (!room) return false;

  room.status = "finished";
  
  // Notify players
  io.to(roomId).emit("career:gameFinished", { roomId });

  // Clear mappings
  for (const player of room.players) {
    socketToRoom.delete(player.socketId);
    userToRoom.delete(player.userId);
  }

  // Schedule cleanup after a brief delay
  setTimeout(() => {
    cleanupRoom(roomId);
  }, 5000);

  console.log(`[Career] Room ${roomId} finished`);
  return true;
}

/**
 * Clean up a room and release all resources
 */
export function cleanupRoom(roomId: string): boolean {
  const room = careerRooms.get(roomId);
  if (!room) return false;

  // Cancel any pending timer
  if (room.autoStartTimer) {
    clearTimeout(room.autoStartTimer);
  }

  // Clear all mappings
  for (const player of room.players) {
    cancelCareerDisconnectGrace(player);
    socketToRoom.delete(player.socketId);
    userToRoom.delete(player.userId);
  }

  careerRooms.delete(roomId);
  console.log(`[Career] Cleaned up room ${roomId}`);
  return true;
}

/**
 * Broadcast room state to all players in the room
 */
export function buildCareerRoomUpdatePayload(room: CareerRoom) {
  return {
    roomId: room.id,
    tierId: room.tierId,
    anteId: room.anteId,
    ante: room.ante,
    minBet: room.minBet,
    maxBet: room.maxBet,
    status: room.status,
    players: room.players.map((p) => ({
      odlayerId: p.odlayerId,
      odlayerName: p.odlayerName,
      odlating: p.odlating,
      userId: p.userId,
      username: p.username,
      rating: p.rating,
      avatarId: p.avatarId,
      cosmetics: p.cosmetics,
      ready: !!p.ready,
      connected: !!p.socketId && !p.disconnectedAt,
    })),
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    autoStartAt: room.autoStartAt,
    secondsRemaining: room.autoStartAt
      ? Math.max(0, Math.ceil((room.autoStartAt - Date.now()) / 1000))
      : null,
  };
}

function broadcastRoomState(room: CareerRoom, io: Server) {
  io.to(room.id).emit("career:roomUpdate", buildCareerRoomUpdatePayload(room));
}

/**
 * Get room by ID
 */
export function getCareerRoom(roomId: string): CareerRoom | undefined {
  return careerRooms.get(roomId);
}

/**
 * Get room by socket ID
 */
export function getRoomBySocket(socketId: string): CareerRoom | undefined {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return undefined;
  return careerRooms.get(roomId);
}

/**
 * Get all active career rooms (for admin/debugging)
 */
export function getAllCareerRooms(): CareerRoom[] {
  return Array.from(careerRooms.values());
}

/**
 * Get rooms by ante ID (for displaying waiting rooms)
 */
export function getRoomsByAnte(anteId: string): CareerRoom[] {
  return Array.from(careerRooms.values()).filter(
    (room) => room.anteId === anteId && room.status === "waiting"
  );
}

/**
 * Handle player disconnect — multiplayer-style grace, not immediate seat removal.
 */
export function handleDisconnect(socketId: string, io: Server) {
  beginCareerDisconnectGrace(socketId, io);
}

/**
 * Get career room ID from game room ID
 */
export function getCareerRoomByGameId(gameRoomId: string): CareerRoom | undefined {
  const careerRoomId = careerGameMapping.get(gameRoomId);
  if (!careerRoomId) return undefined;
  return careerRooms.get(careerRoomId);
}

/**
 * Check if a game room is a career game
 */
export function isCareerGame(gameRoomId: string): boolean {
  return careerGameMapping.has(gameRoomId);
}

/**
 * Handle career game completion - update trophies and bankroll
 */
export function handleCareerGameEnd(
  gameRoomId: string,
  playerResults: Array<{
    odlayerId?: string;
    odlayerName?: string;
    odaying?: number;
    userId: string;
    finalBankroll: number;
    chipsWon: number; // Net chips won/lost during game
    handsWon: number;
    handsPlayed: number;
  }>,
  io: Server
): void {
  const careerRoom = getCareerRoomByGameId(gameRoomId);
  if (!careerRoom) {
    console.log(`[Career] No career room found for game ${gameRoomId}`);
    return;
  }

  console.log(`[Career] Game ${gameRoomId} ended. Processing results...`);

  // Import database functions dynamically to avoid circular deps
  import("@kouppi/database").then(({ updateRatingAndTrophies, updateBankroll, updateMatchStats, createMatch, completeMatch, calculateMultiplayerTrophyChange, calculateNewRating, onCareerMatchFinished }) => {
    // Sort players by chips won (best to worst)
    const sortedResults = [...playerResults].sort((a, b) => b.chipsWon - a.chipsWon);
    
    // Determine placements
    const placements = sortedResults.map((p, i) => ({ ...p, placement: i + 1 }));
    
    // Calculate trophy changes based on performance
    for (const result of placements) {
      // Find career player by odlayerId (which is actually userId in career games)
      const careerPlayer = careerRoom.players.find(p => p.userId === result.userId);
      if (!careerPlayer) {
        console.log(`[Career] Could not find career player for userId ${result.userId}`);
        continue;
      }

      // Calculate performance score (0-1 based on chips won relative to ante)
      const maxPossibleWin = careerRoom.ante * careerRoom.players.length * 10; // Rough estimate
      const performanceScore = Math.max(0, Math.min(1, (result.chipsWon + maxPossibleWin / 2) / maxPossibleWin));
      
      // Calculate trophy change using multiplayer formula
      const trophyChange = calculateMultiplayerTrophyChange(
        careerPlayer.rating,
        performanceScore,
        result.placement,
        careerRoom.players.length
      );

      // Update user's trophies and rating
      const avgOpponentRating = careerRoom.players
        .filter(p => p.userId !== result.userId)
        .reduce((sum, p) => sum + p.rating, 0) / (careerRoom.players.length - 1);
      
      const isWinner = result.placement === 1;
      const previousRating = careerPlayer.rating;
      const newRating = calculateNewRating(
        previousRating,
        avgOpponentRating,
        isWinner ? 1 : 0 // Simple win/loss
      );
      // updateRatingAndTrophies expects a rating *delta*, not an absolute rating.
      const ratingDelta = newRating - previousRating;

      try {
        // Update rating and trophies
        updateRatingAndTrophies(result.userId, ratingDelta, trophyChange);
        
        // Update bankroll
        updateBankroll(result.userId, result.finalBankroll);

        updateMatchStats(result.userId, isWinner, Math.max(0, result.chipsWon));

        // Reward system: first-win, missions, season XP (idempotent per event)
        try {
          const rewardResult = onCareerMatchFinished({
            eventId: `${careerRoom.id}:${gameRoomId}:${result.userId}`,
            userId: result.userId,
            mode: "career",
            placement: result.placement,
            chipsWon: Math.max(0, result.chipsWon),
            potWon: Math.max(0, result.chipsWon),
            won: isWinner,
          });
          if (rewardResult.firstWin?.applied) {
            console.log(`[Career] First-win bonus applied for ${careerPlayer.username}`);
          }
        } catch (rewardError) {
          console.error(`[Career] Reward hook failed for ${result.userId}:`, rewardError);
        }
        
        console.log(`[Career] Updated ${careerPlayer.username}: rating ${previousRating} -> ${newRating} (delta ${ratingDelta >= 0 ? "+" : ""}${ratingDelta}), trophies ${trophyChange >= 0 ? '+' : ''}${trophyChange}, bankroll -> ${result.finalBankroll}`);
      } catch (error) {
        console.error(`[Career] Failed to update player ${result.userId}:`, error);
      }
    }

    // Create match record (simplified for multiplayer)
    if (placements.length >= 2) {
      try {
        const winner = placements[0];
        const runnerUp = placements[1];
        
        const winnerPlayer = careerRoom.players.find(p => p.userId === winner.userId);
        const runnerUpPlayer = careerRoom.players.find(p => p.userId === runnerUp.userId);
        
        if (winnerPlayer && runnerUpPlayer) {
          const matchId = createMatch({
            player1Id: winnerPlayer.userId,
            player2Id: runnerUpPlayer.userId,
            player1RatingBefore: winnerPlayer.rating,
            player2RatingBefore: runnerUpPlayer.rating,
          });
          
          // Complete the match with results
          const durationSeconds = careerRoom.startedAt 
            ? Math.floor((Date.now() - careerRoom.startedAt) / 1000)
            : 0;
          
          completeMatch(matchId, {
            winnerId: winnerPlayer.userId,
            player1RatingChange: 0, // Already applied above
            player2RatingChange: 0,
            player1TrophyChange: 0, // Already applied above
            player2TrophyChange: 0,
            roundsPlayed: 1, // Career games count as single rounds for match history
            durationSeconds,
            player1FinalBankroll: winner.finalBankroll,
            player2FinalBankroll: runnerUp.finalBankroll,
          });
        }
      } catch (error) {
        console.error(`[Career] Failed to create match record:`, error);
      }
    }

    // Notify players of results
    io.to(careerRoom.id).emit("career:gameResults", {
      gameRoomId,
      careerRoomId: careerRoom.id,
      results: placements.map(p => ({
        userId: p.userId,
        placement: p.placement,
        chipsWon: p.chipsWon,
        finalBankroll: p.finalBankroll,
      })),
    });

    // Mark room as finished
    markRoomFinished(careerRoom.id, io);
    
    // Clean up game mapping
    careerGameMapping.delete(gameRoomId);
  }).catch(error => {
    console.error(`[Career] Error processing game end:`, error);
  });
}

/**
 * Pick an ante both players can afford. Prefer a shared queue selection, otherwise
 * the lower buy-in option that both bankrolls support.
 */
function resolveMatchAnte(
  anteId1: string,
  anteId2: string,
  user1: { bankroll: number; rating: number },
  user2: { bankroll: number; rating: number }
): ReturnType<typeof getAnteOptionById> {
  if (anteId1 && anteId1 === anteId2) {
    const shared = getAnteOptionById(anteId1);
    if (
      shared &&
      canAffordAnte(user1.bankroll, anteId1) &&
      canAffordAnte(user2.bankroll, anteId1)
    ) {
      return shared;
    }
  }

  const candidates = [anteId1, anteId2]
    .map((id) => getAnteOptionById(id))
    .filter((option): option is NonNullable<typeof option> => !!option)
    .sort((a, b) => a.ante.buyIn - b.ante.buyIn);

  for (const option of candidates) {
    if (
      canAffordAnte(user1.bankroll, option.ante.id) &&
      canAffordAnte(user2.bankroll, option.ante.id)
    ) {
      return option;
    }
  }

  const minBankroll = Math.min(user1.bankroll, user2.bankroll);
  const minRating = Math.min(user1.rating, user2.rating);
  const affordable = CAREER_TIERS.flatMap((tier) =>
    tier.minRating <= minRating ? tier.antes.map((ante) => ({ tier, ante })) : []
  )
    .filter((option) => minBankroll >= option.ante.buyIn)
    .sort((a, b) => b.ante.buyIn - a.ante.buyIn);

  return affordable[0];
}

/**
 * Handle match found from queue - create career room and start game
 * Called by matchmaking loop when compatible players are found
 */
export function handleMatchFound(match: MatchFound, io: Server): void {
  console.log(`[Career] Match found: ${match.player1.playerName} vs ${match.player2.playerName}`);

  const user1 = getUserById(match.player1.playerId);
  const user2 = getUserById(match.player2.playerId);
  if (!user1 || !user2) {
    console.error("[Career] Match failed - user record missing");
    io.to(match.player1.socketId).emit("career:error", {
      code: "match_failed",
      message: "Failed to create match - please try again",
    });
    io.to(match.player2.socketId).emit("career:error", {
      code: "match_failed",
      message: "Failed to create match - please try again",
    });
    return;
  }

  const anteOption = resolveMatchAnte(match.player1.anteId, match.player2.anteId, user1, user2);
  if (!anteOption) {
    console.error("[Career] No valid ante option found for match");
    io.to(match.player1.socketId).emit("career:error", {
      code: "match_failed",
      message: "Failed to create match - please try again",
    });
    io.to(match.player2.socketId).emit("career:error", {
      code: "match_failed",
      message: "Failed to create match - please try again",
    });
    return;
  }

  console.log(
    `[Career] Selected ${anteOption.tier.name} - ${anteOption.ante.label} for match (ratings: ${match.player1.rating}-${match.player2.rating})`
  );
  
  // Create career room
  const room: CareerRoom = {
    id: generateRoomId(),
    anteId: anteOption.ante.id,
    tierId: anteOption.tier.id,
    ante: anteOption.ante.ante,
    minBet: anteOption.ante.minBet,
    maxBet: anteOption.ante.maxBet,
    buyIn: anteOption.ante.buyIn,
    players: [],
    maxPlayers: MAX_PLAYERS_PER_ROOM,
    status: "waiting",
    autoStartTimer: null,
    autoStartAt: null,
    createdAt: Date.now(),
    startedAt: null,
    gameRoomId: null,
  };
  
  // Add both players to room (not Ready — countdown waits for explicit Ready)
  const player1: CareerPlayer = {
    odlayerId: match.player1.playerId,
    odlayerName: match.player1.playerName,
    odlating: match.player1.rating,
    odankroll: user1.bankroll,
    odocketId: match.player1.socketId,
    userId: match.player1.playerId,
    username: match.player1.playerName,
    rating: match.player1.rating,
    bankroll: user1.bankroll,
    socketId: match.player1.socketId,
    avatarId: user1.avatarId,
    cosmetics: safePublicCosmetics(user1.id),
    joinedAt: Date.now(),
    ready: false,
  };
  
  const player2: CareerPlayer = {
    odlayerId: match.player2.playerId,
    odlayerName: match.player2.playerName,
    odlating: match.player2.rating,
    odankroll: user2.bankroll,
    odocketId: match.player2.socketId,
    userId: match.player2.playerId,
    username: match.player2.playerName,
    rating: match.player2.rating,
    bankroll: user2.bankroll,
    socketId: match.player2.socketId,
    avatarId: user2.avatarId,
    cosmetics: safePublicCosmetics(user2.id),
    joinedAt: Date.now(),
    ready: false,
  };
  
  room.players.push(player1, player2);
  
  // Register room mappings
  careerRooms.set(room.id, room);
  socketToRoom.set(player1.socketId, room.id);
  socketToRoom.set(player2.socketId, room.id);
  userToRoom.set(player1.userId, room.id);
  userToRoom.set(player2.userId, room.id);
  
  console.log(`[Career] Created room ${room.id} for match`);
  
  // Have both sockets join the room channel
  io.sockets.sockets.get(player1.socketId)?.join(room.id);
  io.sockets.sockets.get(player2.socketId)?.join(room.id);
  
  // Notify both players of match found
  io.to(player1.socketId).emit("career:matchFound", {
    roomId: room.id,
    opponent: {
      username: player2.username,
      rating: player2.rating,
      avatarId: player2.avatarId,
    },
  });
  
  io.to(player2.socketId).emit("career:matchFound", {
    roomId: room.id,
    opponent: {
      username: player1.username,
      rating: player1.rating,
      avatarId: player1.avatarId,
    },
  });
  
  // Waiting / Ready state — do not start countdown until both Ready
  broadcastRoomState(room, io);
}

/**
 * Periodic cleanup of stale rooms (call this on an interval)
 */
export function cleanupStaleRooms() {
  const now = Date.now();
  const STALE_THRESHOLD = 30 * 60 * 1000; // 30 minutes

  for (const [roomId, room] of careerRooms.entries()) {
    // Clean up rooms that have been waiting too long with no players
    if (
      room.status === "waiting" &&
      room.players.length === 0 &&
      now - room.createdAt > 60000 // 1 minute empty
    ) {
      cleanupRoom(roomId);
      continue;
    }

    // Clean up finished rooms that weren't cleaned properly
    if (room.status === "finished" && now - (room.startedAt || room.createdAt) > STALE_THRESHOLD) {
      cleanupRoom(roomId);
      continue;
    }
  }
}

let staleRoomCleanupInterval: ReturnType<typeof setInterval> | null = null;

/** Start periodic Career room sweep (once per process / server boot). */
export function startCareerStaleRoomCleanup(intervalMs = 60_000): void {
  if (staleRoomCleanupInterval) return;
  staleRoomCleanupInterval = setInterval(cleanupStaleRooms, intervalMs);
}

/** Stop periodic Career room sweep (server shutdown / tests). */
export function stopCareerStaleRoomCleanup(): void {
  if (staleRoomCleanupInterval) {
    clearInterval(staleRoomCleanupInterval);
    staleRoomCleanupInterval = null;
  }
}

export function isCareerStaleRoomCleanupRunning(): boolean {
  return staleRoomCleanupInterval !== null;
}

/** Lookup Career room by authenticated user id. */
export function getCareerRoomByUserId(userId: string): CareerRoom | undefined {
  const roomId = userToRoom.get(userId);
  if (!roomId) return undefined;
  return careerRooms.get(roomId);
}

/**
 * Rebind a player's socket id inside an existing Career waiting/starting room
 * (idempotent create / reconnect within same session).
 */
export function rebindCareerPlayerSocket(
  roomId: string,
  userId: string,
  newSocketId: string,
  io: Server,
  opts?: { socket?: Socket }
): { success: boolean; room?: CareerRoom; error?: string } {
  const room = careerRooms.get(roomId);
  if (!room) return { success: false, error: "Room not found" };
  if (room.status !== "waiting" && room.status !== "starting") {
    return { success: false, error: "Room has already started" };
  }
  const player = room.players.find((p) => p.userId === userId);
  if (!player) return { success: false, error: "Player not in room" };

  cancelCareerDisconnectGrace(player);

  if (player.socketId !== newSocketId) {
    if (player.socketId) {
      socketToRoom.delete(player.socketId);
    }
    player.socketId = newSocketId;
    player.odocketId = newSocketId;
    socketToRoom.set(newSocketId, roomId);
  }
  if (opts?.socket) {
    void opts.socket.join(roomId);
  }
  broadcastRoomState(room, io);
  return { success: true, room };
}