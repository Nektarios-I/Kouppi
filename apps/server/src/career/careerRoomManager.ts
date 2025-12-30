/**
 * Career Room Manager
 * 
 * Manages Career Mode rooms with:
 * - Auto-fill: Players join existing non-started rooms first
 * - Auto-start: 30-second timer when 2+ players join
 * - Cleanup: Proper resource release after games end
 * - Naming: Unique room IDs with "career-" prefix to avoid conflicts
 */

import { v4 as uuidv4 } from "uuid";
import { Server, Socket } from "socket.io";
import { getAnteOptionById, type AnteTier, type AnteOption } from "./tiers.js";
import { 
  createRoomWithCreator, 
  joinRoom, 
  startRoom, 
  startFirstTurn, 
  getRoom,
  closeRoom,
  snapshot,
} from "../rooms.js";
import type { TableConfig } from "@kouppi/game-core";

const MAX_PLAYERS_PER_ROOM = 8;
const AUTO_START_DELAY_MS = 30000; // 30 seconds
const CAREER_ROOM_PREFIX = "career-";

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
  avatarEmoji: string;
  avatarColor: string;
  avatarBorder: string;
  joinedAt: number;
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
  io: Server
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

  // Add player
  room.players.push(player);
  socketToRoom.set(player.socketId, roomId);
  userToRoom.set(player.userId, roomId);

  console.log(
    `[Career] Player ${player.username} joined room ${roomId} (${room.players.length}/${room.maxPlayers})`
  );

  // Broadcast updated room state
  broadcastRoomState(room, io);

  // Start auto-start timer if 2+ players
  if (room.players.length >= 2 && !room.autoStartTimer) {
    startAutoStartTimer(room, io);
  }

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
 * Remove a player from their career room
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
  room.players.splice(playerIndex, 1);
  socketToRoom.delete(socketId);
  userToRoom.delete(player.userId);

  console.log(
    `[Career] Player ${player.username} left room ${roomId} (${room.players.length}/${room.maxPlayers})`
  );

  // Cancel auto-start if less than 2 players
  if (room.players.length < 2 && room.autoStartTimer) {
    cancelAutoStartTimer(room);
  }

  // Broadcast updated room state
  broadcastRoomState(room, io);

  // Cleanup empty rooms
  if (room.players.length === 0 && room.status === "waiting") {
    cleanupRoom(room.id);
  }

  return { success: true, room };
}

/**
 * Start the 30-second auto-start timer
 */
function startAutoStartTimer(room: CareerRoom, io: Server) {
  if (room.autoStartTimer) {
    clearTimeout(room.autoStartTimer);
  }

  room.autoStartAt = Date.now() + AUTO_START_DELAY_MS;
  room.status = "waiting"; // Still waiting, just with timer

  console.log(`[Career] Auto-start timer started for room ${room.id}`);

  // Notify players
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
function cancelAutoStartTimer(room: CareerRoom) {
  if (room.autoStartTimer) {
    clearTimeout(room.autoStartTimer);
    room.autoStartTimer = null;
    room.autoStartAt = null;
    console.log(`[Career] Auto-start timer cancelled for room ${room.id}`);
  }
}

/**
 * Trigger the game start when timer expires
 */
function triggerGameStart(room: CareerRoom, io: Server) {
  if (room.players.length < 2) {
    console.log(`[Career] Cannot start room ${room.id} - not enough players`);
    cancelAutoStartTimer(room);
    return;
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
    shistri: { enabled: true, percent: 5, minChip: 1 },
    deckPolicy: "single_no_reshuffle_until_empty",
    allowKouppi: true,
    spectatorsAllowed: false,
    language: "en",
  } as TableConfig;

  try {
    // Create the game room with the first player as host
    const firstPlayer = room.players[0];
    createRoomWithCreator(
      gameRoomId,
      {
        id: firstPlayer.userId,
        name: firstPlayer.username,
        socketId: firstPlayer.socketId,
        avatar: {
          emoji: firstPlayer.avatarEmoji,
          color: firstPlayer.avatarColor,
          borderColor: firstPlayer.avatarBorder,
        },
      },
      gameConfig,
      Math.floor(Math.random() * 1e9)
    );

    // Add remaining players to the game room
    for (let i = 1; i < room.players.length; i++) {
      const player = room.players[i];
      joinRoom(gameRoomId, {
        id: player.userId,
        name: player.username,
        socketId: player.socketId,
        avatar: {
          emoji: player.avatarEmoji,
          color: player.avatarColor,
          borderColor: player.avatarBorder,
        },
      });
    }

    // Start the game
    startRoom(gameRoomId, firstPlayer.userId);
    startFirstTurn(gameRoomId);

    // Get the game state snapshot
    const gameSnapshot = snapshot(gameRoomId);

    // Mark this career room as in-game
    room.status = "in-game";
    room.gameRoomId = gameRoomId;

    // Store career room reference for game end tracking
    careerGameMapping.set(gameRoomId, room.id);

    console.log(`[Career] Game room ${gameRoomId} created and started`);

    // Have all player sockets join the game room
    for (const player of room.players) {
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        playerSocket.join(gameRoomId);
      }
    }

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
function broadcastRoomState(room: CareerRoom, io: Server) {
  io.to(room.id).emit("career:roomUpdate", {
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
      avatarEmoji: p.avatarEmoji,
      avatarColor: p.avatarColor,
      avatarBorder: p.avatarBorder,
    })),
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    autoStartAt: room.autoStartAt,
    secondsRemaining: room.autoStartAt 
      ? Math.max(0, Math.ceil((room.autoStartAt - Date.now()) / 1000))
      : null,
  });
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
 * Handle player disconnect
 */
export function handleDisconnect(socketId: string, io: Server) {
  leaveCareerRoom(socketId, io);
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
  import("@kouppi/database").then(({ updateRatingAndTrophies, updateBankroll, createMatch, completeMatch, calculateMultiplayerTrophyChange, calculateNewRating }) => {
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
      const newRating = calculateNewRating(
        careerPlayer.rating,
        avgOpponentRating,
        isWinner ? 1 : 0 // Simple win/loss
      );

      try {
        // Update rating and trophies
        updateRatingAndTrophies(result.userId, newRating, trophyChange);
        
        // Update bankroll
        updateBankroll(result.userId, result.finalBankroll);
        
        console.log(`[Career] Updated ${careerPlayer.username}: rating ${careerPlayer.rating} -> ${newRating}, trophies ${trophyChange >= 0 ? '+' : ''}${trophyChange}, bankroll -> ${result.finalBankroll}`);
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

// Start periodic cleanup
setInterval(cleanupStaleRooms, 60000); // Every minute
