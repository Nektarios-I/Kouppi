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
  createCareerRoom,
  joinCareerRoom,
  leaveCareerRoom,
  getRoomBySocket,
  getCareerRoom,
  getCareerRoomByUserId,
  rebindCareerPlayerSocket,
  getRoomsByAnte,
  getAllCareerRooms,
  handleDisconnect,
  buildCareerRoomUpdatePayload,
  markRoomInGame,
  markRoomFinished,
  setCareerPlayerReady,
  type CareerPlayer,
} from "./careerRoomManager.js";
import { getUserById } from "@kouppi/database";
import { verifyActiveAuthToken } from "../auth/verifyActiveAuth.js";
import { createRoomWithCreator, snapshot, getRoom, closeRoom, startRoom } from "../rooms.js";
import type { TableConfig } from "@kouppi/game-core";

// Store socket -> userId mapping for authenticated sockets
const authenticatedSockets = new Map<string, { userId: string; username: string }>();

/**
 * Authenticate a socket connection with JWT token
 */
function authenticateSocket(socket: Socket, token: string): { userId: string; username: string } | null {
  try {
    const payload = verifyActiveAuthToken(token);
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

    // Multiplayer-aligned: reclaim waiting/starting seat after reconnect
    let activeRoomId: string | null = null;
    let roomPayload: ReturnType<typeof buildCareerRoomUpdatePayload> | null = null;
    const existingRoom = getCareerRoomByUserId(user.id);
    if (existingRoom && (existingRoom.status === "waiting" || existingRoom.status === "starting")) {
      const rebound = rebindCareerPlayerSocket(existingRoom.id, user.id, socket.id, io, { socket });
      activeRoomId = existingRoom.id;
      if (rebound.room) {
        roomPayload = buildCareerRoomUpdatePayload(rebound.room);
      }
    }
    
    const response = {
      userId: user.id,
      username: user.username,
      rating: user.rating,
      trophies: user.trophies,
      bankroll: user.bankroll,
      avatarId: user.avatarId,
      roomId: activeRoomId,
      room: roomPayload,
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
        if (!isInQueue(user.id)) {
          cb?.(null, {
            inQueue: false,
            matched: true,
            anteId: payload.anteId,
            tierId: anteOption.tier.id,
            message: "Match found",
          });
          return;
        }
        const response = {
          inQueue: true,
          position: result.position,
          anteId: payload.anteId,
          tierId: anteOption.tier.id,
          message: "Searching for opponent...",
          ...getQueueStatus(user.id),
        };
        cb?.(null, response);
        socket.emit("career:queueJoined", response);
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
      
      // Join the queue (may match immediately and remove this player)
      const result = joinQueue(queueEntry);

      // Immediate match: do NOT claim still-in-queue (ACK would wipe client matchFound)
      if (!isInQueue(user.id)) {
        const matchedResponse = {
          inQueue: false,
          matched: true,
          anteId: payload.anteId,
          tierId: anteOption.tier.id,
          message: "Match found",
        };
        cb?.(null, matchedResponse);
        return;
      }
      
      console.log(`[Career] ${user.username} joined queue (position ${result.position})`);
      
      const response = {
        inQueue: true,
        position: result.position,
        anteId: payload.anteId,
        tierId: anteOption.tier.id,
        message: "Searching for opponent...",
        ...getQueueStatus(user.id),
      };
      
      cb?.(null, response);
      socket.emit("career:queueJoined", response);
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
        cb?.(null, { success: true });
        socket.emit("career:queueLeft", { success: true });
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
   * List waiting (not started) Career tables.
   * - With anteId: filter to that ante
   * - Without anteId: all waiting tables (browse/join anytime)
   * Never includes in-game / finished rooms.
   */
  socket.on(
    "career:listWaitingRooms",
    (
      payload: { token: string; anteId?: string },
      cb?: (err: unknown, data?: unknown) => void
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

        if (payload.anteId) {
          const anteOption = getAnteOptionById(payload.anteId);
          if (!anteOption) {
            const err = { code: "invalid_ante", message: "Invalid ante option" };
            cb ? cb(err) : socket.emit("career:error", err);
            return;
          }
        }

        const source = payload.anteId
          ? getRoomsByAnte(payload.anteId)
          : getAllCareerRooms().filter((room) => room.status === "waiting");

        const rooms = source.map((room) => {
          const option = getAnteOptionById(room.anteId);
          return {
            roomId: room.id,
            tierId: room.tierId,
            tierName: option?.tier.name ?? room.tierId,
            tierEmoji: option?.tier.emoji ?? "♠",
            anteId: room.anteId,
            ante: room.ante,
            anteLabel: option?.ante.label ?? `Ante ${room.ante}`,
            buyIn: room.buyIn,
            minBet: room.minBet,
            maxBet: room.maxBet,
            playerCount: room.players.length,
            maxPlayers: room.maxPlayers,
            status: room.status,
            canJoin:
              room.status === "waiting" &&
              room.players.length < room.maxPlayers &&
              canAccessTier(user.rating, room.tierId) &&
              user.bankroll >= room.buyIn,
            seatsOpen: Math.max(0, room.maxPlayers - room.players.length),
          };
        });

        const response = { anteId: payload.anteId ?? null, rooms };
        cb?.(null, response);
        socket.emit("career:waitingRooms", response);
      } catch (e: unknown) {
        const err = { code: "error", message: e instanceof Error ? e.message : "error" };
        cb ? cb(err) : socket.emit("career:error", err);
      }
    }
  );

  /**
   * Create a Career waiting table and seat the caller (waiting status only).
   */
  socket.on(
    "career:createWaitingRoom",
    (payload: { token: string; anteId: string }, cb?: (err: unknown, data?: unknown) => void) => {
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
        const anteOption = getAnteOptionById(payload.anteId);
        if (!anteOption) {
          const err = { code: "invalid_ante", message: "Invalid ante option" };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }
        if (!canAccessTier(user.rating, anteOption.tier.id)) {
          const err = {
            code: "rating_too_low",
            message: `Rating too low. Need ${anteOption.tier.minRating} rating for ${anteOption.tier.name}`,
          };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }
        if (!canAffordAnte(user.bankroll, payload.anteId)) {
          const err = {
            code: "insufficient_bankroll",
            message: `Not enough bankroll. Need ${anteOption.ante.buyIn} to join`,
          };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }
        if (isInQueue(user.id)) {
          leaveQueue(user.id);
        }

        // Idempotent create: already seated in a waiting/starting Career table
        const existing =
          getRoomBySocket(socket.id) ??
          getCareerRoomByUserId(user.id);
        if (existing && (existing.status === "waiting" || existing.status === "starting")) {
          const rebound = rebindCareerPlayerSocket(existing.id, user.id, socket.id, io, {
            socket,
          });
          if (rebound.success && rebound.room) {
            cb?.(null, {
              success: true,
              roomId: rebound.room.id,
              room: buildCareerRoomUpdatePayload(rebound.room),
              idempotent: true,
            });
            return;
          }
        }

        if (getRoomBySocket(socket.id)) {
          const err = { code: "already_in_room", message: "Already in a room" };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }

        const room = createCareerRoom(payload.anteId);
        if (!room) {
          const err = { code: "create_failed", message: "Could not create waiting table" };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }

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
          avatarId: user.avatarId,
          joinedAt: Date.now(),
          ready: false,
        };
        const joined = joinCareerRoom(room.id, player, io, { socket });
        if (!joined.success || !joined.room) {
          const err = { code: "join_failed", message: joined.error ?? "Could not join waiting table" };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }
        cb?.(null, {
          success: true,
          roomId: joined.room.id,
          room: buildCareerRoomUpdatePayload(joined.room),
        });
      } catch (e: unknown) {
        const err = { code: "error", message: e instanceof Error ? e.message : "error" };
        cb ? cb(err) : socket.emit("career:error", err);
      }
    }
  );

  /**
   * Join an existing Career waiting table — rejects in-progress / full / ineligible.
   */
  socket.on(
    "career:joinWaitingRoom",
    (
      payload: { token: string; roomId: string },
      cb?: (err: unknown, data?: unknown) => void
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
        const target = getCareerRoom(payload.roomId);
        if (!target) {
          const err = { code: "room_not_found", message: "Waiting table not found" };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }
        if (target.status !== "waiting") {
          const err = {
            code: target.status === "starting" ? "countdown_in_progress" : "game_in_progress",
            message:
              target.status === "starting"
                ? "Cannot join while the pre-game countdown is running"
                : "Cannot join a Career game that has already started",
          };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }
        const anteOption = getAnteOptionById(target.anteId);
        if (!anteOption || !canAccessTier(user.rating, anteOption.tier.id)) {
          const err = { code: "rating_too_low", message: "Rating too low for this table" };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }
        if (user.bankroll < target.buyIn) {
          const err = { code: "insufficient_bankroll", message: "Not enough bankroll" };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }
        if (getRoomBySocket(socket.id)) {
          const err = { code: "already_in_room", message: "Already in a room" };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }
        if (isInQueue(user.id)) {
          leaveQueue(user.id);
        }

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
          avatarId: user.avatarId,
          joinedAt: Date.now(),
          ready: false,
        };
        const joined = joinCareerRoom(payload.roomId, player, io, { socket });
        if (!joined.success || !joined.room) {
          const err = {
            code: "join_failed",
            message: joined.error ?? "Could not join waiting table",
          };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }
        cb?.(null, {
          success: true,
          roomId: joined.room.id,
          room: buildCareerRoomUpdatePayload(joined.room),
        });
      } catch (e: unknown) {
        const err = { code: "error", message: e instanceof Error ? e.message : "error" };
        cb ? cb(err) : socket.emit("career:error", err);
      }
    }
  );

  /**
   * Explicit Ready toggle for Career waiting rooms.
   * Countdown starts only when the table is full and every player is Ready.
   */
  socket.on(
    "career:setReady",
    (
      payload: { token: string; ready: boolean },
      cb?: (err: unknown, data?: unknown) => void
    ) => {
      try {
        const auth = authenticateSocket(socket, payload.token);
        if (!auth) {
          const err = { code: "auth_failed", message: "Authentication required" };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }
        const result = setCareerPlayerReady(socket.id, !!payload.ready, io);
        if (!result.success || !result.room) {
          const err = { code: "ready_failed", message: result.error ?? "Could not update ready" };
          cb ? cb(err) : socket.emit("career:error", err);
          return;
        }
        cb?.(null, {
          success: true,
          ready: !!payload.ready,
          room: buildCareerRoomUpdatePayload(result.room),
        });
      } catch (e: unknown) {
        const err = { code: "error", message: e instanceof Error ? e.message : "error" };
        cb ? cb(err) : socket.emit("career:error", err);
      }
    }
  );

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
      
      // Can only leave if room hasn't started playing
      if (currentRoom.status === "in-game" || currentRoom.status === "finished") {
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
          avatarId: p.avatarId,
          ready: !!p.ready,
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
   * Game creation is handled automatically in triggerGameStart()
   * via careerRoomManager when the Ready countdown expires.
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
