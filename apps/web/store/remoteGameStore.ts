"use client";
import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import type { GameState } from "@kouppi/game-core";

// Local Intent type to avoid cross-package type resolution issues in dev
type Intent =
  | { type: "bet"; amount: number }
  | { type: "kouppi" }
  | { type: "shistri" }
  | { type: "pass" }
  | { type: "startRound" }
  | { type: "ante" }
  | { type: "determineStarter" }
  | { type: "startTurn" }
  | { type: "nextPlayer" }
  | { type: "nextRound" };

export type RoomConfig = {
  ante: number;
  startingBankroll: number;
  maxPlayers: number;
  shistri: { enabled: boolean; percent: number; minChip: number };
  turnTimeout?: number;
};

export type RoomInfo = {
  id: string;
  playerCount: number;
  maxPlayers: number;
  started: boolean;
  hostId?: string;
};

export type PlayerInfo = {
  id: string;
  name: string;
};

export type TurnTimerInfo = {
  remaining: number;
  total: number;
  currentPlayerId: string | null;
};

type RemoteStore = {
  // Connection state
  socket: Socket | null;
  connected: boolean;
  
  // Player identity
  playerId: string | null;
  playerName: string | null;
  
  // Current room state
  roomId: string | null;
  isHost: boolean;
  roomConfig: RoomConfig | null;
  playersInRoom: PlayerInfo[];
  gameStarted: boolean;
  state: GameState | null;
  
  // Turn timer
  turnTimer: TurnTimerInfo | null;
  
  // Round end state
  roundEnded: boolean;
  
  // Player timeout/kick notifications
  playerTimeout: { playerId: string; afkCount: number; kicked: boolean } | null;
  
  // Lobby state
  rooms: RoomInfo[];
  
  // Error handling
  lastError: string | null;
  
  // Actions
  connect: (url?: string) => void;
  disconnect: () => void;
  setIdentity: (playerId: string, name: string) => void;
  createRoom: (roomId: string, config: Partial<RoomConfig>) => Promise<{ success: boolean; error?: string }>;
  joinRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: () => void;
  startGame: () => Promise<{ success: boolean; error?: string }>;
  sendIntent: (intent: Intent) => void;
  requestNewRound: () => Promise<{ success: boolean; error?: string }>;
  listRooms: () => void;
  clearError: () => void;
  clearPlayerTimeout: () => void;
};

export const useRemoteGameStore = create<RemoteStore>((set, get) => ({
  // Initial state
  socket: null,
  connected: false,
  playerId: null,
  playerName: null,
  roomId: null,
  isHost: false,
  roomConfig: null,
  playersInRoom: [],
  gameStarted: false,
  state: null,
  turnTimer: null,
  roundEnded: false,
  playerTimeout: null,
  rooms: [],
  lastError: null,

  connect: (url?: string) => {
    // Use provided URL, or environment variable, or default to localhost
    const serverUrl = url || process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
    const existingSocket = get().socket;
    if (existingSocket?.connected) return;
    
    const s = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 500,
    });
    
    s.on("connect", () => {
      set({ socket: s, connected: true, lastError: null });
      // Auto-refresh rooms on connect
      get().listRooms();
    });
    
    s.on("disconnect", () => set({ connected: false }));
    
    s.on("state", (snapshot: any) => {
      if (snapshot) {
        // Extract player list from game state if available
        const players: PlayerInfo[] = snapshot.players?.map((p: any) => ({ id: p.id, name: p.name })) || [];
        set({ 
          state: snapshot, 
          playersInRoom: players,
          gameStarted: snapshot.phase !== "Lobby" && snapshot.phase !== undefined 
        });
      }
    });
    
    s.on("roomUpdate", (data: { players: PlayerInfo[]; hostId: string } | null) => {
      if (data) {
        const currentPlayerId = get().playerId;
        set({
          playersInRoom: data.players || [],
          isHost: data.hostId === currentPlayerId,
        });
      }
    });
    
    s.on("roomClosed", (data: { reason: string }) => {
      console.log("Room closed:", data.reason);
      set({
        roomId: null,
        isHost: false,
        state: null,
        playersInRoom: [],
        gameStarted: false,
        roomConfig: null,
        turnTimer: null,
        roundEnded: false,
        lastError: data.reason === "host_left" ? "The host has left the room" : "Room closed",
      });
    });
    
    // Turn timer updates
    s.on("turnTimer", (data: TurnTimerInfo) => {
      set({ turnTimer: data });
    });
    
    // Round end notification
    s.on("roundEnd", () => {
      set({ roundEnded: true, turnTimer: null });
    });
    
    // Player timeout notification
    s.on("playerTimeout", (data: { playerId: string; afkCount: number; kicked: boolean }) => {
      set({ playerTimeout: data });
      // Auto-clear after 3 seconds
      setTimeout(() => {
        set({ playerTimeout: null });
      }, 3000);
    });
    
    // Player kicked notification
    s.on("playerKicked", (data: { playerId: string; reason: string }) => {
      const currentPlayerId = get().playerId;
      if (data.playerId === currentPlayerId) {
        // We were kicked
        set({
          roomId: null,
          isHost: false,
          state: null,
          playersInRoom: [],
          gameStarted: false,
          roomConfig: null,
          turnTimer: null,
          lastError: `You were kicked for being AFK`,
        });
      }
    });
    
    s.on("rooms", (rooms: RoomInfo[]) => set({ rooms: rooms || [] }));
    
    s.on("error", (err: any) => {
      console.warn("server error", err);
      set({ lastError: err?.message || "Unknown error" });
    });
    
    s.on("connect_error", (err: any) => {
      console.error("connect error", err?.message || err);
      set({ lastError: `Connection failed: ${err?.message || "Unknown"}` });
    });
  },

  disconnect: () => {
    const s = get().socket;
    if (s) {
      s.disconnect();
      set({ 
        socket: null, 
        connected: false, 
        roomId: null, 
        isHost: false,
        state: null,
        playersInRoom: [],
        gameStarted: false
      });
    }
  },

  setIdentity: (playerId, name) => {
    set({ playerId, playerName: name });
  },

  createRoom: async (roomId, config) => {
    const { socket, playerId, playerName } = get();
    if (!socket) return { success: false, error: "Not connected" };
    if (!playerId || !playerName) return { success: false, error: "Identity not set" };
    
    return new Promise((resolve) => {
      socket.emit("createRoom", {
        roomId,
        creator: { id: playerId, name: playerName },
        config: {
          ante: config.ante ?? 10,
          startingBankroll: config.startingBankroll ?? 100,
          maxPlayers: config.maxPlayers ?? 8,
          shistri: config.shistri ?? { enabled: true, percent: 5, minChip: 1 },
        },
      }, (err: any, snap: any) => {
        if (err) {
          set({ lastError: err.message || "Create failed" });
          resolve({ success: false, error: err.message || err.code });
        } else {
          set({ 
            roomId, 
            isHost: true, 
            state: snap || null,
            roomConfig: config as RoomConfig,
            playersInRoom: [{ id: playerId, name: playerName }],
            gameStarted: false,
            lastError: null,
          });
          resolve({ success: true });
        }
      });
    });
  },

  joinRoom: async (roomId) => {
    const { socket, playerId, playerName } = get();
    if (!socket) return { success: false, error: "Not connected" };
    if (!playerId || !playerName) return { success: false, error: "Identity not set" };
    
    return new Promise((resolve) => {
      socket.emit("joinRoom", {
        roomId,
        player: { id: playerId, name: playerName },
      }, (err: any, snap: any, roomData: any) => {
        if (err) {
          set({ lastError: err.message || "Join failed" });
          resolve({ success: false, error: err.message || err.code });
        } else {
          // Get host status from roomData returned by server
          const isHost = roomData?.hostId === playerId;
          const players: PlayerInfo[] = roomData?.players || snap?.players?.map((p: any) => ({ id: p.id, name: p.name })) || [];
          
          set({ 
            roomId, 
            isHost,
            state: snap || null,
            playersInRoom: players,
            gameStarted: snap?.phase !== "Lobby" && snap?.phase !== undefined,
            lastError: null,
          });
          resolve({ success: true });
        }
      });
    });
  },

  leaveRoom: () => {
    const { socket, roomId } = get();
    if (socket && roomId) {
      // The server doesn't have an explicit leave - we just disconnect from the room
      // For now, just reset local state. A proper leaveRoom event could be added to the server.
      socket.emit("leaveRoom", { roomId });
    }
    set({ 
      roomId: null, 
      isHost: false, 
      state: null, 
      playersInRoom: [], 
      gameStarted: false,
      roomConfig: null,
    });
  },

  startGame: async () => {
    const { socket, roomId, playerId, isHost } = get();
    if (!socket || !roomId) return { success: false, error: "Not in a room" };
    if (!isHost) return { success: false, error: "Only the host can start the game" };
    
    return new Promise((resolve) => {
      socket.emit("startRoom", { roomId, by: playerId }, (err: any, snap: any) => {
        if (err) {
          set({ lastError: err.message || "Start failed" });
          resolve({ success: false, error: err.message || err.code });
        } else {
          set({ 
            state: snap,
            gameStarted: true,
            lastError: null,
          });
          resolve({ success: true });
        }
      });
    });
  },

  sendIntent: (intent) => {
    const { socket, roomId, playerId } = get();
    if (!socket || !roomId || !playerId) return;
    socket.emit("intent", { roomId, playerId, intent });
  },
  
  requestNewRound: async () => {
    const { socket, roomId, playerId, isHost } = get();
    if (!socket || !roomId) return { success: false, error: "Not in a room" };
    if (!isHost) return { success: false, error: "Only the host can start a new round" };
    
    return new Promise((resolve) => {
      socket.emit("newRound", { roomId, playerId }, (err: any, snap: any) => {
        if (err) {
          set({ lastError: err.message || "New round failed" });
          resolve({ success: false, error: err.message || err.code });
        } else {
          set({ 
            state: snap,
            roundEnded: false,
            turnTimer: null,
            lastError: null,
          });
          resolve({ success: true });
        }
      });
    });
  },

  listRooms: () => {
    const s = get().socket;
    if (!s) return;
    s.emit("listRooms", (err: any, rooms: RoomInfo[]) => {
      if (err) {
        console.warn("listRooms error", err);
      } else {
        set({ rooms: rooms || [] });
      }
    });
  },

  clearError: () => set({ lastError: null }),
  
  clearPlayerTimeout: () => set({ playerTimeout: null }),
}));
