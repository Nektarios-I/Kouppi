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
  spectatorsAllowed?: boolean;
  spectatorCount?: number;
  isPrivate?: boolean; // Has password protection
};

// Avatar configuration
export type AvatarConfig = {
  emoji: string;
  color: string;
  borderColor: string;
};

export type PlayerInfo = {
  id: string;
  name: string;
  avatar?: AvatarConfig;
};

export type TurnTimerInfo = {
  remaining: number;
  total: number;
  currentPlayerId: string | null;
};

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
};

// Emote event type
export type EmoteEvent = {
  id: string;
  playerId: string;
  playerName: string;
  emote: string;
  timestamp: number;
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
  isSpectator: boolean;
  roomConfig: RoomConfig | null;
  playersInRoom: PlayerInfo[];
  spectatorsInRoom: PlayerInfo[]; // Spectators are similar to PlayerInfo
  gameStarted: boolean;
  state: GameState | null;
  
  // Turn timer
  turnTimer: TurnTimerInfo | null;
  
  // Round end state
  roundEnded: boolean;
  // Round decision state (stay/leave + countdown)
  roundDecision: { active: boolean; remaining: number; deadlineTs: number; choices: Record<string, "stay"|"leave"|null> } | null;
  
  // Player timeout/kick notifications
  playerTimeout: { playerId: string; afkCount: number; kicked: boolean } | null;
  
  // Chat state
  chatMessages: ChatMessage[];
  
  // Emote state (active emotes, auto-cleared after display duration)
  activeEmotes: EmoteEvent[];
  
  // Player avatar (persisted locally)
  playerAvatar: AvatarConfig | null;
  
  // Lobby state
  rooms: RoomInfo[];
  
  // Error handling
  lastError: string | null;
  
  // Actions
  connect: (url?: string) => void;
  disconnect: () => void;
  setIdentity: (playerId: string, name: string) => void;
  clearRoomState: () => void; // Clear all room-related state before joining/creating
  createRoom: (roomId: string, config: Partial<RoomConfig>, password?: string) => Promise<{ success: boolean; error?: string }>;
  joinRoom: (roomId: string, password?: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  subscribeToCareerRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>; // Subscribe to room without re-joining (for career games)
  leaveRoom: () => void;
  startGame: () => Promise<{ success: boolean; error?: string }>;
  sendIntent: (intent: Intent) => void;
  requestNewRound: () => Promise<{ success: boolean; error?: string }>;
  decideStay: () => void;
  decideLeave: () => void;
  listRooms: () => void;
  clearError: () => void;
  clearPlayerTimeout: () => void;
  // Chat actions
  sendChatMessage: (message: string) => void;
  fetchChatHistory: () => void;
  // Emote actions
  sendEmote: (emote: string) => void;
  // Avatar actions
  setAvatar: (avatar: AvatarConfig) => void;
  // Spectator actions
  joinAsSpectator: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  leaveSpectator: () => void;
};

export const useRemoteGameStore = create<RemoteStore>((set, get) => ({
  // Initial state
  socket: null,
  connected: false,
  playerId: null,
  playerName: null,
  roomId: null,
  isHost: false,
  isSpectator: false,
  roomConfig: null,
  playersInRoom: [],
  spectatorsInRoom: [],
  gameStarted: false,
  state: null,
  turnTimer: null,
  roundEnded: false,
  roundDecision: null,
  playerTimeout: null,
  chatMessages: [],
  activeEmotes: [],
  playerAvatar: null,
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
    
    s.on("roomUpdate", (data: { players: PlayerInfo[]; spectators?: PlayerInfo[]; hostId: string } | null) => {
      if (data) {
        const currentPlayerId = get().playerId;
        const isSpectator = get().isSpectator;
        
        // Check if still in room as player or spectator
        const stillInRoomAsPlayer = !!data.players?.some(p => p.id === currentPlayerId);
        const stillInRoomAsSpectator = !!data.spectators?.some(s => s.id === currentPlayerId);
        
        if (!stillInRoomAsPlayer && !stillInRoomAsSpectator) {
          // We have been removed. Reset ALL local state.
          set({
            roomId: null,
            isHost: false,
            isSpectator: false,
            state: null,
            playersInRoom: [],
            spectatorsInRoom: [],
            gameStarted: false,
            roomConfig: null,
            turnTimer: null,
            roundEnded: false,
            roundDecision: null,
            playerTimeout: null,
            chatMessages: [],
            activeEmotes: [],
            lastError: null,
          });
          return;
        }
        set({
          playersInRoom: data.players || [],
          spectatorsInRoom: data.spectators || [],
          isHost: data.hostId === currentPlayerId,
          isSpectator: stillInRoomAsSpectator && !stillInRoomAsPlayer,
        });
      }
    });
    
    s.on("roomClosed", (data: { reason: string }) => {
      console.log("Room closed:", data.reason);
      // Reset ALL room-related state
      set({
        roomId: null,
        isHost: false,
        isSpectator: false,
        state: null,
        playersInRoom: [],
        spectatorsInRoom: [],
        gameStarted: false,
        roomConfig: null,
        turnTimer: null,
        roundEnded: false,
        roundDecision: null,
        playerTimeout: null,
        chatMessages: [],
        activeEmotes: [],
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

    // Round decision phase start
    s.on("roundDecisionStart", (data: { deadlineTs: number; players: PlayerInfo[]; choices: Record<string, "stay"|"leave"|null> }) => {
      const remaining = Math.max(0, Math.ceil((data.deadlineTs - Date.now())/1000));
      set({ roundDecision: { active: true, remaining, deadlineTs: data.deadlineTs, choices: data.choices } });
    });
    // Round decision updates
    s.on("roundDecisionUpdate", (data: { remaining: number; choices: Record<string, "stay"|"leave"|null> }) => {
      set((prev) => ({ roundDecision: prev.roundDecision ? { ...prev.roundDecision, remaining: data.remaining, choices: data.choices } : null }));
    });
    // Round decision end
    s.on("roundDecisionEnd", (_data: { started: boolean; reason?: string }) => {
      set({ roundDecision: null, roundEnded: false });
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
        // We were kicked - reset ALL room-related state
        set({
          roomId: null,
          isHost: false,
          isSpectator: false,
          state: null,
          playersInRoom: [],
          spectatorsInRoom: [],
          gameStarted: false,
          roomConfig: null,
          turnTimer: null,
          roundEnded: false,
          roundDecision: null,
          playerTimeout: null,
          chatMessages: [],
          activeEmotes: [],
          lastError: `You were kicked for being AFK`,
        });
      }
    });
    
    s.on("rooms", (rooms: RoomInfo[]) => set({ rooms: rooms || [] }));
    
    // Chat message received
    s.on("chatMessage", (msg: ChatMessage) => {
      set((prev) => ({ 
        chatMessages: [...prev.chatMessages, msg].slice(-100) // Keep last 100 messages
      }));
    });
    
    // Chat history received
    s.on("chatHistory", (messages: ChatMessage[]) => {
      set({ chatMessages: messages || [] });
    });
    
    // Emote received
    s.on("emote", (emoteEvent: EmoteEvent) => {
      // Add emote to active list
      set((prev) => ({
        activeEmotes: [...prev.activeEmotes, emoteEvent]
      }));
      // Auto-remove after 3 seconds (display duration)
      setTimeout(() => {
        set((prev) => ({
          activeEmotes: prev.activeEmotes.filter(e => e.id !== emoteEvent.id)
        }));
      }, 3000);
    });
    
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
        isSpectator: false,
        state: null,
        playersInRoom: [],
        spectatorsInRoom: [],
        gameStarted: false,
        roomConfig: null,
        turnTimer: null,
        roundEnded: false,
        roundDecision: null,
        playerTimeout: null,
        chatMessages: [],
        activeEmotes: [],
        lastError: null,
      });
    }
  },

  setIdentity: (playerId, name) => {
    set({ playerId, playerName: name });
  },
  
  // Clear all room-related state - call before creating or joining a new room
  clearRoomState: () => {
    const { socket, roomId } = get();
    // If we're in a room, emit leave first
    if (socket && roomId) {
      socket.emit("leaveRoom", { roomId });
    }
    set({
      roomId: null,
      isHost: false,
      isSpectator: false,
      state: null,
      playersInRoom: [],
      spectatorsInRoom: [],
      gameStarted: false,
      roomConfig: null,
      turnTimer: null,
      roundEnded: false,
      roundDecision: null,
      playerTimeout: null,
      chatMessages: [],
      activeEmotes: [],
      lastError: null,
    });
  },

  createRoom: async (roomId, config, password) => {
    const { socket, playerId, playerName, roomId: currentRoomId } = get();
    if (!socket) return { success: false, error: "Not connected" };
    if (!playerId || !playerName) return { success: false, error: "Identity not set" };
    
    // Clear any previous room state first
    if (currentRoomId) {
      get().clearRoomState();
    }
    
    const { playerAvatar } = get();
    
    return new Promise((resolve) => {
      socket.emit("createRoom", {
        roomId,
        creator: { id: playerId, name: playerName, avatar: playerAvatar || undefined },
        config: {
          ante: config.ante ?? 10,
          startingBankroll: config.startingBankroll ?? 100,
          maxPlayers: config.maxPlayers ?? 8,
          shistri: config.shistri ?? { enabled: true, percent: 5, minChip: 1 },
        },
        password: password?.trim() || undefined, // Optional password
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
            playersInRoom: [{ id: playerId, name: playerName, avatar: playerAvatar || undefined }],
            gameStarted: false,
            lastError: null,
          });
          resolve({ success: true });
        }
      });
    });
  },

  joinRoom: async (roomId, password) => {
    const { socket, playerId, playerName, playerAvatar, roomId: currentRoomId } = get();
    if (!socket) return { success: false, error: "Not connected" };
    if (!playerId || !playerName) return { success: false, error: "Identity not set" };
    
    // Clear any previous room state first
    if (currentRoomId && currentRoomId !== roomId) {
      get().clearRoomState();
    }
    
    return new Promise((resolve) => {
      socket.emit("joinRoom", {
        roomId,
        player: { id: playerId, name: playerName, avatar: playerAvatar || undefined },
        password: password?.trim() || undefined, // Password for private rooms
      }, (err: any, snap: any, roomData: any) => {
        if (err) {
          set({ lastError: err.message || "Join failed" });
          // Return specific error code for wrong password
          const errorCode = err.code || (err.message?.includes("password") ? "wrong_password" : "join_failed");
          resolve({ success: false, error: err.message || err.code, code: errorCode });
        } else {
          // Get host status from roomData returned by server
          const isHost = roomData?.hostId === playerId;
          const players: PlayerInfo[] = roomData?.players || snap?.players?.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })) || [];
          
          set({ 
            roomId, 
            isHost,
            isSpectator: false,
            state: snap || null,
            playersInRoom: players,
            spectatorsInRoom: roomData?.spectators || [],
            gameStarted: snap?.phase !== "Lobby" && snap?.phase !== undefined,
            lastError: null,
          });
          resolve({ success: true });
        }
      });
    });
  },

  // Subscribe to a career room without re-adding the player (player already added server-side)
  subscribeToCareerRoom: async (roomId: string) => {
    const { socket, playerId, playerName, playerAvatar } = get();
    if (!socket) return { success: false, error: "Not connected" };
    if (!playerId || !playerName) return { success: false, error: "Identity not set" };
    
    return new Promise((resolve) => {
      // Emit special career room subscription - server will validate player is in the game
      socket.emit("subscribeCareerRoom", {
        roomId,
        playerId,
        playerName,
        avatar: playerAvatar || undefined,
      }, (err: any, snap: any, roomData: any) => {
        if (err) {
          set({ lastError: err.message || "Subscribe failed" });
          resolve({ success: false, error: err.message || err.code });
        } else {
          const isHost = roomData?.hostId === playerId;
          const players: PlayerInfo[] = roomData?.players || snap?.players?.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })) || [];
          
          set({ 
            roomId, 
            isHost,
            isSpectator: false,
            state: snap || null,
            playersInRoom: players,
            spectatorsInRoom: roomData?.spectators || [],
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
    // Reset ALL room-related state to prevent leaking into next session
    set({ 
      roomId: null, 
      isHost: false,
      isSpectator: false,
      state: null, 
      playersInRoom: [],
      spectatorsInRoom: [],
      gameStarted: false,
      roomConfig: null,
      turnTimer: null,
      roundEnded: false,
      roundDecision: null,
      playerTimeout: null,
      chatMessages: [],
      activeEmotes: [],
      lastError: null,
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

  decideStay: () => {
    const { socket, roomId, playerId } = get();
    if (!socket || !roomId || !playerId) return;
    socket.emit("roundDecision", { roomId, playerId, decision: "stay" });
  },
  decideLeave: () => {
    const { socket, roomId, playerId } = get();
    if (!socket || !roomId || !playerId) return;
    socket.emit("roundDecision", { roomId, playerId, decision: "leave" });
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
  
  // Chat actions
  sendChatMessage: (message: string) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    if (!message || message.trim().length === 0) return;
    socket.emit("chatMessage", { roomId, message: message.trim() });
  },
  
  fetchChatHistory: () => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit("getChatHistory", { roomId }, (err: any, messages: ChatMessage[]) => {
      if (err) {
        console.warn("fetchChatHistory error", err);
      } else {
        set({ chatMessages: messages || [] });
      }
    });
  },
  
  // Emote actions
  sendEmote: (emote: string) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    if (!emote || emote.trim().length === 0 || emote.length > 32) return;
    socket.emit("sendEmote", { roomId, emote: emote.trim() });
  },
  
  // Avatar actions
  setAvatar: (avatar: AvatarConfig) => {
    const { socket, roomId } = get();
    // Always update local state
    set({ playerAvatar: avatar });
    // If in a room, notify server
    if (socket && roomId) {
      socket.emit("setAvatar", { roomId, avatar });
    }
  },
  
  // Spectator actions
  joinAsSpectator: async (roomId) => {
    const { socket, playerId, playerName, playerAvatar, roomId: currentRoomId } = get();
    if (!socket) return { success: false, error: "Not connected" };
    if (!playerId || !playerName) return { success: false, error: "Identity not set" };
    
    // Clear any previous room state first
    if (currentRoomId && currentRoomId !== roomId) {
      get().clearRoomState();
    }
    
    return new Promise((resolve) => {
      socket.emit("joinAsSpectator", {
        roomId,
        spectator: { id: playerId, name: playerName, avatar: playerAvatar || undefined },
      }, (err: any, snap: any, roomData: any) => {
        if (err) {
          set({ lastError: err.message || "Join as spectator failed" });
          resolve({ success: false, error: err.message || err.code });
        } else {
          const players: PlayerInfo[] = roomData?.players || [];
          const spectators: PlayerInfo[] = roomData?.spectators || [];
          
          set({ 
            roomId, 
            isHost: false,
            isSpectator: true,
            state: snap || null,
            playersInRoom: players,
            spectatorsInRoom: spectators,
            gameStarted: snap?.phase !== "Lobby" && snap?.phase !== undefined,
            lastError: null,
          });
          resolve({ success: true });
        }
      });
    });
  },
  
  leaveSpectator: () => {
    const { socket, roomId } = get();
    if (socket && roomId) {
      socket.emit("leaveSpectator", { roomId });
    }
    // Reset ALL room-related state to prevent leaking into next session
    set({
      roomId: null,
      isHost: false,
      isSpectator: false,
      state: null,
      playersInRoom: [],
      spectatorsInRoom: [],
      gameStarted: false,
      roomConfig: null,
      turnTimer: null,
      roundEnded: false,
      roundDecision: null,
      playerTimeout: null,
      chatMessages: [],
      activeEmotes: [],
      lastError: null,
    });
  },
}));
