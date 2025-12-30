/**
 * Career Mode Socket Handlers
 * 
 * Handles all career-related socket events:
 * - career:getTiers - Get available tiers for player's rating
 * - career:joinAnte - Join/create a room for a specific ante
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
import { createRoomWithCreator, snapshot, getRoom, closeRoom, startRoom, handleIntent } from "../rooms.js";
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
   * Join a specific ante room (find existing or create new)
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
      
      // Create player object
      const player: CareerPlayer = {
        odlayerId: user.id,
        odlayerName: user.username,
        odlating: user.rating,
        odankroll: user.bankroll,
        odocketId: socket.id,
        userId: user.id,
        username: user.username,
        rating: user.rating,
        bankroll: user.bankroll,
        socketId: socket.id,
        avatarEmoji: user.avatarEmoji,
        avatarColor: user.avatarColor,
        avatarBorder: user.avatarBorder,
        joinedAt: Date.now(),
      };
      
      // Find or create room
      const result = findOrCreateRoom(payload.anteId, player, io);
      
      if (!result.success) {
        const err = { code: "join_failed", message: result.error };
        cb ? cb(err) : socket.emit("career:error", err);
        return;
      }
      
      // Join the socket room
      socket.join(result.room!.id);
      
      const response = {
        roomId: result.room!.id,
        tierId: result.room!.tierId,
        anteId: result.room!.anteId,
        ante: result.room!.ante,
        minBet: result.room!.minBet,
        maxBet: result.room!.maxBet,
        players: result.room!.players.map((p) => ({
          userId: p.userId,
          username: p.username,
          rating: p.rating,
          avatarEmoji: p.avatarEmoji,
          avatarColor: p.avatarColor,
          avatarBorder: p.avatarBorder,
        })),
        playerCount: result.room!.players.length,
        maxPlayers: result.room!.maxPlayers,
        status: result.room!.status,
        autoStartAt: result.room!.autoStartAt,
      };
      
      cb ? cb(null, response) : socket.emit("career:joined", response);
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
   * Handle game starting event - create actual game room
   */
  socket.on("career:gameStarting", (payload: { roomId: string; players: any[]; config: any }) => {
    const careerRoom = getCareerRoom(payload.roomId);
    if (!careerRoom) return;
    
    // Only the first player to receive this creates the game room
    if (careerRoom.gameRoomId) return;
    
    const gameRoomId = `game-${payload.roomId}`;
    
    // Create the actual game room using existing room system
    const gameConfig: TableConfig = {
      ...defaultConfig,
      ante: careerRoom.ante,
      minBetPolicy: { type: "fixed", value: careerRoom.minBet },
      maxPlayers: careerRoom.maxPlayers,
    };
    
    // Create room with first player as creator
    const firstPlayer = careerRoom.players[0];
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
    
    // Have first player's socket join the game room
    socket.join(gameRoomId);
    
    markRoomInGame(payload.roomId, gameRoomId);
    
    // Tell all players to transition to the game room
    io.to(payload.roomId).emit("career:transitionToGame", {
      careerRoomId: payload.roomId,
      gameRoomId,
      config: gameConfig,
    });
  });

  /**
   * Handle socket disconnect - clean up career room membership
   */
  socket.on("disconnect", () => {
    authenticatedSockets.delete(socket.id);
    handleDisconnect(socket.id, io);
  });
}
