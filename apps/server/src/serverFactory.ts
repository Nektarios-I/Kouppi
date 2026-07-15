import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { CreateRoomPayload, JoinRoomPayload, ClientIntent, StartRoomPayload, JoinAsSpectatorPayload } from "@kouppi/protocol";
import { 
  createRoomWithCreator, joinRoom, leaveRoom, closeRoom, handleClientIntent, applySystemIntent, snapshot, getRoom, roomsInfo, startRoom,
  startTurnTimer, clearTurnTimer, getTurnTimerInfo, resetAfkCount, incrementAfkCount, shouldKickForAfk,
  startFirstTurn, getCurrentPlayerId, syncGamePlayersToRoom, findPlayerBySocket, promoteHost,
  beginDisconnectGrace, cancelDisconnectGrace, RECONNECT_GRACE_MS,
  beginSpectatorDisconnectGrace, cancelSpectatorDisconnectGrace, removeSpectator,
  addChatMessage, getChatMessages, clearChatMessages, cleanupEmptyRooms,
  resolveRoomIdentifier, buildRoomUpdatePayload, buildStatePayload, bumpStateRevision, bumpRoomRevision, setPlayerReady, kickPlayer, transferHost,
  banPlayerFromRoom, setRoomChatMuted, setPlayerChatMuted, isChatSendBlocked, isPlayerBanned,
  startGraceTickBroadcast, stopGraceTickBroadcast, generateRoomCode,
  addSystemChatMessage, checkChatRateLimit, recordChatSend,
} from "./rooms.js";
import type { TableConfig } from "@kouppi/game-core";
import { applyAction } from "@kouppi/game-core";

// Career Mode imports
import { getDatabase, cleanupExpiredSessions } from "@kouppi/database";
import { authRoutes } from "./auth/index.js";
import profileRoutes, { leaderboardRouter, matchesRouter } from "./career/profileRoutes.js";
import { registerCareerHandlers } from "./career/careerSocketHandlers.js";
import { isCareerGame, handleCareerGameEnd, getCareerRoomByGameId } from "./career/careerRoomManager.js";
import { verifyRoomPassword, roomRequiresPassword } from "./security/password.js";
import { sanitizeDisplayName, sanitizeChatText, sanitizeEmote } from "./security/sanitize.js";
import { checkEventRateLimit, recordEvent } from "./security/rateLimit.js";
import { logServerEvent } from "./security/log.js";

export function createKouppiServer(opts?: {
  corsOrigin?: string;
  config?: TableConfig;
  /** Skip career database init (used in tests). */
  skipCareerDatabase?: boolean;
  /** Force websocket-only transport (defaults to true when NODE_ENV=production). */
  websocketOnly?: boolean;
}) {
  // Initialize database for Career Mode
  if (!opts?.skipCareerDatabase) {
    try {
      getDatabase();
      console.log("[Career Mode] Database initialized");

      // Cleanup expired sessions periodically (every hour)
      setInterval(() => {
        const cleaned = cleanupExpiredSessions();
        if (cleaned > 0) {
          console.log(`[Career Mode] Cleaned ${cleaned} expired session(s)`);
        }
      }, 60 * 60 * 1000);
    } catch (error) {
      console.error("[Career Mode] Failed to initialize database:", error);
      // Continue without Career Mode if DB fails
    }
  }

  const app = express();
  app.use(cors({ origin: opts?.corsOrigin ?? "*" }));
  app.use(express.json()); // Parse JSON request bodies for API routes

  // Root route so visiting http://localhost:4000 doesn't look broken.
  app.get("/", (_req, res) => {
    res
      .status(200)
      .type("text/plain")
      .send("KOUPPI multiplayer server is running. Try GET /health or connect via Socket.IO.");
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      uptimeSec: Math.floor(process.uptime()),
      rooms: roomsInfo().length,
      ts: new Date().toISOString(),
    });
  });

  // Career Mode API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/leaderboard", leaderboardRouter);
  app.use("/api/matches", matchesRouter);

  const httpServer = createServer(app);
  const websocketOnly = opts?.websocketOnly ?? process.env.NODE_ENV === "production";
  const io = new Server(httpServer, {
    cors: { origin: opts?.corsOrigin ?? "*" },
    transports: websocketOnly ? ["websocket"] : ["websocket", "polling"],
  });

  app.get("/health/ready", (_req, res) => {
    res.json({
      ok: true,
      uptimeSec: Math.floor(process.uptime()),
      rooms: roomsInfo().length,
      connections: io.engine.clientsCount,
      transport: websocketOnly ? "websocket" : "websocket,polling",
      ts: new Date().toISOString(),
    });
  });

  const defaultConfig: TableConfig =
    opts?.config ??
    ({
      ante: 10,
      startingBankroll: 100,
      minBetPolicy: { type: "fixed", value: 10 },
      shistri: { enabled: true, percent: 5, minChip: 1 },
      maxPlayers: 8,
      deckPolicy: "single_no_reshuffle_until_empty",
      allowKouppi: true,
      spectatorsAllowed: false,
      language: "en",
    } satisfies TableConfig);

  const DECISION_TIMEOUT_SEC = 30;
  
  // Periodic cleanup of empty rooms (every 30 seconds)
  const cleanupInterval = setInterval(() => {
    const cleaned = cleanupEmptyRooms();
    if (cleaned > 0) {
      console.log(`[Cleanup] Removed ${cleaned} empty room(s)`);
    }
  }, 30000);

  io.on("connection", (socket) => {
    logServerEvent("socket_connect", { socketId: socket.id });

    function checkRateLimit(
      event: string,
      maxPerMinute: number,
      minIntervalMs = 0,
      cb?: (err: any | null) => void
    ): boolean {
      const rate = checkEventRateLimit(socket.id, event, maxPerMinute, minIntervalMs);
      if (!rate.allowed) {
        const err = {
          code: "rate_limited",
          message: `Too many ${event} requests — wait ${Math.ceil((rate.retryAfterMs || 1000) / 1000)}s`,
        };
        cb ? cb(err) : socket.emit("error", err);
        return false;
      }
      return true;
    }

    function markRateLimit(event: string): void {
      recordEvent(socket.id, event);
    }

    function verifyPrivateRoomAccess(
      room: NonNullable<ReturnType<typeof getRoom>>,
      password: string | undefined,
      cb?: (err: any | null) => void
    ): boolean {
      if (!roomRequiresPassword(room)) return true;
      if (!password || !room.passwordHash || !verifyRoomPassword(password, room.passwordHash)) {
        const err = { code: "wrong_password", message: "Incorrect password" };
        cb ? cb(err) : socket.emit("error", err);
        return false;
      }
      return true;
    }

    // Register Career Mode socket handlers
    registerCareerHandlers(io, socket, defaultConfig);

    /**
     * Helper to close a room and handle career game end if applicable.
     * Call this instead of closeRoom() directly when a game ends.
     */
    function closeRoomWithCareerTracking(roomId: string) {
      // Check if this is a career game that needs end processing
      if (isCareerGame(roomId)) {
        const room = getRoom(roomId);
        if (room && room.state) {
          // Extract player results from game state
          const playerResults = room.state.players.map((player: any) => {
            // Find original player to get userId
            const roomPlayer = room.players.find((p: any) => p.id === player.id);
            return {
              odlayerId: player.id,
              odlayerName: player.name,
              userId: roomPlayer?.id || player.id,
              finalBankroll: player.bankroll || 0,
              chipsWon: (player.bankroll || 0) - (room.config?.startingBankroll || 100),
              handsWon: player.handsWon || 0,
              handsPlayed: player.handsPlayed || 0,
            };
          });
          
          // Process career game results
          handleCareerGameEnd(roomId, playerResults, io);
        }
      }
      
      // Actually close the room
      closeRoom(roomId);
    }

    function emitRoomUpdate(roomId: string) {
      const room = getRoom(roomId);
      if (!room) return;
      io.to(roomId).emit("roomUpdate", buildRoomUpdatePayload(room));
    }

    function emitState(roomId: string, targetSocket?: import("socket.io").Socket) {
      const room = getRoom(roomId);
      if (!room) return;
      const payload = buildStatePayload(room);
      if (!payload) return;
      if (targetSocket) targetSocket.emit("state", payload);
      else io.to(roomId).emit("state", payload);
    }

    function emitSystemMessage(roomId: string, message: string) {
      const msg = addSystemChatMessage(roomId, message);
      if (msg) io.to(roomId).emit("chatMessage", msg);
    }

    function buildRoomData(room: NonNullable<ReturnType<typeof getRoom>>) {
      return buildRoomUpdatePayload(room);
    }

    /** Remove player, promote host if needed, sync state, or close empty room. */
    function finalizePlayerRemoval(roomId: string, removedPlayerId?: string): boolean {
      const room = getRoom(roomId);
      if (!room) return true;

      if (removedPlayerId) {
        const removed = room.players.find((p) => p.id === removedPlayerId);
        cancelDisconnectGrace(removed);
      }

      if (room.players.length === 0) {
        io.to(roomId).emit("roomClosed", { reason: "empty" });
        closeRoomWithCareerTracking(roomId);
        return true;
      }

      promoteHost(room);

      try {
        syncGamePlayersToRoom(roomId);
      } catch {}

      if (room.state && room.state.phase === "Round" && room.state.players.length <= 1) {
        try {
          if (room.state.players.length === 1) {
            const winner = room.state.players[0];
            winner.bankroll += room.state.round.pot;
            room.state.history.push(`${winner.name} wins the pot (${room.state.round.pot}) - all other players left`);
            room.state.round.pot = 0;
          }
          room.state.turn = null;
          room.state.phase = "RoundEnd" as any;
          room.state.history.push("Round ended - not enough players");
        } catch {}
      }

      if (room.state?.phase === "RoundEnd" && !room.decision?.active) {
        handleRoundEnd(roomId);
      }

      try {
        if (room.state && room.state.phase === "Round" && !room.state.turn && !room.state.awaitNext && room.state.players.length > 1) {
          startEligibleTurn(roomId);
        }
      } catch {}

      const snap = snapshot(roomId);
      if (snap) emitState(roomId);
      io.to(roomId).emit("roomUpdate", buildRoomData(room));
      return false;
    }

    /**
     * Update bankroll for all players in a career game after each action.
     * This ensures real-time balance tracking for career mode.
     */
    function updateCareerBankrolls(roomId: string, room: any) {
      if (!room.state || !room.state.players) return;
      
      import("@kouppi/database").then(({ updateBankroll }) => {
        for (const player of room.state.players) {
          try {
            // Update bankroll in database
            updateBankroll(player.id, player.bankroll || 0);
          } catch (error) {
            console.error(`[Career] Failed to update bankroll for ${player.id}:`, error);
          }
        }
      }).catch(error => {
        console.error("[Career] Failed to import database module:", error);
      });
    }

    // createRoom with creator + config (ack)
    socket.on("createRoom", (payload, cb?: (err: any|null, snapshot?: any, roomData?: any) => void) => {
      try {
        if (!checkRateLimit("createRoom", 8, 2000, cb)) return;
        const data = CreateRoomPayload.parse(payload);
        const publicCode = data.code ? data.code.trim().toUpperCase() : undefined;
        const roomId = data.roomId?.trim() || publicCode || generateRoomCode();
        if (getRoom(roomId)) {
          const err = { code: "room_exists", message: "Room exists" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        const cfg: TableConfig = { ...defaultConfig, ...(data.config as any) };
        const creatorName = sanitizeDisplayName(data.creator.name);
        if (!creatorName) {
          const err = { code: "inappropriate_name", message: "That name is not allowed" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        const creator = { id: data.creator.id, name: creatorName, socketId: socket.id, avatar: data.creator.avatar };
        createRoomWithCreator(roomId, creator, cfg as any, Math.floor(Math.random() * 1e9), data.password, publicCode);
        socket.join(roomId);
        const room = getRoom(roomId)!;
        const ackSnap = snapshot(roomId) ?? null;
        const roomData = buildRoomData(room);
        logServerEvent("room_created", { roomId, code: room.code, socketId: socket.id });
        markRateLimit("createRoom");
        cb ? cb(null, ackSnap, roomData) : socket.emit("state", ackSnap);
      } catch (e: any) {
        const err = { code: "bad_request", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });

    // joinRoom with ack
    socket.on("joinRoom", (payload, cb?: (err: any|null, snapshot?: any, roomData?: any) => void) => {
      try {
        if (!checkRateLimit("joinRoom", 30, 300, cb)) return;
        const data = JoinRoomPayload.parse(payload);
        
        const resolvedId = resolveRoomIdentifier(data.roomId);
        const existingRoom = resolvedId ? getRoom(resolvedId) : undefined;
        if (!existingRoom) {
          const err = { code: "room_not_found", message: "Room not found" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }

        if (!verifyPrivateRoomAccess(existingRoom, data.password, cb)) return;

        const playerName = sanitizeDisplayName(data.player.name);
        if (!playerName) {
          const err = { code: "inappropriate_name", message: "That name is not allowed" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        try {
          joinRoom(data.roomId, { id: data.player.id, name: playerName, socketId: socket.id, avatar: data.player.avatar });
        } catch (err: any) {
          const msg = err?.message || String(err);
          const code =
            msg === "room_full" ? "room_full"
            : msg === "game_in_progress" ? "game_in_progress"
            : msg === "room_not_found" ? "room_not_found"
            : msg === "slot_taken" ? "slot_taken"
            : msg === "player_banned" ? "player_banned"
            : "bad_request";
          const e2 = { code, message: msg };
          cb ? cb(e2) : socket.emit("error", e2);
          return;
        }
        socket.join(resolvedId!);
        const room = getRoom(resolvedId!)!;
        const snap = snapshot(resolvedId!);
        const ackSnap = snap ?? null;
        const roomData = buildRoomData(room);
        io.to(resolvedId!).emit("roomUpdate", roomData);
        if (snap) {
          io.to(resolvedId!).emit("state", snap);
        }
        emitSystemMessage(resolvedId!, `${playerName} joined the room`);
        markRateLimit("joinRoom");
        cb ? cb(null, ackSnap, roomData) : socket.emit("state", ackSnap);
      } catch (e: any) {
        const err = { code: "bad_request", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });

    socket.on("setReady", (payload: { roomId: string; ready: boolean }, cb?: (err: any|null, roomData?: any) => void) => {
      try {
        const resolvedId = resolveRoomIdentifier(payload.roomId);
        if (!resolvedId) {
          cb?.({ code: "room_not_found", message: "Room not found" });
          return;
        }
        const room = getRoom(resolvedId)!;
        const sessionPlayer = findPlayerBySocket(room, socket.id);
        if (!sessionPlayer) {
          cb?.({ code: "not_in_room", message: "Not in room" });
          return;
        }
        setPlayerReady(resolvedId, sessionPlayer.id, !!payload.ready);
        const roomData = buildRoomData(getRoom(resolvedId)!);
        io.to(resolvedId).emit("roomUpdate", roomData);
        cb?.(null, roomData);
      } catch (e: any) {
        const code = e?.message === "game_in_progress" ? "game_in_progress" : "bad_request";
        cb?.({ code, message: e?.message || String(e) });
      }
    });

    socket.on("kickPlayer", (payload: { roomId: string; targetId: string }, cb?: (err: any|null) => void) => {
      try {
        const resolvedId = resolveRoomIdentifier(payload.roomId);
        if (!resolvedId) {
          cb?.({ code: "room_not_found", message: "Room not found" });
          return;
        }
        const room = getRoom(resolvedId)!;
        const sessionPlayer = findPlayerBySocket(room, socket.id);
        if (!sessionPlayer) {
          cb?.({ code: "not_in_room", message: "Not in room" });
          return;
        }
        const target = room.players.find((p) => p.id === payload.targetId);
        const targetName = target?.name || "Player";
        const targetSocketId = target?.socketId;
        kickPlayer(resolvedId, sessionPlayer.id, payload.targetId);
        if (targetSocketId) {
          const kickedSocket = io.sockets.sockets.get(targetSocketId);
          kickedSocket?.emit("playerKicked", { playerId: payload.targetId, reason: "kicked_by_host" });
          kickedSocket?.leave(resolvedId);
        }
        emitSystemMessage(resolvedId, `${targetName} was removed by the host`);
        const closed = finalizePlayerRemoval(resolvedId);
        if (!closed) {
          emitRoomUpdate(resolvedId);
        }
        cb?.(null);
      } catch (e: any) {
        const code =
          e?.message === "not_host" ? "not_host"
          : e?.message === "game_in_progress" ? "game_in_progress"
          : e?.message === "cannot_kick_self" ? "cannot_kick_self"
          : e?.message === "cannot_kick_current_player" ? "cannot_kick_current_player"
          : "bad_request";
        cb?.({ code, message: e?.message || String(e) });
      }
    });

    socket.on("transferHost", (payload: { roomId: string; targetId: string }, cb?: (err: any|null, roomData?: any) => void) => {
      try {
        const resolvedId = resolveRoomIdentifier(payload.roomId);
        if (!resolvedId) {
          cb?.({ code: "room_not_found", message: "Room not found" });
          return;
        }
        const room = getRoom(resolvedId)!;
        const sessionPlayer = findPlayerBySocket(room, socket.id);
        if (!sessionPlayer) {
          cb?.({ code: "not_in_room", message: "Not in room" });
          return;
        }
        const newHost = room.players.find((p) => p.id === payload.targetId);
        transferHost(resolvedId, sessionPlayer.id, payload.targetId);
        emitSystemMessage(resolvedId, `${newHost?.name || "Player"} is now the host`);
        const roomData = buildRoomData(getRoom(resolvedId)!);
        io.to(resolvedId).emit("roomUpdate", roomData);
        cb?.(null, roomData);
      } catch (e: any) {
        const code =
          e?.message === "not_host" ? "not_host"
          : e?.message === "already_host" ? "already_host"
          : e?.message === "player_not_found" ? "player_not_found"
          : "bad_request";
        cb?.({ code, message: e?.message || String(e) });
      }
    });

    socket.on("closeRoomAsHost", (payload: { roomId: string }, cb?: (err: any|null) => void) => {
      try {
        const resolvedId = resolveRoomIdentifier(payload.roomId);
        if (!resolvedId) {
          cb?.({ code: "room_not_found", message: "Room not found" });
          return;
        }
        const room = getRoom(resolvedId)!;
        const sessionPlayer = findPlayerBySocket(room, socket.id);
        if (!sessionPlayer) {
          cb?.({ code: "not_in_room", message: "Not in room" });
          return;
        }
        if (room.hostId !== sessionPlayer.id) {
          cb?.({ code: "not_host", message: "not_host" });
          return;
        }
        emitSystemMessage(resolvedId, "The host closed the room");
        io.to(resolvedId).emit("roomClosed", { reason: "host_closed" });
        closeRoomWithCareerTracking(resolvedId);
        cb?.(null);
      } catch (e: any) {
        cb?.({ code: "bad_request", message: e?.message || String(e) });
      }
    });

    socket.on("banPlayer", (payload: { roomId: string; targetId: string }, cb?: (err: any|null) => void) => {
      try {
        const resolvedId = resolveRoomIdentifier(payload.roomId);
        if (!resolvedId) {
          cb?.({ code: "room_not_found", message: "Room not found" });
          return;
        }
        const room = getRoom(resolvedId)!;
        const sessionPlayer = findPlayerBySocket(room, socket.id);
        if (!sessionPlayer) {
          cb?.({ code: "not_in_room", message: "Not in room" });
          return;
        }
        const target = room.players.find((p) => p.id === payload.targetId);
        const targetName = target?.name || "Player";
        const targetSocketId = target?.socketId;
        banPlayerFromRoom(resolvedId, sessionPlayer.id, payload.targetId);
        logServerEvent("player_banned", {
          roomId: resolvedId,
          hostId: sessionPlayer.id,
          targetId: payload.targetId,
        });
        if (targetSocketId) {
          const bannedSocket = io.sockets.sockets.get(targetSocketId);
          bannedSocket?.emit("playerKicked", { playerId: payload.targetId, reason: "banned_by_host" });
          bannedSocket?.leave(resolvedId);
        }
        emitSystemMessage(resolvedId, `${targetName} was banned by the host`);
        const closed = finalizePlayerRemoval(resolvedId);
        if (!closed) emitRoomUpdate(resolvedId);
        cb?.(null);
      } catch (e: any) {
        const code =
          e?.message === "not_host" ? "not_host"
          : e?.message === "cannot_kick_self" ? "cannot_kick_self"
          : e?.message === "player_not_found" ? "player_not_found"
          : "ban_failed";
        cb?.({ code, message: e?.message || String(e) });
      }
    });

    socket.on("setRoomChatMuted", (payload: { roomId: string; muted: boolean }, cb?: (err: any|null, roomData?: any) => void) => {
      try {
        const resolvedId = resolveRoomIdentifier(payload.roomId);
        if (!resolvedId) {
          cb?.({ code: "room_not_found", message: "Room not found" });
          return;
        }
        const room = getRoom(resolvedId)!;
        const sessionPlayer = findPlayerBySocket(room, socket.id);
        if (!sessionPlayer) {
          cb?.({ code: "not_in_room", message: "Not in room" });
          return;
        }
        setRoomChatMuted(resolvedId, sessionPlayer.id, !!payload.muted);
        emitSystemMessage(resolvedId, payload.muted ? "The host muted chat for everyone" : "The host unmuted chat");
        const roomData = buildRoomData(getRoom(resolvedId)!);
        io.to(resolvedId).emit("roomUpdate", roomData);
        cb?.(null, roomData);
      } catch (e: any) {
        cb?.({ code: e?.message === "not_host" ? "not_host" : "bad_request", message: e?.message || String(e) });
      }
    });

    socket.on("mutePlayerChat", (payload: { roomId: string; targetId: string; muted: boolean }, cb?: (err: any|null, roomData?: any) => void) => {
      try {
        const resolvedId = resolveRoomIdentifier(payload.roomId);
        if (!resolvedId) {
          cb?.({ code: "room_not_found", message: "Room not found" });
          return;
        }
        const room = getRoom(resolvedId)!;
        const sessionPlayer = findPlayerBySocket(room, socket.id);
        if (!sessionPlayer) {
          cb?.({ code: "not_in_room", message: "Not in room" });
          return;
        }
        const target = room.players.find((p) => p.id === payload.targetId);
        setPlayerChatMuted(resolvedId, sessionPlayer.id, payload.targetId, !!payload.muted);
        if (target) {
          emitSystemMessage(
            resolvedId,
            payload.muted ? `${target.name}'s chat was muted by the host` : `${target.name}'s chat was unmuted`
          );
        }
        const roomData = buildRoomData(getRoom(resolvedId)!);
        io.to(resolvedId).emit("roomUpdate", roomData);
        cb?.(null, roomData);
      } catch (e: any) {
        cb?.({ code: e?.message === "not_host" ? "not_host" : "bad_request", message: e?.message || String(e) });
      }
    });

    socket.on(
      "reportPlayer",
      (payload: { roomId: string; targetId: string; reason: string; details?: string }, cb?: (err: any|null) => void) => {
        try {
          const resolvedId = resolveRoomIdentifier(payload.roomId);
          if (!resolvedId) {
            cb?.({ code: "room_not_found", message: "Room not found" });
            return;
          }
          const room = getRoom(resolvedId)!;
          const reporter = findPlayerBySocket(room, socket.id);
          if (!reporter) {
            cb?.({ code: "not_in_room", message: "Not in room" });
            return;
          }
          const target =
            room.players.find((p) => p.id === payload.targetId) ||
            room.spectators?.find((s) => s.id === payload.targetId);
          const validReasons = new Set(["harassment", "spam", "inappropriate", "cheating", "other"]);
          if (!validReasons.has(payload.reason)) {
            cb?.({ code: "bad_request", message: "Invalid report reason" });
            return;
          }
          logServerEvent("player_reported", {
            roomId: resolvedId,
            reporterId: reporter.id,
            reporterName: reporter.name,
            targetId: payload.targetId,
            targetName: target?.name || "unknown",
            reason: payload.reason,
            details: payload.details?.slice(0, 200) || null,
          });
          cb?.(null);
        } catch (e: any) {
          cb?.({ code: "report_failed", message: e?.message || String(e) });
        }
      }
    );

    // Subscribe to career room - player already added server-side during game start
    socket.on("subscribeCareerRoom", (
      payload: { roomId: string; playerId: string; playerName: string; avatar?: any },
      cb?: (err: any|null, snapshot?: any, roomData?: any) => void
    ) => {
      try {
        const { roomId, playerId, playerName, avatar } = payload;
        
        // Check if room exists
        const room = getRoom(roomId);
        if (!room) {
          const err = { code: "room_not_found", message: "Room not found" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Verify this is a career game room
        if (!isCareerGame(roomId)) {
          const err = { code: "not_career_room", message: "Not a career game room" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Verify player is already in the room
        const existingPlayer = room.players.find((p: any) => p.id === playerId);
        if (!existingPlayer) {
          const err = { code: "not_in_room", message: "Player not found in room" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Update the player's socket ID (they've reconnected with a new socket)
        existingPlayer.socketId = socket.id;
        
        // Join the socket room
        socket.join(roomId);
        
        // Get game state snapshot
        const snap = snapshot(roomId);
        const roomData = {
          players: room.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
          spectators: room.spectators?.map((s: any) => ({ id: s.id, name: s.name, avatar: s.avatar })) || [],
          hostId: room.hostId,
        };
        
        console.log(`[Career] Player ${playerName} (${playerId}) subscribed to room ${roomId}`);
        
        cb ? cb(null, snap, roomData) : socket.emit("state", snap);
      } catch (e: any) {
        const err = { code: "bad_request", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });

    socket.on("intent", ({ roomId, intent }, cb?: (err: any|null, snapshot?: any) => void) => {
      try {
        if (!checkRateLimit("intent", 120, 100, cb)) return;
        const room = getRoom(roomId);
        if (!room) {
          const err = { code: "room_not_found", message: "Room not found" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }

        const sessionPlayer = findPlayerBySocket(room, socket.id);
        if (!sessionPlayer) {
          const err = { code: "not_in_room", message: "Not a player in this room" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }

        const i = ClientIntent.parse(intent) as any;
        const playerId = sessionPlayer.id;

        // If this is a player action (not a system action), reset their AFK count
        const playerActions = ["pass", "bet", "kouppi", "shistri"];
        if (playerActions.includes(i.type)) {
          resetAfkCount(roomId, playerId);
          clearTurnTimer(roomId);
          clearTimerInterval(roomId);
          clearFlowTimer(roomId);
        }

        handleClientIntent(roomId, playerId, i);
        emitState(roomId);
        const updated = getRoom(roomId);
        const ackState = updated ? buildStatePayload(updated) : undefined;
        markRateLimit("intent");
        cb ? cb(null, ackState) : (ackState ? socket.emit("state", ackState) : undefined);
        
        // For career games, update bankroll in database after each action
        const r = getRoom(roomId);
        if (r && r.state && isCareerGame(roomId)) {
          updateCareerBankrolls(roomId, r);
        }
        
        // Handle game flow
        if (!r || !r.state) return;
        
        // If round ended
        if (r.state.phase === "RoundEnd") {
          handleRoundEnd(roomId);
          return;
        }
        
        // If awaiting next turn (after pass/bet), continue to next player after a short delay
        if (r.state.awaitNext) {
          scheduleFlowStep(roomId, 1500, () => {
            try {
              const room2 = getRoom(roomId);
              if (!room2 || !room2.state) return;

              room2.state = applySystemIntent(roomId, { type: "nextPlayer" }).state;
              startEligibleTurn(roomId);
            } catch (e) {
              console.error("Error in intent flow:", e);
            }
          });
          return;
        }
        
        // Robust guard: if we're in Round with no turn and not awaiting a result, start a turn.
        // This prevents a stuck state where no cards/actions are available.
        if (r.state.phase === "Round" && !r.state.turn && !r.state.awaitNext) {
          try {
            startEligibleTurn(roomId);
          } catch (e) {
            console.error("Error auto-starting turn:", e);
          }
        }
      } catch (e: any) {
        const err = { code: "intent_error", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });
    
    // Request new round (host only, after round end)
    socket.on("newRound", ({ roomId }, cb?: (err: any|null, snapshot?: any) => void) => {
      try {
        const room = getRoom(roomId);
        if (!room) throw new Error("room_not_found");

        const sessionPlayer = findPlayerBySocket(room, socket.id);
        if (!sessionPlayer) throw new Error("not_in_room");
        if (room.hostId !== sessionPlayer.id) throw new Error("not_host");
        if (!room.state || room.state.phase !== "RoundEnd") throw new Error("game_not_ended");
        
        // Start new round
        room.state = applySystemIntent(roomId, { type: "nextRound" }).state;
        room.state = applySystemIntent(roomId, { type: "ante" }).state;
        startEligibleTurn(roomId);
        
        // Reset all AFK counts
        room.players.forEach(p => p.afkCount = 0);
        
        const snap = snapshot(roomId);
        io.to(roomId).emit("state", snap);
        
        // Timer handled by startEligibleTurn
        
        cb ? cb(null, snap) : undefined;
      } catch (e: any) {
        const err = { code: "error", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });

    // Start room (host only)
    socket.on("startRoom", (payload, cb?: (err: any|null, snapshot?: any) => void) => {
      try {
        const data = StartRoomPayload.parse(payload);
        const room = getRoom(data.roomId);
        if (!room) {
          const err = { code: "room_not_found", message: "Room not found" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }

        const sessionPlayer = findPlayerBySocket(room, socket.id);
        if (!sessionPlayer) {
          const err = { code: "not_in_room", message: "Not a player in this room" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        if (room.hostId !== sessionPlayer.id) {
          const err = { code: "not_host", message: "not_host" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }

        startRoom(data.roomId, sessionPlayer.id);
        
        // Start the first turn with eligibility
        startEligibleTurn(data.roomId);
        
        emitSystemMessage(data.roomId, "Game started!");
        
        const updated = getRoom(data.roomId);
        const ackState = updated ? buildStatePayload(updated) : undefined;
        cb ? cb(null, ackState) : (ackState ? socket.emit("state", ackState) : undefined);
      } catch (e: any) {
        const code = e?.message === "not_host" ? "not_host" : e?.message === "not_enough_players" ? "not_enough_players" : e?.message === "not_all_ready" ? "not_all_ready" : "bad_request";
        const err = { code, message: e?.message || String(e) };
        cb ? cb(err) : socket.emit("error", err);
      }
    });
    
    // Helper function to start turn timer for a room
    function startTurnTimerForRoom(roomId: string) {
      const room = getRoom(roomId);
      if (!room || !room.state) return;

      clearTimerInterval(roomId);
      // Broadcast timer start
      const timerInfo = { 
        total: room.turnTimeout || 30, 
        remaining: room.turnTimeout || 30,
        currentPlayerId: getCurrentPlayerId(roomId),
      };
      io.to(roomId).emit("turnTimer", timerInfo);
      
      // Start the actual timer
      if (room.state.awaitNext || !room.state.turn?.upcards) {
        return;
      }
      startTurnTimer(roomId, () => {
        handleTurnTimeout(roomId);
      });
      
      // Send periodic timer updates
      const intervalId = setInterval(() => {
        const info = getTurnTimerInfo(roomId);
        if (!info || info.remaining <= 0) {
          clearInterval(intervalId);
          return;
        }
        io.to(roomId).emit("turnTimer", { 
          ...info, 
          currentPlayerId: getCurrentPlayerId(roomId) 
        });
      }, 1000);
      
      // Store interval ID so we can clear it later
      room.timerIntervalId = intervalId;
    }
    
    function clearFlowTimer(roomId: string) {
      const room = getRoom(roomId);
      if (room?.flowTimer) {
        clearTimeout(room.flowTimer);
        room.flowTimer = undefined;
      }
    }

    function scheduleFlowStep(roomId: string, delayMs: number, fn: () => void) {
      clearFlowTimer(roomId);
      const room = getRoom(roomId);
      if (!room) return;
      room.flowTimer = setTimeout(() => {
        room.flowTimer = undefined;
        fn();
      }, delayMs);
    }

    // Helper function to clear timer interval
    function clearTimerInterval(roomId: string) {
      const room = getRoom(roomId);
      if (room?.timerIntervalId) {
        clearInterval(room.timerIntervalId);
        room.timerIntervalId = undefined;
      }
    }

    // Centralized start turn with eligibility + bankrupt auto-pass handling
    function startEligibleTurn(roomId: string) {
      const room = getRoom(roomId);
      if (!room || !room.state) return;

      // If no players or no one with bankroll > 0, close room
      const hasEligible = room.state.players.some((p: any) => (p.bankroll ?? 0) > 0);
      if (!hasEligible || room.state.players.length === 0) {
        io.to(roomId).emit("roomClosed", { reason: !hasEligible ? "no_eligible_players" : "empty" });
        closeRoomWithCareerTracking(roomId);
        return;
      }

      // Start a turn
      applySystemIntent(roomId, { type: "startTurn" });
      emitState(roomId);

      // If round ended during startTurn, enter decision phase
      if (room.state.phase === "RoundEnd") {
        handleRoundEnd(roomId);
        return;
      }

      // If awaitNext became true (e.g., due to bankrupt auto-pass), advance automatically without starting timer
      if (room.state.awaitNext) {
        scheduleFlowStep(roomId, 800, () => {
          try {
            const r2 = getRoom(roomId);
            if (!r2 || !r2.state) return;
            r2.state = applySystemIntent(roomId, { type: "nextPlayer" }).state;
            startEligibleTurn(roomId);
          } catch (e) {
            console.error("Error advancing after auto-pass:", e);
          }
        });
        return;
      }

      // Otherwise start timer for the active player
      startTurnTimerForRoom(roomId);
    }
    
    // Handle turn timeout (player AFK)
    function handleTurnTimeout(roomId: string) {
      const room = getRoom(roomId);
      if (!room || !room.state) return;
      
      const currentPlayerId = getCurrentPlayerId(roomId);
      if (!currentPlayerId) return;
      
      // Clear timer interval
      clearTimerInterval(roomId);
      
      // Increment AFK count
      const afkCount = incrementAfkCount(roomId, currentPlayerId);
      
      // Notify about timeout
      io.to(roomId).emit("playerTimeout", { 
        playerId: currentPlayerId, 
        afkCount,
        kicked: shouldKickForAfk(roomId, currentPlayerId)
      });
      
      // Check if should kick
      if (shouldKickForAfk(roomId, currentPlayerId)) {
        leaveRoom(roomId, currentPlayerId);
        io.to(roomId).emit("playerKicked", { playerId: currentPlayerId, reason: "afk" });
        if (finalizePlayerRemoval(roomId, currentPlayerId)) {
          return;
        }
      }
      
      // Auto-pass for the timed-out player (if still in game)
      try {
        const roomAfterKick = getRoom(roomId);
        if (!roomAfterKick?.state) return;
        if (roomAfterKick.state.turn?.upcards) {
          applySystemIntent(roomId, { type: "pass" });
        }
        applySystemIntent(roomId, { type: "nextPlayer" });
        startEligibleTurn(roomId);
      } catch (e) {
        console.error("Error handling timeout:", e);
      }
    }
    
    // Handle round end -> start decision phase (stay/leave + refill)
    function handleRoundEnd(roomId: string) {
      const room = getRoom(roomId);
      if (!room || !room.state) return;

      clearTurnTimer(roomId);
      clearTimerInterval(roomId);

      // Initialize decision phase
      const now = Date.now();
      const deadline = now + DECISION_TIMEOUT_SEC * 1000;
      const choices: Record<string, "stay" | "leave" | null> = {};
      for (const p of room.players) choices[p.id] = null;
      // If an existing decision phase is running, clear timers
      if (room.decision?.timer) clearTimeout(room.decision.timer);
      if (room.decision?.interval) clearInterval(room.decision.interval);
      room.decision = { active: true, deadlineTs: deadline, choices, timer: null, interval: null };

      // Broadcast start of decision phase
      io.to(roomId).emit("roundDecisionStart", {
        deadlineTs: deadline,
        players: room.players.map(p => ({ id: p.id, name: p.name })),
        choices,
      });

      // Periodic updates
      room.decision.interval = setInterval(() => {
        const r = getRoom(roomId);
        if (!r || !r.decision?.active) {
          if (room.decision?.interval) clearInterval(room.decision.interval);
          return;
        }
        const remaining = Math.max(0, Math.ceil((r.decision.deadlineTs - Date.now()) / 1000));
        io.to(roomId).emit("roundDecisionUpdate", {
          remaining,
          choices: r.decision.choices,
        });
        if (remaining <= 0) {
          clearInterval(r.decision.interval);
        }
      }, 1000);

      // Deadline resolution
      room.decision.timer = setTimeout(() => {
        resolveDecisionPhase(roomId);
      }, DECISION_TIMEOUT_SEC * 1000);
    }

    // Record player decision and resolve early if all decided
    socket.on("roundDecision", ({ roomId, decision }: { roomId: string; decision: "stay"|"leave" }, cb?: (err: any|null) => void) => {
      try {
        const room = getRoom(roomId);
        if (!room || !room.decision?.active) return cb ? cb({ code: "no_decision_phase", message: "No active decision phase" }) : undefined;

        const sessionPlayer = findPlayerBySocket(room, socket.id);
        if (!sessionPlayer) return cb ? cb({ code: "not_in_room", message: "Not a player in this room" }) : undefined;

        const playerId = sessionPlayer.id;
        if (!(playerId in room.decision.choices)) return cb ? cb({ code: "not_in_room", message: "Player not in room" }) : undefined;
        // Ignore duplicate
        if (room.decision.choices[playerId] !== null) return cb ? cb(null) : undefined;

        room.decision.choices[playerId] = decision;

        // If player chose leave, remove immediately from room (and broadcast)
        if (decision === "leave") {
          leaveRoom(roomId, playerId);
          if (finalizePlayerRemoval(roomId, playerId)) {
            return cb ? cb(null) : undefined;
          }
        }

        // Broadcast update of choices
        io.to(roomId).emit("roundDecisionUpdate", {
          remaining: Math.max(0, Math.ceil(((room.decision.deadlineTs) - Date.now()) / 1000)),
          choices: room.decision.choices,
        });

        // Check if all decided (for remaining players)
        const undecided = room.players.some(p => room.decision!.choices[p.id] === null);
        if (!undecided) {
          resolveDecisionPhase(roomId);
        }
        cb ? cb(null) : undefined;
      } catch (e: any) {
        cb ? cb({ code: "error", message: e.message }) : undefined;
      }
    });

    function resolveDecisionPhase(roomId: string) {
      const room = getRoom(roomId);
      if (!room || !room.decision) return;

      // Determine who stays: players still in room (leave decisions already removed), and those whose choice === 'stay'
      const decision = room.decision;
      // Kick any remaining undecided players
      const remainingIds = new Set(room.players.map(p => p.id));
      for (const pid of Array.from(remainingIds)) {
        const ch = decision.choices[pid];
        if (ch === null) {
          leaveRoom(roomId, pid);
          io.to(roomId).emit("playerKicked", { playerId: pid, reason: "no_decision" });
          if (finalizePlayerRemoval(roomId, pid)) {
            if (room.decision?.timer) clearTimeout(room.decision.timer);
            if (room.decision?.interval) clearInterval(room.decision.interval);
            room.decision.active = false;
            return;
          }
        }
      }

      const roomAfterKicks = getRoom(roomId);
      if (!roomAfterKicks || !roomAfterKicks.decision) return;

      // Clean timers and mark inactive
      if (roomAfterKicks.decision.timer) clearTimeout(roomAfterKicks.decision.timer);
      if (roomAfterKicks.decision.interval) clearInterval(roomAfterKicks.decision.interval);
      roomAfterKicks.decision.active = false;

      // If fewer than 2 players remain, do not start a new round
      if (roomAfterKicks.players.length < 2) {
        io.to(roomId).emit("roundDecisionEnd", { started: false, reason: "not_enough_players" });
        return;
      }

      // Sync game state players to room players
      try {
        syncGamePlayersToRoom(roomId);
      } catch {}

      // Start the next round automatically: nextRound -> ante -> startTurn (via eligibility)
      try {
        if (roomAfterKicks.state) {
          applySystemIntent(roomId, { type: "nextRound" });
          applySystemIntent(roomId, { type: "ante" });
          startEligibleTurn(roomId);
          const snap = snapshot(roomId);
          io.to(roomId).emit("state", snap);
          io.to(roomId).emit("roundDecisionEnd", { started: true });
        }
      } catch (e) {
        console.error("Error starting next round after decision:", e);
      }
    }

    // Leave room
    socket.on("leaveRoom", ({ roomId }, cb?: (err: any|null) => void) => {
      try {
        const room = getRoom(roomId);
        if (!room) {
          cb ? cb(null) : undefined;
          return;
        }
        const leavingPlayer = room.players.find((p: any) => p.socketId === socket.id);
        if (!leavingPlayer) {
          cb ? cb(null) : undefined;
          return;
        }
        // Enforce leave rules: during Round with money in pot, players with bankroll > 0 cannot leave.
        // Players with zero bankroll may leave only if it's NOT their turn.
        const canLeaveNow = (() => {
          const st = room.state;
          if (!st) return true; // lobby or not started
          // If RoundEnd, free to leave
          if (st.phase === "RoundEnd") return true;
          if (st.phase !== "Round") return true;
          const pot = st.round?.pot ?? 0;
          if (pot <= 0) return true;
          // Pot > 0, only allow leave if player's bankroll == 0 and not current turn
          const gsPlayer = st.players.find((p: any) => p.id === leavingPlayer.id);
          const isCurrent = st.players[st.currentIndex]?.id === leavingPlayer.id;
          if ((gsPlayer?.bankroll ?? 0) <= 0 && !isCurrent) return true;
          return false;
        })();
        if (!canLeaveNow) {
          const err = { code: "cannot_leave", message: "Cannot leave during active round with money in pot unless bankrupt and not your turn" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        cancelDisconnectGrace(leavingPlayer);
        const leaveName = leavingPlayer.name;
        leaveRoom(roomId, leavingPlayer.id);
        socket.leave(roomId);
        emitSystemMessage(roomId, `${leaveName} left the room`);
        finalizePlayerRemoval(roomId, leavingPlayer.id);
        cb ? cb(null) : undefined;
      } catch (e: any) {
        console.error("leaveRoom error", e);
        cb ? cb({ code: "error", message: e.message }) : socket.emit("error", { code: "error", message: e.message });
      }
    });

    // Spectator: Join as spectator
    socket.on("joinAsSpectator", (payload, cb?: (err: any|null, snapshot?: any, roomData?: any) => void) => {
      try {
        if (!checkRateLimit("joinAsSpectator", 30, 300, cb)) return;
        const data = JoinAsSpectatorPayload.parse(payload);
        const resolvedId = resolveRoomIdentifier(data.roomId);
        const room = resolvedId ? getRoom(resolvedId) : undefined;
        const spectator = data.spectator;
        if (!room) {
          const err = { code: "room_not_found", message: "Room not found" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }

        if (!verifyPrivateRoomAccess(room, data.password, cb)) return;

        const spectatorName = sanitizeDisplayName(spectator.name);
        if (!spectatorName) {
          const err = { code: "inappropriate_name", message: "That name is not allowed" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }

        if (isPlayerBanned(room, spectator.id)) {
          const err = { code: "player_banned", message: "You are banned from this room" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Check if spectators are allowed
        if (!room.config.spectatorsAllowed) {
          const err = { code: "spectators_not_allowed", message: "Spectators are not allowed in this room" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Check if already a player
        if (room.players.some((p: any) => p.id === spectator.id)) {
          const err = { code: "already_player", message: "You are already a player in this room" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Check if already a spectator
        if (room.spectators?.some((s: any) => s.id === spectator.id)) {
          const existing = room.spectators!.find((s: any) => s.id === spectator.id)!;
          const hasActiveSocket =
            !!existing.socketId && existing.socketId !== socket.id && !existing.disconnectedAt;
          if (hasActiveSocket) {
            const err = { code: "slot_taken", message: "Spectator slot already active" };
            cb ? cb(err) : socket.emit("error", err);
            return;
          }
          cancelSpectatorDisconnectGrace(existing);
          existing.socketId = socket.id;
          if (spectatorName) existing.name = spectatorName;
          if (spectator.avatar) existing.avatar = spectator.avatar;
        } else {
          if (!room.spectators) room.spectators = [];
          room.spectators.push({
            id: spectator.id,
            name: spectatorName,
            socketId: socket.id,
            avatar: spectator.avatar,
          });
        }
        bumpRoomRevision(room);
        
        socket.join(resolvedId!);
        const roomData = buildRoomData(room);
        
        io.to(resolvedId!).emit("roomUpdate", roomData);
        
        const ackState = buildStatePayload(room);
        markRateLimit("joinAsSpectator");
        cb ? cb(null, ackState, roomData) : (ackState ? socket.emit("state", ackState) : undefined);
      } catch (e: any) {
        console.error("joinAsSpectator error", e);
        const err = { code: "error", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });

    // Spectator: Leave spectator mode
    socket.on("leaveSpectator", ({ roomId }, cb?: (err: any|null) => void) => {
      try {
        const room = getRoom(roomId);
        if (!room) {
          cb ? cb(null) : undefined;
          return;
        }
        
        const spectatorIndex = room.spectators?.findIndex((s: any) => s.socketId === socket.id) ?? -1;
        if (spectatorIndex >= 0) {
          const spectator = room.spectators![spectatorIndex];
          removeSpectator(room, spectator.id);
          socket.leave(roomId);
          emitRoomUpdate(roomId);
        }
        
        cb ? cb(null) : undefined;
      } catch (e: any) {
        console.error("leaveSpectator error", e);
        cb ? cb({ code: "error", message: e.message }) : socket.emit("error", { code: "error", message: e.message });
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      // Find any rooms this socket is in and remove them
      const allRooms = roomsInfo();
      for (const roomInfo of allRooms) {
        const room = getRoom(roomInfo.id);
        if (!room) continue;
        
        // Check if this is a spectator disconnecting
        const spectatorIndex = room.spectators?.findIndex((s: any) => s.socketId === socket.id) ?? -1;
        if (spectatorIndex >= 0) {
          const spectator = room.spectators![spectatorIndex];
          const rid = roomInfo.id;
          const spectatorId = spectator.id;
          beginSpectatorDisconnectGrace(room, spectatorId, RECONNECT_GRACE_MS, () => {
            removeSpectator(room, spectatorId);
            emitRoomUpdate(rid);
          });
          emitRoomUpdate(rid);
          startGraceTickBroadcast(room, () => emitRoomUpdate(rid));
          continue;
        }
        
        const player = room.players.find((p: any) => p.socketId === socket.id);
        if (player) {
          const rid = roomInfo.id;
          const playerId = player.id;
          beginDisconnectGrace(room, playerId, RECONNECT_GRACE_MS, () => {
            leaveRoom(rid, playerId);
            finalizePlayerRemoval(rid, playerId);
          });
          emitRoomUpdate(rid);
          startGraceTickBroadcast(room, () => emitRoomUpdate(rid));
        }
      }
    });

    // Chat: Send message
    socket.on("chatMessage", ({ roomId, message }, cb?: (err: any|null, msg?: any) => void) => {
      try {
        const room = getRoom(roomId);
        if (!room) {
          const err = { code: "room_not_found", message: "Room not found" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Find the player sending the message
        const player = room.players.find((p: any) => p.socketId === socket.id);
        if (!player) {
          const err = { code: "not_in_room", message: "You are not in this room" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }

        if (isChatSendBlocked(room, player.id)) {
          const err = {
            code: room.chatMutedAll ? "chat_muted_all" : "chat_muted",
            message: room.chatMutedAll ? "Chat is muted for this room" : "Chat is muted for you",
          };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Validate message
        if (!message || typeof message !== "string" || message.trim().length === 0) {
          const err = { code: "invalid_message", message: "Message cannot be empty" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }

        const rate = checkChatRateLimit(player);
        if (!rate.allowed) {
          const err = {
            code: "rate_limited",
            message: `Slow down — wait ${Math.ceil((rate.retryAfterMs || 1000) / 1000)}s before sending another message`,
          };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        recordChatSend(player);

        const cleanMessage = sanitizeChatText(message);
        if (!cleanMessage) {
          const err = { code: "invalid_message", message: "Message cannot be empty" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Add message to room
        const chatMsg = addChatMessage(roomId, player.id, player.name, cleanMessage);
        if (!chatMsg) {
          const err = { code: "failed", message: "Failed to send message" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Broadcast to all players in the room
        io.to(roomId).emit("chatMessage", chatMsg);
        
        cb ? cb(null, chatMsg) : undefined;
      } catch (e: any) {
        console.error("chatMessage error", e);
        const err = { code: "error", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });
    
    // Chat: Get message history
    socket.on("getChatHistory", ({ roomId }, cb?: (err: any|null, messages?: any[]) => void) => {
      try {
        const room = getRoom(roomId);
        if (!room) {
          const err = { code: "room_not_found", message: "Room not found" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Find the player requesting history
        const player = room.players.find((p: any) => p.socketId === socket.id);
        if (!player) {
          const err = { code: "not_in_room", message: "You are not in this room" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        const messages = getChatMessages(roomId);
        cb ? cb(null, messages) : socket.emit("chatHistory", messages);
      } catch (e: any) {
        console.error("getChatHistory error", e);
        const err = { code: "error", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });

    // Emote: Send an emote that broadcasts to all players in the room
    socket.on("sendEmote", ({ roomId, emote }, cb?: (err: any|null) => void) => {
      try {
        if (!checkRateLimit("sendEmote", 40, 500, cb)) return;
        const room = getRoom(roomId);
        if (!room) {
          const err = { code: "room_not_found", message: "Room not found" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Find the player sending the emote
        const player = room.players.find((p: any) => p.socketId === socket.id);
        if (!player) {
          const err = { code: "not_in_room", message: "You are not in this room" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }

        if (isChatSendBlocked(room, player.id)) {
          const err = {
            code: room.chatMutedAll ? "chat_muted_all" : "chat_muted",
            message: room.chatMutedAll ? "Chat is muted for this room" : "Chat is muted for you",
          };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        const cleanEmote = sanitizeEmote(emote);
        if (!cleanEmote) {
          const err = { code: "invalid_emote", message: "Invalid emote" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Create emote event
        const emoteEvent = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          playerId: player.id,
          playerName: player.name,
          emote: cleanEmote,
          timestamp: Date.now(),
        };
        
        // Broadcast to all players in the room (including sender for consistency)
        io.to(roomId).emit("emote", emoteEvent);
        markRateLimit("sendEmote");
        
        cb ? cb(null) : void 0;
      } catch (e: any) {
        console.error("sendEmote error", e);
        const err = { code: "error", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });

    // setAvatar: Update player's avatar in the room
    socket.on("setAvatar", ({ roomId, avatar }, cb?: (err: any|null) => void) => {
      try {
        const room = getRoom(roomId);
        if (!room) {
          const err = { code: "room_not_found", message: "Room not found" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Find the player
        const player = room.players.find((p: any) => p.socketId === socket.id);
        if (!player) {
          const err = { code: "not_in_room", message: "You are not in this room" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Validate avatar
        if (!avatar || typeof avatar.emoji !== "string" || typeof avatar.color !== "string" || typeof avatar.borderColor !== "string") {
          const err = { code: "invalid_avatar", message: "Invalid avatar configuration" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Update player's avatar
        player.avatar = {
          emoji: avatar.emoji.slice(0, 8), // Limit emoji length
          color: avatar.color.slice(0, 20),
          borderColor: avatar.borderColor.slice(0, 20),
        };
        
        // Broadcast updated room data to all players
        const roomData = {
          players: room.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
          spectators: room.spectators?.map((s: any) => ({ id: s.id, name: s.name, avatar: s.avatar })) || [],
          hostId: room.hostId,
        };
        io.to(roomId).emit("roomUpdate", roomData);
        
        cb ? cb(null) : void 0;
      } catch (e: any) {
        console.error("setAvatar error", e);
        const err = { code: "error", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });

    // Lobby listing
    socket.on("listRooms", (cb?: (err: any|null, rooms?: any[]) => void) => {
      try {
        const list = roomsInfo();
        cb ? cb(null, list) : socket.emit("rooms", list);
      } catch (e: any) {
        const err = { code: "bad_request", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });
  });

  // Return server components with cleanup function
  return { 
    app, 
    httpServer, 
    io,
    // Call this to stop the cleanup interval when shutting down
    stopCleanup: () => clearInterval(cleanupInterval),
  };
}
