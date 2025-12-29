import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { CreateRoomPayload, JoinRoomPayload, Intent, StartRoomPayload } from "@kouppi/protocol";
import { 
  createRoomWithCreator, joinRoom, leaveRoom, closeRoom, handleIntent, snapshot, getRoom, roomsInfo, startRoom,
  startTurnTimer, clearTurnTimer, getTurnTimerInfo, resetAfkCount, incrementAfkCount, shouldKickForAfk,
  startFirstTurn, getCurrentPlayerId
} from "./rooms.js";
import type { TableConfig } from "@kouppi/game-core";
import { applyAction } from "@kouppi/game-core";

export function createKouppiServer(opts?: {
  corsOrigin?: string;
  config?: TableConfig;
}) {
  const app = express();
  app.use(cors({ origin: opts?.corsOrigin ?? "*" }));

  // Root route so visiting http://localhost:4000 doesn't look broken.
  app.get("/", (_req, res) => {
    res
      .status(200)
      .type("text/plain")
      .send("KOUPPI multiplayer server is running. Try GET /health or connect via Socket.IO.");
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));

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

  io.on("connection", (socket) => {
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
        const creator = { id: data.creator.id, name: data.creator.name, socketId: socket.id };
        createRoomWithCreator(data.roomId, creator, cfg as any, Math.floor(Math.random() * 1e9));
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
        try {
          joinRoom(data.roomId, { id: data.player.id, name: data.player.name, socketId: socket.id });
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
        // Include room data (players list, hostId) in the ack for proper state setup
        const roomData = room ? {
          players: room.players.map((p: any) => ({ id: p.id, name: p.name })),
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
        
        // Handle game flow
        const r = getRoom(roomId);
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
              room2.state = applyAction(room2.state, { type: "startTurn" });
              
              const snap2 = snapshot(roomId);
              io.to(roomId).emit("state", snap2);
              
              // Check if round ended after startTurn
              if (room2.state.phase === "RoundEnd") {
                handleRoundEnd(roomId);
              } else {
                // Start timer for next player
                startTurnTimerForRoom(roomId);
              }
            } catch (e) {
              console.error("Error in intent flow:", e);
            }
          }, 1500);
          return;
        }
        
        // If nextPlayer/nextRound was called, start timer for new player
        if (i.type === "nextPlayer" || i.type === "nextRound" || i.type === "startTurn") {
          if (r.state.phase === "Round" && r.state.turn?.upcards) {
            startTurnTimerForRoom(roomId);
          }
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
        room.state = applyAction(room.state, { type: "startTurn" });
        
        // Reset all AFK counts
        room.players.forEach(p => p.afkCount = 0);
        
        const snap = snapshot(roomId);
        io.to(roomId).emit("state", snap);
        
        // Start turn timer
        startTurnTimerForRoom(roomId);
        
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
        
        // Start the first turn
        startFirstTurn(data.roomId);
        
        const snap = snapshot(data.roomId);
        io.to(data.roomId).emit("state", snap);
        
        // Start turn timer
        startTurnTimerForRoom(data.roomId);
        
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
            closeRoom(roomId);
            return;
          } else {
            io.to(roomId).emit("roomUpdate", {
              players: room.players.map((p: any) => ({ id: p.id, name: p.name })),
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
        room.state = applyAction(room.state, { type: "startTurn" });
        
        const snap = snapshot(roomId);
        io.to(roomId).emit("state", snap);
        
        // Check if round ended
        if (room.state.phase === "RoundEnd") {
          handleRoundEnd(roomId);
        } else {
          // Start timer for next player
          startTurnTimerForRoom(roomId);
        }
      } catch (e) {
        console.error("Error handling timeout:", e);
      }
    }
    
    // Handle round end
    function handleRoundEnd(roomId: string) {
      const room = getRoom(roomId);
      if (!room) return;
      
      clearTurnTimer(roomId);
      clearTimerInterval(roomId);
      
      // Notify clients that round has ended
      io.to(roomId).emit("roundEnd", {
        pot: room.state?.round?.pot || 0,
        players: room.state?.players?.map((p: any) => ({ id: p.id, name: p.name, bankroll: p.bankroll })),
      });
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
        const wasHost = room.hostId === leavingPlayer.id;
        leaveRoom(roomId, leavingPlayer.id);
        socket.leave(roomId);
        
        if (wasHost || room.players.length === 0) {
          // Host left or room empty - close the room
          io.to(roomId).emit("roomClosed", { reason: wasHost ? "host_left" : "empty" });
          // Remove remaining players from the socket room
          closeRoom(roomId);
        } else {
          // Notify remaining players
          io.to(roomId).emit("roomUpdate", {
            players: room.players.map((p: any) => ({ id: p.id, name: p.name })),
            hostId: room.hostId,
          });
        }
        cb ? cb(null) : undefined;
      } catch (e: any) {
        console.error("leaveRoom error", e);
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
        const player = room.players.find((p: any) => p.socketId === socket.id);
        if (player) {
          const wasHost = room.hostId === player.id;
          leaveRoom(roomInfo.id, player.id);
          
          if (wasHost || room.players.length === 0) {
            // Host left or room empty - close the room
            io.to(roomInfo.id).emit("roomClosed", { reason: wasHost ? "host_left" : "empty" });
            closeRoom(roomInfo.id);
          } else {
            // Notify remaining players
            io.to(roomInfo.id).emit("roomUpdate", {
              players: room.players.map((p: any) => ({ id: p.id, name: p.name })),
              hostId: room.hostId,
            });
          }
        }
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

  return { app, httpServer, io };
}
