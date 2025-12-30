import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { CreateRoomPayload, JoinRoomPayload, Intent, StartRoomPayload } from "@kouppi/protocol";
import { 
  createRoomWithCreator, joinRoom, leaveRoom, closeRoom, handleIntent, snapshot, getRoom, roomsInfo, startRoom,
  startTurnTimer, clearTurnTimer, getTurnTimerInfo, resetAfkCount, incrementAfkCount, shouldKickForAfk,
  startFirstTurn, getCurrentPlayerId, syncGamePlayersToRoom,
  addChatMessage, getChatMessages, clearChatMessages, cleanupEmptyRooms
} from "./rooms.js";
import type { TableConfig } from "@kouppi/game-core";
import { applyAction } from "@kouppi/game-core";

// Career Mode imports
import { getDatabase, cleanupExpiredSessions } from "@kouppi/database";
import { authRoutes } from "./auth/index.js";
import profileRoutes, { leaderboardRouter, matchesRouter } from "./career/profileRoutes.js";
import { registerCareerHandlers } from "./career/careerSocketHandlers.js";
import { isCareerGame, handleCareerGameEnd, getCareerRoomByGameId } from "./career/careerRoomManager.js";

export function createKouppiServer(opts?: {
  corsOrigin?: string;
  config?: TableConfig;
}) {
  // Initialize database for Career Mode
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

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Career Mode API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/leaderboard", leaderboardRouter);
  app.use("/api/matches", matchesRouter);

  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: opts?.corsOrigin ?? "*" } });

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
    socket.on("createRoom", (payload, cb?: (err: any|null, snapshot?: any) => void) => {
      try {
        const data = CreateRoomPayload.parse(payload);
        if (getRoom(data.roomId)) {
          const err = { code: "room_exists", message: "Room exists" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        const cfg: TableConfig = { ...defaultConfig, ...(data.config as any) };
        const creator = { id: data.creator.id, name: data.creator.name, socketId: socket.id, avatar: data.creator.avatar };
        // Pass optional password for private rooms
        createRoomWithCreator(data.roomId, creator, cfg as any, Math.floor(Math.random() * 1e9), data.password);
        socket.join(data.roomId);
        const snap = snapshot(data.roomId);
        const ackSnap = snap ?? null;
        cb ? cb(null, ackSnap) : socket.emit("state", ackSnap);
      } catch (e: any) {
        const err = { code: "bad_request", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });

    // joinRoom with ack
    socket.on("joinRoom", (payload, cb?: (err: any|null, snapshot?: any, roomData?: any) => void) => {
      try {
        const data = JoinRoomPayload.parse(payload);
        
        // Check if room exists first
        const existingRoom = getRoom(data.roomId);
        if (!existingRoom) {
          const err = { code: "room_not_found", message: "Room not found" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Check password for private rooms
        if (existingRoom.password) {
          if (!data.password || data.password !== existingRoom.password) {
            const err = { code: "wrong_password", message: "Incorrect password" };
            cb ? cb(err) : socket.emit("error", err);
            return;
          }
        }
        
        try {
          joinRoom(data.roomId, { id: data.player.id, name: data.player.name, socketId: socket.id, avatar: data.player.avatar });
        } catch (err: any) {
          const code = err?.message === "room_full" ? "room_full" : "bad_request";
          const e2 = { code, message: err?.message || String(err) };
          cb ? cb(e2) : socket.emit("error", e2);
          return;
        }
        socket.join(data.roomId);
        const room = getRoom(data.roomId);
        const snap = snapshot(data.roomId);
        const ackSnap = snap ?? null;
        // Include room data (players list, hostId, avatars, spectators) in the ack for proper state setup
        const roomData = room ? {
          players: room.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
          spectators: room.spectators?.map((s: any) => ({ id: s.id, name: s.name, avatar: s.avatar })) || [],
          hostId: room.hostId,
        } : null;
        // Notify everyone in the room about the update
        io.to(data.roomId).emit("roomUpdate", roomData);
        if (snap) {
          io.to(data.roomId).emit("state", snap);
        }
        cb ? cb(null, ackSnap, roomData) : socket.emit("state", ackSnap);
      } catch (e: any) {
        const err = { code: "bad_request", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });

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

    socket.on("intent", ({ roomId, playerId, intent }, cb?: (err: any|null, snapshot?: any) => void) => {
      try {
        const i = Intent.parse(intent) as any;
        const room = getRoom(roomId);
        
        // If this is a player action (not a system action), reset their AFK count
        const playerActions = ["pass", "bet", "kouppi", "shistri"];
        if (playerActions.includes(i.type)) {
          resetAfkCount(roomId, playerId);
          clearTurnTimer(roomId);
          clearTimerInterval(roomId);
        }
        
        handleIntent(roomId, playerId, i);
        const snap = snapshot(roomId);
        io.to(roomId).emit("state", snap);
        cb ? cb(null, snap) : socket.emit("state", snap);
        
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
          // Show result for 1.5 seconds, then continue
          setTimeout(() => {
            try {
              const room2 = getRoom(roomId);
              if (!room2 || !room2.state) return;
              
              room2.state = applyAction(room2.state, { type: "nextPlayer" });
              startEligibleTurn(roomId);
            } catch (e) {
              console.error("Error in intent flow:", e);
            }
          }, 1500);
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
        } else if (i.type === "startTurn" && r.state.phase === "Round" && r.state.turn?.upcards) {
          // If a startTurn intent was explicitly sent, ensure the timer is started
          startTurnTimerForRoom(roomId);
        }
      } catch (e: any) {
        const err = { code: "intent_error", message: e.message };
        cb ? cb(err) : socket.emit("error", err);
      }
    });
    
    // Request new round (host only, after round end)
    socket.on("newRound", ({ roomId, playerId }, cb?: (err: any|null, snapshot?: any) => void) => {
      try {
        const room = getRoom(roomId);
        if (!room) throw new Error("room_not_found");
        if (room.hostId !== playerId) throw new Error("not_host");
        if (!room.state || room.state.phase !== "RoundEnd") throw new Error("game_not_ended");
        
        // Start new round
        room.state = applyAction(room.state, { type: "nextRound" });
        room.state = applyAction(room.state, { type: "ante" });
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
        const r = startRoom(data.roomId, data.by);
        
        // Start the first turn with eligibility
        startEligibleTurn(data.roomId);
        
        const snap = snapshot(data.roomId);
        io.to(data.roomId).emit("state", snap);
        
        // Timer handled by startEligibleTurn
        
        cb ? cb(null, snap) : socket.emit("state", snap);
      } catch (e: any) {
        const code = e?.message === "not_host" ? "not_host" : e?.message === "not_enough_players" ? "not_enough_players" : "bad_request";
        const err = { code, message: e?.message || String(e) };
        cb ? cb(err) : socket.emit("error", err);
      }
    });
    
    // Helper function to start turn timer for a room
    function startTurnTimerForRoom(roomId: string) {
      const room = getRoom(roomId);
      if (!room || !room.state) return;
      
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
      if (room) {
        (room as any).timerIntervalId = intervalId;
      }
    }
    
    // Helper function to clear timer interval
    function clearTimerInterval(roomId: string) {
      const room = getRoom(roomId);
      if (room && (room as any).timerIntervalId) {
        clearInterval((room as any).timerIntervalId);
        (room as any).timerIntervalId = null;
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
      room.state = applyAction(room.state, { type: "startTurn" });
      const snap = snapshot(roomId);
      io.to(roomId).emit("state", snap);

      // If round ended during startTurn, enter decision phase
      if (room.state.phase === "RoundEnd") {
        handleRoundEnd(roomId);
        return;
      }

      // If awaitNext became true (e.g., due to bankrupt auto-pass), advance automatically without starting timer
      if (room.state.awaitNext) {
        setTimeout(() => {
          try {
            const r2 = getRoom(roomId);
            if (!r2 || !r2.state) return;
            r2.state = applyAction(r2.state, { type: "nextPlayer" });
            startEligibleTurn(roomId);
          } catch (e) {
            console.error("Error advancing after auto-pass:", e);
          }
        }, 800);
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
        // Kick the player
        const player = room.players.find(p => p.id === currentPlayerId);
        if (player) {
          const wasHost = room.hostId === player.id;
          leaveRoom(roomId, currentPlayerId);
          
          if (wasHost || room.players.length === 0) {
            io.to(roomId).emit("roomClosed", { reason: wasHost ? "host_left" : "empty" });
            closeRoomWithCareerTracking(roomId);
            return;
          } else {
            io.to(roomId).emit("roomUpdate", {
              players: room.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
              spectators: room.spectators?.map((s: any) => ({ id: s.id, name: s.name, avatar: s.avatar })) || [],
              hostId: room.hostId,
            });
            io.to(roomId).emit("playerKicked", { playerId: currentPlayerId, reason: "afk" });
          }
        }
      }
      
      // Auto-pass for the timed-out player
      try {
        if (room.state.turn?.upcards) {
          room.state = applyAction(room.state, { type: "pass" });
        }
        room.state = applyAction(room.state, { type: "nextPlayer" });
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
    socket.on("roundDecision", ({ roomId, playerId, decision }: { roomId: string; playerId: string; decision: "stay"|"leave" }, cb?: (err: any|null) => void) => {
      try {
        const room = getRoom(roomId);
        if (!room || !room.decision?.active) return cb ? cb({ code: "no_decision_phase", message: "No active decision phase" }) : undefined;
        if (!(playerId in room.decision.choices)) return cb ? cb({ code: "not_in_room", message: "Player not in room" }) : undefined;
        // Ignore duplicate
        if (room.decision.choices[playerId] !== null) return cb ? cb(null) : undefined;

        room.decision.choices[playerId] = decision;

        // If player chose leave, remove immediately from room (and broadcast)
        if (decision === "leave") {
          const wasHost = room.hostId === playerId;
          leaveRoom(roomId, playerId);
          io.to(roomId).emit("roomUpdate", {
            players: room.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
            spectators: room.spectators?.map((s: any) => ({ id: s.id, name: s.name, avatar: s.avatar })) || [],
            hostId: room.hostId,
          });
          // If host left or no players, close
          if (wasHost || room.players.length === 0) {
            io.to(roomId).emit("roomClosed", { reason: wasHost ? "host_left" : "empty" });
            closeRoomWithCareerTracking(roomId);
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
          // undecided -> kick
          const wasHost = room.hostId === pid;
          leaveRoom(roomId, pid);
          io.to(roomId).emit("playerKicked", { playerId: pid, reason: "no_decision" });
          if (wasHost || room.players.length === 0) {
            io.to(roomId).emit("roomClosed", { reason: wasHost ? "host_left" : "empty" });
            closeRoomWithCareerTracking(roomId);
            // Clean decision timers
            if (room.decision.timer) clearTimeout(room.decision.timer);
            if (room.decision.interval) clearInterval(room.decision.interval);
            room.decision.active = false;
            return;
          }
        }
      }

      // Clean timers and mark inactive
      if (room.decision.timer) clearTimeout(room.decision.timer);
      if (room.decision.interval) clearInterval(room.decision.interval);
      room.decision.active = false;

      // If fewer than 2 players remain, do not start a new round
      if (room.players.length < 2) {
        io.to(roomId).emit("roundDecisionEnd", { started: false, reason: "not_enough_players" });
        return;
      }

      // Sync game state players to room players
      try {
        syncGamePlayersToRoom(roomId);
      } catch {}

      // Start the next round automatically: nextRound -> ante -> startTurn (via eligibility)
      try {
        if (room.state) {
          room.state = applyAction(room.state, { type: "nextRound" });
          room.state = applyAction(room.state, { type: "ante" });
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
        const wasHost = room.hostId === leavingPlayer.id;
        leaveRoom(roomId, leavingPlayer.id);
        socket.leave(roomId);
        
        if (wasHost || room.players.length === 0) {
          // Host left or room empty - close the room
          io.to(roomId).emit("roomClosed", { reason: wasHost ? "host_left" : "empty" });
          // Remove remaining players from the socket room
          closeRoomWithCareerTracking(roomId);
        } else {
          // Notify remaining players
          // Sync game state players to room - this clears turn if leaving player had it
          try { syncGamePlayersToRoom(roomId); } catch {}
          
          // Handle single player remaining - end the round
          if (room.state && room.state.phase === "Round" && room.state.players.length <= 1) {
            try {
              // Give remaining player the pot and end round
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
          
          // If in Round and no turn is active and not awaiting, start a turn to avoid deadlock
          try {
            if (room.state && room.state.phase === "Round" && !room.state.turn && !room.state.awaitNext && room.state.players.length > 1) {
              startEligibleTurn(roomId);
            }
          } catch {}
          
          const snap = snapshot(roomId);
          io.to(roomId).emit("state", snap);
          io.to(roomId).emit("roomUpdate", {
            players: room.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
            spectators: room.spectators?.map((s: any) => ({ id: s.id, name: s.name, avatar: s.avatar })) || [],
            hostId: room.hostId,
          });
        }
        cb ? cb(null) : undefined;
      } catch (e: any) {
        console.error("leaveRoom error", e);
        cb ? cb({ code: "error", message: e.message }) : socket.emit("error", { code: "error", message: e.message });
      }
    });

    // Spectator: Join as spectator
    socket.on("joinAsSpectator", ({ roomId, spectator }, cb?: (err: any|null, snapshot?: any, roomData?: any) => void) => {
      try {
        const room = getRoom(roomId);
        if (!room) {
          const err = { code: "room_not_found", message: "Room not found" };
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
          // Update socket ID if reconnecting
          const existing = room.spectators.find((s: any) => s.id === spectator.id);
          if (existing) existing.socketId = socket.id;
        } else {
          // Add as new spectator
          if (!room.spectators) room.spectators = [];
          room.spectators.push({
            id: spectator.id,
            name: spectator.name,
            socketId: socket.id,
            avatar: spectator.avatar,
          });
        }
        
        socket.join(roomId);
        const snap = snapshot(roomId);
        const roomData = {
          players: room.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
          spectators: room.spectators?.map((s: any) => ({ id: s.id, name: s.name, avatar: s.avatar })) || [],
          hostId: room.hostId,
        };
        
        // Notify everyone about the new spectator
        io.to(roomId).emit("roomUpdate", roomData);
        
        cb ? cb(null, snap, roomData) : socket.emit("state", snap);
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
          room.spectators?.splice(spectatorIndex, 1);
          socket.leave(roomId);
          
          // Notify everyone about the spectator leaving
          const roomData = {
            players: room.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
            spectators: room.spectators?.map((s: any) => ({ id: s.id, name: s.name, avatar: s.avatar })) || [],
            hostId: room.hostId,
          };
          io.to(roomId).emit("roomUpdate", roomData);
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
          room.spectators?.splice(spectatorIndex, 1);
          // Notify about spectator leaving
          io.to(roomInfo.id).emit("roomUpdate", {
            players: room.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
            spectators: room.spectators?.map((s: any) => ({ id: s.id, name: s.name, avatar: s.avatar })) || [],
            hostId: room.hostId,
          });
          continue;
        }
        
        const player = room.players.find((p: any) => p.socketId === socket.id);
        if (player) {
          const wasHost = room.hostId === player.id;
          leaveRoom(roomInfo.id, player.id);
          
          if (wasHost || room.players.length === 0) {
            // Host left or room empty - close the room
            io.to(roomInfo.id).emit("roomClosed", { reason: wasHost ? "host_left" : "empty" });
            closeRoomWithCareerTracking(roomInfo.id);
          } else {
            // Sync game state players to room - this clears turn if leaving player had it
            try { syncGamePlayersToRoom(roomInfo.id); } catch {}
            
            // Handle single player remaining - end the round
            if (room.state && room.state.phase === "Round" && room.state.players.length <= 1) {
              try {
                // Give remaining player the pot and end round
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
            
            // If in Round and no turn is active and not awaiting, start a turn to avoid deadlock
            try {
              if (room.state && room.state.phase === "Round" && !room.state.turn && !room.state.awaitNext && room.state.players.length > 1) {
                startEligibleTurn(roomInfo.id);
              }
            } catch {}
            
            // Broadcast updated state
            const snap = snapshot(roomInfo.id);
            io.to(roomInfo.id).emit("state", snap);
            io.to(roomInfo.id).emit("roomUpdate", {
              players: room.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
              spectators: room.spectators?.map((s: any) => ({ id: s.id, name: s.name, avatar: s.avatar })) || [],
              hostId: room.hostId,
            });
          }
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
        
        // Validate message
        if (!message || typeof message !== "string" || message.trim().length === 0) {
          const err = { code: "invalid_message", message: "Message cannot be empty" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Add message to room
        const chatMsg = addChatMessage(roomId, player.id, player.name, message);
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
        
        // Validate emote (must be non-empty string, max 32 chars)
        if (!emote || typeof emote !== "string" || emote.length > 32) {
          const err = { code: "invalid_emote", message: "Invalid emote" };
          cb ? cb(err) : socket.emit("error", err);
          return;
        }
        
        // Create emote event
        const emoteEvent = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          playerId: player.id,
          playerName: player.name,
          emote: emote.trim(),
          timestamp: Date.now(),
        };
        
        // Broadcast to all players in the room (including sender for consistency)
        io.to(roomId).emit("emote", emoteEvent);
        
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
