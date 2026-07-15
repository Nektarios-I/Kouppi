"use client";
import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import type { GameState } from "@kouppi/game-core";
import { formatSocketError } from "@/lib/errorMessages";
import { isPlayerMuted } from "@/lib/mutedPlayers";

// Local Intent type to avoid cross-package type resolution issues in dev
type Intent =
  | { type: "bet"; amount: number }
  | { type: "kouppi" }
  | { type: "shistri" }
  | { type: "pass" };

export type RoomConfig = {
  ante: number;
  startingBankroll: number;
  maxPlayers: number;
  shistri: { enabled: boolean; percent: number; minChip: number };
  turnTimeout?: number;
  spectatorsAllowed?: boolean;
};

export type RoomInfo = {
  id: string;
  code: string;
  playerCount: number;
  maxPlayers: number;
  started: boolean;
  hostId?: string;
  spectatorsAllowed?: boolean;
  spectatorCount?: number;
  isPrivate?: boolean;
};

export type ConnectionStatus = "connected" | "connecting" | "reconnecting" | "disconnected";

export type PlayerInfo = {
  id: string;
  name: string;
  avatar?: AvatarConfig;
  ready?: boolean;
  connected?: boolean;
  reconnectRemainingSec?: number | null;
};

// Avatar configuration
export type AvatarConfig = {
  emoji: string;
  color: string;
  borderColor: string;
};

const SESSION_ROOM_KEY = "kouppi_active_room_code";
const SESSION_ROOM_ID_KEY = "kouppi_active_room_id";
const SESSION_SPECTATOR_KEY = "kouppi_active_room_spectator";

let joinRoomInFlight: Promise<{ success: boolean; error?: string; code?: string }> | null = null;
let joinSpectatorInFlight: Promise<{ success: boolean; error?: string; code?: string }> | null = null;

function persistActiveRoom(code: string, roomId: string, isSpectator = false) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SESSION_ROOM_KEY, code);
  sessionStorage.setItem(SESSION_ROOM_ID_KEY, roomId);
  sessionStorage.setItem(SESSION_SPECTATOR_KEY, isSpectator ? "1" : "0");
}

function clearActiveRoomSession() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(SESSION_ROOM_KEY);
  sessionStorage.removeItem(SESSION_ROOM_ID_KEY);
  sessionStorage.removeItem(SESSION_SPECTATOR_KEY);
}

export function getPersistedActiveRoom(): { code: string; roomId: string; isSpectator: boolean } | null {
  if (typeof sessionStorage === "undefined") return null;
  const code = sessionStorage.getItem(SESSION_ROOM_KEY);
  const roomId = sessionStorage.getItem(SESSION_ROOM_ID_KEY);
  if (!code || !roomId) return null;
  return { code, roomId, isSpectator: sessionStorage.getItem(SESSION_SPECTATOR_KEY) === "1" };
}

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
  isSystem?: boolean;
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
  connectionStatus: ConnectionStatus;
  roomUpdateVersion: number;
  gameStateVersion: number;
  pendingIntent: string | null;
  
  // Player identity
  playerId: string | null;
  playerName: string | null;
  
  // Current room state
  roomId: string | null;
  roomCode: string | null;
  isHost: boolean;
  hostId: string | null;
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
  emoteCooldownUntil: number | null;

  // Moderation (from server room state)
  chatMutedAll: boolean;
  chatMutedPlayerIds: string[];
  
  // Actions
  connect: (url?: string) => void;
  disconnect: () => void;
  setIdentity: (playerId: string, name: string) => void;
  clearRoomState: () => void; // Clear all room-related state before joining/creating
  createRoom: (config: Partial<RoomConfig>, password?: string, code?: string) => Promise<{ success: boolean; error?: string; code?: string; roomId?: string }>;
  joinRoom: (roomIdOrCode: string, password?: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  setReady: (ready: boolean) => Promise<{ success: boolean; error?: string }>;
  kickPlayer: (targetId: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  transferHost: (targetId: string) => Promise<{ success: boolean; error?: string }>;
  closeRoomAsHost: () => Promise<{ success: boolean; error?: string }>;
  resumeActiveRoom: () => Promise<{ success: boolean; error?: string }>;
  subscribeToCareerRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>; // Subscribe to room without re-joining (for career games)
  leaveRoom: () => Promise<{ success: boolean; error?: string; code?: string }>;
  startGame: () => Promise<{ success: boolean; error?: string; code?: string }>;
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
  joinAsSpectator: (roomId: string, password?: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  leaveSpectator: () => void;
  reportPlayer: (targetId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  banPlayer: (targetId: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  setRoomChatMuted: (muted: boolean) => Promise<{ success: boolean; error?: string }>;
  mutePlayerChat: (targetId: string, muted: boolean) => Promise<{ success: boolean; error?: string }>;
};

export const useRemoteGameStore = create<RemoteStore>((set, get) => ({
  // Initial state
  socket: null,
  connected: false,
  connectionStatus: "disconnected" as ConnectionStatus,
  roomUpdateVersion: 0,
  gameStateVersion: 0,
  pendingIntent: null,
  playerId: null,
  playerName: null,
  roomId: null,
  roomCode: null,
  isHost: false,
  hostId: null,
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
  emoteCooldownUntil: null,
  chatMutedAll: false,
  chatMutedPlayerIds: [],

  connect: (url?: string) => {
    // Use provided URL, or environment variable, or default to localhost
    const serverUrl = url || process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
    const existingSocket = get().socket;
    if (existingSocket?.connected) return;
    if (existingSocket) {
      existingSocket.removeAllListeners();
      existingSocket.disconnect();
    }
    
    const s = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      transports: ["websocket"],
    });

    set({ connectionStatus: "connecting" });
    
    s.on("connect", () => {
      set({ socket: s, connected: true, connectionStatus: "connected", lastError: null });
      get().listRooms();
    });

    s.io.on("reconnect_attempt", () => {
      set({ connectionStatus: "reconnecting" });
    });

    s.io.on("reconnect", () => {
      set({ connectionStatus: "connected", connected: true });
      const { roomId, playerId, playerName, isSpectator } = get();
      if (!roomId || !playerId || !playerName) return;

      const attemptRejoin = async (tryCount = 0): Promise<void> => {
        const result = isSpectator
          ? await get().joinAsSpectator(roomId)
          : await get().joinRoom(roomId);

        if (result.success) return;

        if (result.code === "slot_taken" && tryCount < 8) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return attemptRejoin(tryCount + 1);
        }

        set({ lastError: result.error || "Failed to rejoin room after reconnect" });
      };

      void attemptRejoin();
    });

    if (typeof document !== "undefined") {
      const onVisibility = () => {
        if (document.visibilityState !== "visible") return;
        const sock = get().socket;
        if (sock && !sock.connected) {
          set({ connectionStatus: "reconnecting" });
          sock.connect();
        }
      };
      document.addEventListener("visibilitychange", onVisibility);
    }
    
    s.on("disconnect", () => set({ connected: false, connectionStatus: "reconnecting" }));
    
    s.on("state", (snapshot: any) => {
      if (!snapshot) return;
      const incomingVersion = typeof snapshot.version === "number" ? snapshot.version : undefined;
      const currentVersion = get().gameStateVersion;
      if (incomingVersion !== undefined && incomingVersion < currentVersion) return;

      const { version: _version, ...gameState } = snapshot;
      const existingPlayers = get().playersInRoom;
      const avatarById = new Map(existingPlayers.map((p) => [p.id, p.avatar]));
      const players: PlayerInfo[] =
        gameState.players?.map((p: any) => ({
          id: p.id,
          name: p.name,
          avatar: avatarById.get(p.id),
        })) || [];
      set({
        state: gameState as GameState,
        gameStateVersion: incomingVersion ?? currentVersion,
        pendingIntent: null,
        playersInRoom: players,
        gameStarted: gameState.phase !== "Lobby" && gameState.phase !== undefined,
        roundEnded: gameState.phase === "RoundEnd",
      });
    });
    
    s.on("roomUpdate", (data: {
      roomId?: string;
      code?: string;
      version?: number;
      players: PlayerInfo[];
      spectators?: PlayerInfo[];
      hostId: string;
      chatMutedAll?: boolean;
      chatMutedPlayerIds?: string[];
    } | null) => {
      if (!data) return;
      const current = get().roomUpdateVersion;
      if (typeof data.version === "number" && data.version < current) return;

      const currentPlayerId = get().playerId;
      const isSpectator = get().isSpectator;
      
      const stillInRoomAsPlayer = !!data.players?.some(p => p.id === currentPlayerId);
      const stillInRoomAsSpectator = !!data.spectators?.some(s => s.id === currentPlayerId);
      
      if (!stillInRoomAsPlayer && !stillInRoomAsSpectator) {
        clearActiveRoomSession();
        set({
          roomId: null,
          roomCode: null,
          isHost: false,
          hostId: null,
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
          roomUpdateVersion: 0,
        });
        return;
      }
      set({
        roomId: data.roomId ?? get().roomId,
        roomCode: data.code ?? get().roomCode,
        playersInRoom: data.players || [],
        spectatorsInRoom: data.spectators || [],
        isHost: data.hostId === currentPlayerId,
        hostId: data.hostId || null,
        isSpectator: stillInRoomAsSpectator && !stillInRoomAsPlayer,
        roomUpdateVersion: typeof data.version === "number" ? data.version : current,
        chatMutedAll: !!data.chatMutedAll,
        chatMutedPlayerIds: data.chatMutedPlayerIds || [],
      });
    });
    
    s.on("roomClosed", (data: { reason: string }) => {
      const reasonMessages: Record<string, string> = {
        empty: "Room closed — no players left",
        host_left: "The host has left the room",
        host_closed: "The host closed the room",
        no_eligible_players: "Room closed — no eligible players remain",
      };
      set({
        roomId: null,
        isHost: false,
        hostId: null,
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
        lastError: reasonMessages[data.reason] || "Room closed",
      });
    });
    
    // Turn timer updates
    s.on("turnTimer", (data: TurnTimerInfo) => {
      set({ turnTimer: data });
    });
    
    s.on("roundDecisionStart", (data: { deadlineTs: number; players: PlayerInfo[]; choices: Record<string, "stay"|"leave"|null> }) => {
      const remaining = Math.max(0, Math.ceil((data.deadlineTs - Date.now())/1000));
      set({ roundDecision: { active: true, remaining, deadlineTs: data.deadlineTs, choices: data.choices }, roundEnded: true, turnTimer: null });
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
      if (data.playerId !== currentPlayerId) return;

      const kickMessages: Record<string, string> = {
        afk: "You were kicked for being AFK",
        no_decision: "You were removed for not choosing stay or leave",
        kicked_by_host: "You were removed by the host",
        banned_by_host: "You were banned from this room",
      };

      clearActiveRoomSession();
      set({
        roomId: null,
        roomCode: null,
        isHost: false,
        hostId: null,
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
        lastError: kickMessages[data.reason] || "You were removed from the room",
      });
    });
    
    s.on("rooms", (rooms: RoomInfo[]) => set({ rooms: rooms || [] }));
    
    // Chat message received
    s.on("chatMessage", (msg: ChatMessage) => {
      if (!msg.isSystem && msg.playerId !== "system" && isPlayerMuted(msg.playerId)) return;
      set((prev) => ({ 
        chatMessages: [...prev.chatMessages, msg].slice(-100)
      }));
    });
    
    // Chat history received
    s.on("chatHistory", (messages: ChatMessage[]) => {
      const filtered = (messages || []).filter(
        (msg) => msg.isSystem || msg.playerId === "system" || !isPlayerMuted(msg.playerId)
      );
      set({ chatMessages: filtered });
    });
    
    // Emote received
    s.on("emote", (emoteEvent: EmoteEvent) => {
      if (isPlayerMuted(emoteEvent.playerId)) return;
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
      set({ lastError: formatSocketError(err?.code, err?.message) });
    });
    
    s.on("connect_error", (err: any) => {
      console.error("connect error", err?.message || err);
      set({ connectionStatus: "disconnected", lastError: `Connection failed: ${err?.message || "Unknown"}` });
    });
  },

  disconnect: () => {
    const s = get().socket;
    if (s) {
      s.disconnect();
      clearActiveRoomSession();
      set({ 
        socket: null, 
        connected: false,
        connectionStatus: "disconnected",
        roomUpdateVersion: 0,
        roomId: null,
        roomCode: null, 
        isHost: false,
        hostId: null,
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
    const { socket, roomId, isSpectator } = get();
    if (socket && roomId) {
      if (isSpectator) {
        socket.emit("leaveSpectator", { roomId });
      } else {
        socket.emit("leaveRoom", { roomId });
      }
    }
    set({
      roomId: null,
      roomCode: null,
      isHost: false,
      hostId: null,
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
      roomUpdateVersion: 0,
    });
  },

  createRoom: async (config, password, code) => {
    const { socket, playerId, playerName, roomId: currentRoomId } = get();
    if (!socket) return { success: false, error: "Not connected" };
    if (!playerId || !playerName) return { success: false, error: "Identity not set" };
    
    if (currentRoomId) {
      get().clearRoomState();
    }
    
    const { playerAvatar } = get();
    const publicCode = code?.trim().toUpperCase();
    
    return new Promise((resolve) => {
      socket.emit("createRoom", {
        code: publicCode,
        roomId: publicCode,
        creator: { id: playerId, name: playerName, avatar: playerAvatar || undefined },
        config: {
          ante: config.ante ?? 10,
          startingBankroll: config.startingBankroll ?? 100,
          maxPlayers: config.maxPlayers ?? 8,
          shistri: config.shistri ?? { enabled: true, percent: 5, minChip: 1 },
          spectatorsAllowed: config.spectatorsAllowed ?? true,
        },
        password: password?.trim() || undefined,
      }, (err: any, snap: any, roomData: any) => {
        if (err) {
          set({ lastError: formatSocketError(err.code, err.message) });
          resolve({ success: false, error: formatSocketError(err.code, err.message), code: err.code });
        } else {
          const resolvedCode = roomData?.code || publicCode || "";
          const resolvedRoomId = roomData?.roomId || publicCode || "";
          persistActiveRoom(resolvedCode, resolvedRoomId);
          set({ 
            roomId: resolvedRoomId,
            roomCode: resolvedCode,
            isHost: true,
            hostId: playerId,
            state: snap || null,
            roomConfig: config as RoomConfig,
            playersInRoom: roomData?.players || [{ id: playerId, name: playerName, avatar: playerAvatar || undefined, ready: true, connected: true }],
            gameStarted: false,
            lastError: null,
            roomUpdateVersion: roomData?.version ?? 0,
          });
          resolve({ success: true, code: resolvedCode, roomId: resolvedRoomId });
        }
      });
    });
  },

  joinRoom: async (roomIdOrCode, password): Promise<{ success: boolean; error?: string; code?: string }> => {
    if (joinRoomInFlight) return await joinRoomInFlight;

    const promise = (async (): Promise<{ success: boolean; error?: string; code?: string }> => {
    const { socket, playerId, playerName, playerAvatar, roomId: currentRoomId } = get();
    if (!socket) return { success: false, error: "Not connected" };
    if (!playerId || !playerName) return { success: false, error: "Identity not set" };
    
    if (currentRoomId && currentRoomId !== roomIdOrCode) {
      get().clearRoomState();
    }
    
    return new Promise((resolve) => {
      socket.emit("joinRoom", {
        roomId: roomIdOrCode.trim(),
        player: { id: playerId, name: playerName, avatar: playerAvatar || undefined },
        password: password?.trim() || undefined,
      }, (err: any, snap: any, roomData: any) => {
        if (err) {
          set({ lastError: formatSocketError(err.code, err.message) });
          const errorCode = err.code || (err.message?.includes("password") ? "wrong_password" : "join_failed");
          resolve({ success: false, error: formatSocketError(errorCode, err.message), code: errorCode });
        } else {
          const isHost = roomData?.hostId === playerId;
          const players: PlayerInfo[] = roomData?.players || [];
          const resolvedRoomId = roomData?.roomId || roomIdOrCode;
          const resolvedCode = roomData?.code || roomIdOrCode.toUpperCase();
          persistActiveRoom(resolvedCode, resolvedRoomId, false);
          const incomingVersion = typeof snap?.version === "number" ? snap.version : 0;
          const { version: _v, ...gameState } = snap || {};
          
          set({ 
            roomId: resolvedRoomId,
            roomCode: resolvedCode,
            isHost,
            hostId: roomData?.hostId || null,
            isSpectator: false,
            state: snap ? (gameState as GameState) : null,
            gameStateVersion: incomingVersion,
            playersInRoom: players,
            spectatorsInRoom: roomData?.spectators || [],
            gameStarted: snap?.phase !== "Lobby" && snap?.phase !== undefined,
            lastError: null,
            roomUpdateVersion: roomData?.version ?? 0,
          });
          resolve({ success: true });
        }
      });
    });
    })();

    joinRoomInFlight = promise;
    try {
      return await promise;
    } finally {
      joinRoomInFlight = null;
    }
  },

  setReady: async (ready) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return { success: false, error: "Not in a room" };
    return new Promise((resolve) => {
      socket.emit("setReady", { roomId, ready }, (err: any, roomData: any) => {
        if (err) {
          resolve({ success: false, error: err.message || err.code });
        } else {
          if (roomData) {
            set({
              playersInRoom: roomData.players || get().playersInRoom,
              roomUpdateVersion: roomData.version ?? get().roomUpdateVersion,
            });
          }
          resolve({ success: true });
        }
      });
    });
  },

  kickPlayer: async (targetId) => {
    const { socket, roomId, isHost } = get();
    if (!socket || !roomId) return { success: false, error: "Not in a room" };
    if (!isHost) return { success: false, error: "Only the host can kick players" };
    return new Promise((resolve) => {
      socket.emit("kickPlayer", { roomId, targetId }, (err: any) => {
        if (err) resolve({ success: false, error: err.message || err.code, code: err.code });
        else resolve({ success: true });
      });
    });
  },

  transferHost: async (targetId) => {
    const { socket, roomId, isHost, playerId } = get();
    if (!socket || !roomId) return { success: false, error: "Not in a room" };
    if (!isHost) return { success: false, error: "Only the host can transfer host" };
    return new Promise((resolve) => {
      socket.emit("transferHost", { roomId, targetId }, (err: any, roomData: any) => {
        if (err) resolve({ success: false, error: err.message || err.code });
        else {
          if (roomData) {
            set({
              playersInRoom: roomData.players || get().playersInRoom,
              hostId: roomData.hostId || null,
              isHost: roomData.hostId === playerId,
              roomUpdateVersion: roomData.version ?? get().roomUpdateVersion,
            });
          }
          resolve({ success: true });
        }
      });
    });
  },

  closeRoomAsHost: async () => {
    const { socket, roomId, isHost } = get();
    if (!socket || !roomId) return { success: false, error: "Not in a room" };
    if (!isHost) return { success: false, error: "Only the host can close the room" };
    return new Promise((resolve) => {
      socket.emit("closeRoomAsHost", { roomId }, (err: any) => {
        if (err) resolve({ success: false, error: err.message || err.code });
        else {
          clearActiveRoomSession();
          set({
            roomId: null,
            roomCode: null,
            isHost: false,
            hostId: null,
            state: null,
            playersInRoom: [],
            spectatorsInRoom: [],
            gameStarted: false,
          });
          resolve({ success: true });
        }
      });
    });
  },

  resumeActiveRoom: async () => {
    const persisted = getPersistedActiveRoom();
    if (!persisted) return { success: false, error: "No active room" };
    const { playerId, playerName, roomId } = get();
    if (!playerId || !playerName) return { success: false, error: "Identity not set" };
    if (roomId) return { success: true };
    if (persisted.isSpectator) return get().joinAsSpectator(persisted.code);
    return get().joinRoom(persisted.code);
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
            hostId: roomData?.hostId || null,
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

  leaveRoom: async () => {
    const { socket, roomId } = get();
    if (!socket || !roomId) {
      clearActiveRoomSession();
      set({
        roomId: null,
        roomCode: null,
        isHost: false,
        hostId: null,
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
        roomUpdateVersion: 0,
      });
      return { success: true };
    }
    return new Promise((resolve) => {
      socket.emit("leaveRoom", { roomId }, (err: any) => {
        if (err?.code === "cannot_leave") {
          const message = err.message || "You cannot leave right now";
          set({ lastError: message });
          resolve({ success: false, error: message, code: err.code });
          return;
        }
        clearActiveRoomSession();
        set({
          roomId: null,
          roomCode: null,
          isHost: false,
          hostId: null,
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
          roomUpdateVersion: 0,
        });
        resolve({ success: true });
      });
    });
  },

  startGame: async () => {
    const { socket, roomId, playerId, isHost } = get();
    if (!socket || !roomId) return { success: false, error: "Not in a room" };
    if (!isHost) return { success: false, error: "Only the host can start the game" };
    
    return new Promise((resolve) => {
      socket.emit("startRoom", { roomId, by: playerId }, (err: any, snap: any) => {
        if (err) {
          const code = err.code || "start_failed";
          const message =
            code === "not_all_ready"
              ? "All players must ready up before starting"
              : err.message || "Start failed";
          set({ lastError: message });
          resolve({ success: false, error: message, code });
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
    const { socket, roomId, pendingIntent } = get();
    if (!socket || !roomId || pendingIntent) return;
    set({ pendingIntent: intent.type });
    socket.emit("intent", { roomId, intent }, (err: any) => {
      if (err) {
        set({ pendingIntent: null, lastError: err.message || "Action failed" });
      }
    });
  },
  
  requestNewRound: async () => {
    const { socket, roomId, playerId, isHost } = get();
    if (!socket || !roomId) return { success: false, error: "Not in a room" };
    if (!isHost) return { success: false, error: "Only the host can start a new round" };
    
    return new Promise((resolve) => {
      socket.emit("newRound", { roomId }, (err: any, snap: any) => {
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
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit("roundDecision", { roomId, decision: "stay" });
  },
  decideLeave: () => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit("roundDecision", { roomId, decision: "leave" });
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
    socket.emit("chatMessage", { roomId, message: message.trim() }, (err: any) => {
      if (err) {
        set({ lastError: formatSocketError(err.code, err.message) });
      }
    });
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
    const now = Date.now();
    if (get().emoteCooldownUntil && now < (get().emoteCooldownUntil || 0)) return;
    socket.emit("sendEmote", { roomId, emote: emote.trim() }, (err: any) => {
      if (err?.code === "rate_limited") {
        set({
          lastError: formatSocketError(err.code, err.message),
          emoteCooldownUntil: now + 500,
        });
        setTimeout(() => set({ emoteCooldownUntil: null }), 500);
      } else if (err) {
        set({ lastError: formatSocketError(err.code, err.message) });
      }
    });
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
  joinAsSpectator: async (roomId, password): Promise<{ success: boolean; error?: string; code?: string }> => {
    if (joinSpectatorInFlight) return await joinSpectatorInFlight;

    const promise = (async (): Promise<{ success: boolean; error?: string; code?: string }> => {
    const { socket, playerId, playerName, playerAvatar, roomId: currentRoomId } = get();
    if (!socket) return { success: false, error: "Not connected" };
    if (!playerId || !playerName) return { success: false, error: "Identity not set" };
    
    if (currentRoomId && currentRoomId !== roomId) {
      get().clearRoomState();
    }
    
    return new Promise((resolve) => {
      socket.emit("joinAsSpectator", {
        roomId,
        spectator: { id: playerId, name: playerName, avatar: playerAvatar || undefined },
        password: password?.trim() || undefined,
      }, (err: any, snap: any, roomData: any) => {
        if (err) {
          set({ lastError: err.message || "Join as spectator failed" });
          resolve({ success: false, error: err.message || err.code, code: err.code });
        } else {
          const resolvedRoomId = roomData?.roomId || roomId;
          const resolvedCode = roomData?.code || roomId.toUpperCase();
          persistActiveRoom(resolvedCode, resolvedRoomId, true);
          const incomingVersion = typeof snap?.version === "number" ? snap.version : 0;
          const { version: _v, ...gameState } = snap || {};
          const players: PlayerInfo[] = roomData?.players || [];
          const spectators: PlayerInfo[] = roomData?.spectators || [];
          
          set({ 
            roomId: resolvedRoomId,
            roomCode: resolvedCode,
            isHost: false,
            isSpectator: true,
            state: snap ? (gameState as GameState) : null,
            gameStateVersion: incomingVersion,
            playersInRoom: players,
            spectatorsInRoom: spectators,
            gameStarted: snap?.phase !== "Lobby" && snap?.phase !== undefined,
            lastError: null,
            roomUpdateVersion: roomData?.version ?? 0,
          });
          resolve({ success: true });
        }
      });
    });
    })();

    joinSpectatorInFlight = promise;
    try {
      return await promise;
    } finally {
      joinSpectatorInFlight = null;
    }
  },
  
  leaveSpectator: () => {
    const { socket, roomId } = get();
    if (socket && roomId) {
      socket.emit("leaveSpectator", { roomId });
    }
    set({
      roomId: null,
      isHost: false,
      hostId: null,
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
      chatMutedAll: false,
      chatMutedPlayerIds: [],
    });
  },

  reportPlayer: (targetId, reason) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return Promise.resolve({ success: false, error: "Not in a room" });
    return new Promise((resolve) => {
      socket.emit("reportPlayer", { roomId, targetId, reason }, (err: any) => {
        if (err) resolve({ success: false, error: formatSocketError(err.code, err.message) });
        else resolve({ success: true });
      });
    });
  },

  banPlayer: (targetId) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return Promise.resolve({ success: false, error: "Not in a room" });
    return new Promise((resolve) => {
      socket.emit("banPlayer", { roomId, targetId }, (err: any) => {
        if (err) resolve({ success: false, error: formatSocketError(err.code, err.message), code: err.code });
        else resolve({ success: true });
      });
    });
  },

  setRoomChatMuted: (muted) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return Promise.resolve({ success: false, error: "Not in a room" });
    return new Promise((resolve) => {
      socket.emit("setRoomChatMuted", { roomId, muted }, (err: any, roomData: any) => {
        if (err) resolve({ success: false, error: formatSocketError(err.code, err.message) });
        else {
          set({
            chatMutedAll: !!roomData?.chatMutedAll,
            chatMutedPlayerIds: roomData?.chatMutedPlayerIds || [],
          });
          resolve({ success: true });
        }
      });
    });
  },

  mutePlayerChat: (targetId, muted) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return Promise.resolve({ success: false, error: "Not in a room" });
    return new Promise((resolve) => {
      socket.emit("mutePlayerChat", { roomId, targetId, muted }, (err: any, roomData: any) => {
        if (err) resolve({ success: false, error: formatSocketError(err.code, err.message) });
        else {
          set({
            chatMutedAll: !!roomData?.chatMutedAll,
            chatMutedPlayerIds: roomData?.chatMutedPlayerIds || [],
          });
          resolve({ success: true });
        }
      });
    });
  },
}));
