/**
 * Career Mode Socket Handlers
 * 
 * Handles all career-related socket events:
 * - career:getTiers - Get available tiers for player's rating
 * - career:joinAnte - Join matchmaking queue for a specific ante
 * - career:leaveQueue - Leave matchmaking queue
 * - career:getQueueStatus - Get current queue status
 * - career:leaveRoom - Leave current waiting room
 * - career:getRoomInfo - Get current room state
 */

import { Server, Socket } from "socket.io";
import { 
  CAREER_TIERS, 
  getAvailableTiers, 
  getTierById, 
  getAnteOptionById,
  canAccessTier,
  canAffordAnte,
} from "./tiers.js";
import {
  joinQueue,
  leaveQueue,
  getQueueStatus,
  isInQueue,
  type QueueEntry,
} from "./queue.js";
import {
  findOrCreateRoom,
  leaveCareerRoom,
  getRoomBySocket,
  getCareerRoom,
  handleDisconnect,
  markRoomInGame,
  markRoomFinished,
  type CareerPlayer,
} from "./careerRoomManager.js";
import { getUserById } from "@kouppi/database";
import { verifyToken } from "../auth/jwt.js";
import { createRoomWithCreator, snapshot, getRoom, closeRoom, startRoom } from "../rooms.js";
import type { TableConfig } from "@kouppi/game-core";

// Store socket -> userId mapping for authenticated sockets
const authenticatedSockets = new Map<string, { userId: string; username: string }>();

/**
 * Authenticate a socket connection with JWT token
 */
function authenticateSocket(socket: Socket, token: string): { userId: string; username: string } | null {
  try {
    const payload = verifyToken(token);
    if (!payload) return null;
    
    const user = getUserById(payload.userId);
    if (!user) return null;
    
    authenticatedSockets.set(socket.id, { userId: user.id, username: user.username });
    return { userId: user.id, username: user.username };
  } catch {
    return null;
  }
}

/**
 * Get user data from socket
 */
function getSocketUser(socket: Socket): { userId: string; username: string } | null {
  return authenticatedSockets.get(socket.id) || null;
}

/**
 * Register career mode socket handlers
 */
export function registerCareerHandlers(io: Server, socket: Socket, defaultConfig: TableConfig) {
  /**
   * Authenticate socket for career mode
   */
  socket.on("career:auth", (payload: { token: string }, cb?: (err: any, data?: any) => void) => {
    const result = authenticateSocket(socket, payload.token);
    if (!result) {
      const err = { code: "auth_failed", message: "Invalid token" };
      cb ? cb(err) : socket.emit("career:error", err);
      return;
    }
    
    const user = getUserById(result.userId);
    if (!user) {
      const err = { code: "user_not_found", message: "User not found" };
      cb ? cb(err) : socket.emit("career:error", err);
      return;
    }
    
    const response = {
      userId: user.id,
      username: user.username,
      rating: user.rating,
      trophies: user.trophies,
      bankroll: user.bankroll,
      avatarEmoji: user.avatarEmoji,
      avatarColor: user.avatarColor,
      avatarBorder: user.avatarBorder,
    };
    
    cb ? cb(null, response) : socket.emit("career:authenticated", response);
  });

  /**
   * Get all tiers with player's eligibility
   */
  socket.on("career:getTiers", (payload: { token: string }, cb?: (err: any, data?: any) => void) => {
    try {
      const auth = authenticateSocket(socket, payload.token);
      if (!auth) {
        const err = { code: "auth_failed", message: "Authentication required" };
        cb ? cb(err) : socket.emit("career:error", err);
        return;
      }
      
      const user = getUserById(auth.userId);
      if (!user) {
        const err = { code: "user_not_found", message: "User not found" };
        cb ? cb(err) : socket.emit("career:error", err);
        return;
      }
      
      const tiers = CAREER_TIERS.map((tier) => ({
        ...tier,
        accessible: user.rating >= tier.minRating,
        antes: tier.antes.map((ante) => ({
          ...ante,
          canAfford: user.bankroll >= ante.buyIn,
        })),
      }));
      
      const response = {
        tiers,
        playerRating: user.rating,
        playerBankroll: user.bankroll,
      };
      
      cb ? cb(null, response) : socket.emit("career:tiers", response);
    } catch (e: any) {
      const err = { code: "error", message: e.message };
      cb ? cb(err) : socket.emit("career:error", err);
    }
  });

  /**
   * Join matchmaking queue for a specific ante
   * Replaces instant room join with queue-based matching
   */
  socket.on("career:joinAnte", (
    payload: { token: string; anteId: string },
    cb?: (err: any, data?: any) => void
  ) => {
    try {
      const auth = authenticateSocket(socket, payload.token);
      if (!auth) {
        const err = { code: "auth_failed", message: "Authentication required" };
        cb ? cb(err) : socket.emit("career:error", err);
        return;
      }
      
      const user = getUserById(auth.userId);
      if (!user) {
        const err = { code: "user_not_found", message: "User not found" };
        cb ? cb(err) : socket.emit("career:error", err);
        return;
      }

      // Check if already in a room
      const currentRoom = getRoomBySocket(socket.id);
      if (currentRoom) {
        const err = { code: "already_in_room", message: "Already in a room" };
        cb ? cb(err) : socket.emit("career:error", err);
        return;
      }
      
      // Verify ante exists and player can access it
      const anteOption = getAnteOptionById(payload.anteId);
      if (!anteOption) {
        const err = { code: "invalid_ante", message: "Invalid ante option" };
        cb ? cb(err) : socket.emit("career:error", err);
        return;
      }
      
      // Check rating requirement
      if (!canAccessTier(user.rating, anteOption.tier.id)) {
        const err = { 
          code: "rating_too_low", 
          message: `Rating too low. Need ${anteOption.tier.minRating} rating for ${anteOption.tier.name}`,
          requiredRating: anteOption.tier.minRating,
          currentRating: user.rating,
        };
        cb ? cb(err) : socket.emit("career:error", err);
        return;
      }
      
      // Check bankroll
      if (!canAffordAnte(user.bankroll, payload.anteId)) {
        const err = { 
          code: "insufficient_bankroll", 
          message: `Not enough bankroll. Need ${anteOption.ante.buyIn} to join`,
          requiredBankroll: anteOption.ante.buyIn,
          currentBankroll: user.bankroll,
        };
        cb ? cb(err) : socket.emit("career:error", err);
        return;
      }

      // Refresh queue entry if already waiting (reconnect / second tab)
      if (isInQueue(user.id)) {
        const refreshEntry: QueueEntry = {
          playerId: user.id,
          playerName: user.username,
          rating: user.rating,
          trophies: user.trophies,
          socketId: socket.id,
          anteId: payload.anteId,
          queuedAt: Date.now(),
        };
        const result = joinQueue(refreshEntry);
        const response = {
          inQueue: true,
          position: result.position,
          anteId: payload.anteId,
          tierId: anteOption.tier.id,
          message: "Searching for opponent...",
        };
        cb ? cb(null, response) : socket.emit("career:queueJoined", response);
        return;
      }
      
      // Create queue entry
      const queueEntry: QueueEntry = {
        playerId: user.id,
        playerName: user.username,
        rating: user.rating,
        trophies: user.trophies,
        socketId: socket.id,
        anteId: payload.anteId,
        queuedAt: Date.now(),
      };
      
      // Join the queue
      const result = joinQueue(queueEntry);
      
      console.log(`[Career] ${user.username} joined queue (position ${result.position})`);
      
      const response = {
        inQueue: true,
        position: result.position,
        anteId: payload.anteId,
        tierId: anteOption.tier.id,
        message: "Searching for opponent...",
      };
      
      cb ? cb(null, response) : socket.emit("career:queueJoined", response);
    } catch (e: any) {
      const err = { code: "error", message: e.message };
      cb ? cb(err) : socket.emit("career:error", err);
    }
  });

  /**
   * Leave matchmaking queue
   */
  socket.on("career:leaveQueue", (payload: { token: string }, cb?: (err: any, data?: any) => void) => {
    try {
      const auth = authenticateSocket(socket, payload.token);
      if (!auth) {
        const err = { code: "auth_failed", message: "Authentication required" };
        cb ? cb(err) : socket.emit("career:error", err);
        return;
      }
      
      const removed = leaveQueue(auth.userId);
      
      if (removed) {
        console.log(`[Career] ${auth.username} left queue`);
        cb ? cb(null, { success: true }) : socket.emit("career:queueLeft", { success: true });
      } else {
        const err = { code: "not_in_queue", message: "Not in matchmaking queue" };
        cb ? cb(err) : socket.emit("career:error", err);
      }
    } catch (e: any) {
      const err = { code: "error", message: e.message };
      cb ? cb(err) : socket.emit("career:error", err);
    }
  });

  /**
   * Get current queue status
   */
  socket.on("career:getQueueStatus", (payload: { token: string }, cb?: (err: any, data?: any) => void) => {
    try {
      const auth = authenticateSocket(socket, payload.token);
      if (!auth) {
        const err = { code: "auth_failed", message: "Authentication required" };
        cb ? cb(err) : socket.emit("career:error", err);
        return;
      }
      
      const status = getQueueStatus(auth.userId);
      
      cb ? cb(null, status) : socket.emit("career:queueStatus", status);
    } catch (e: any) {
      const err = { code: "error", message: e.message };
      cb ? cb(err) : socket.emit("career:error", err);
    }
  });

  /**
   * Leave current waiting room
   */
  socket.on("career:leaveRoom", (payload: { token: string }, cb?: (err: any, data?: any) => void) => {
    try {
      const currentRoom = getRoomBySocket(socket.id);
      if (!currentRoom) {
        const err = { code: "not_in_room", message: "Not in a career room" };
        cb ? cb(err) : socket.emit("career:error", err);
        return;
      }
      
      // Can only leave if room hasn't started
      if (currentRoom.status !== "waiting") {
        const err = { code: "game_in_progress", message: "Cannot leave after game started" };
        cb ? cb(err) : socket.emit("career:error", err);
        return;
      }
      
      socket.leave(currentRoom.id);
      leaveCareerRoom(socket.id, io);
      
      cb ? cb(null, { success: true }) : socket.emit("career:left", { roomId: currentRoom.id });
    } catch (e: any) {
      const err = { code: "error", message: e.message };
      cb ? cb(err) : socket.emit("career:error", err);
    }
  });

  /**
   * Get current room info
   */
  socket.on("career:getRoomInfo", (payload: {}, cb?: (err: any, data?: any) => void) => {
    try {
      const currentRoom = getRoomBySocket(socket.id);
      if (!currentRoom) {
        cb ? cb(null, { inRoom: false }) : socket.emit("career:roomInfo", { inRoom: false });
        return;
      }
      
      const response = {
        inRoom: true,
        roomId: currentRoom.id,
        tierId: currentRoom.tierId,
        anteId: currentRoom.anteId,
        ante: currentRoom.ante,
        minBet: currentRoom.minBet,
        maxBet: currentRoom.maxBet,
        players: currentRoom.players.map((p) => ({
          userId: p.userId,
          username: p.username,
          rating: p.rating,
          avatarEmoji: p.avatarEmoji,
          avatarColor: p.avatarColor,
          avatarBorder: p.avatarBorder,
        })),
        playerCount: currentRoom.players.length,
        maxPlayers: currentRoom.maxPlayers,
        status: currentRoom.status,
        autoStartAt: currentRoom.autoStartAt,
        secondsRemaining: currentRoom.autoStartAt 
          ? Math.max(0, Math.ceil((currentRoom.autoStartAt - Date.now()) / 1000))
          : null,
      };
      
      cb ? cb(null, response) : socket.emit("career:roomInfo", response);
    } catch (e: any) {
      const err = { code: "error", message: e.message };
      cb ? cb(err) : socket.emit("career:error", err);
    }
  });

  /**
   * Handle game starting event - DEPRECATED/REMOVED
   * Game creation is now handled automatically in triggerGameStart()
   * via careerRoomManager when the 30-second timer expires.
   */

  /**
   * Handle socket disconnect - clean up career room membership and queue
   */
  socket.on("disconnect", () => {
    const auth = authenticatedSockets.get(socket.id);
    if (auth) {
      // Remove from queue if present
      const removed = leaveQueue(auth.userId);
      if (removed) {
        console.log(`[Career] ${auth.username} removed from queue on disconnect`);
      }
    }
    
    authenticatedSockets.delete(socket.id);
    handleDisconnect(socket.id, io);
  });
}
