/**
 * Career Lobby Store — queue-based matchmaking (Sprint 2)
 */

import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { formatConnectionError, getServerUrl } from "@/lib/serverUrl";

function getApiUrl() {
  return getServerUrl();
}

export interface AnteOption {
  id: string;
  ante: number;
  minBet: number;
  maxBet: number;
  buyIn: number;
  label: string;
  canAfford: boolean;
}

export interface Tier {
  id: string;
  name: string;
  emoji: string;
  minRating: number;
  maxRating: number | null;
  description: string;
  color: string;
  antes: AnteOption[];
  accessible: boolean;
}

export interface RoomPlayer {
  odlayerId?: string;
  odlayerName?: string;
  odlating?: number;
  userId: string;
  username: string;
  rating: number;
  avatarEmoji: string;
  avatarColor: string;
  avatarBorder: string;
}

export interface CareerRoomState {
  roomId: string;
  tierId: string;
  anteId: string;
  ante: number;
  minBet: number;
  maxBet: number;
  players: RoomPlayer[];
  playerCount: number;
  maxPlayers: number;
  status: "waiting" | "starting" | "in-game" | "finished";
  autoStartAt: number | null;
  secondsRemaining: number | null;
}

export interface QueueState {
  inQueue: boolean;
  position: number;
  waitTime: number;
  searchRange: number;
  queueSize: number;
  anteId?: string;
  tierId?: string;
  fallbackMode?: "expanded" | "cross-tier" | "quick-match";
}

export interface MatchFoundData {
  roomId: string;
  opponent: {
    username: string;
    rating: number;
    avatarEmoji: string;
    avatarColor: string;
    avatarBorder: string;
  };
}

export interface WaitingRoomSummary {
  roomId: string;
  tierId: string;
  tierName?: string;
  tierEmoji?: string;
  anteId: string;
  ante: number;
  anteLabel?: string;
  buyIn?: number;
  minBet?: number;
  maxBet?: number;
  playerCount: number;
  maxPlayers: number;
  status: "waiting" | "starting" | "in-game" | "finished";
  canJoin?: boolean;
  seatsOpen?: number;
}

interface CareerLobbyState {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  authToken: string | null;
  isAuthenticated: boolean;
  playerRating: number;
  playerBankroll: number;
  tiers: Tier[];
  selectedTierId: string | null;
  isLoadingTiers: boolean;
  queueState: QueueState | null;
  isJoiningQueue: boolean;
  queueJoinedAt: number | null;
  queuePollInterval: ReturnType<typeof setInterval> | null;
  matchFound: MatchFoundData | null;
  currentRoom: CareerRoomState | null;
  isJoiningRoom: boolean;
  gameRoomId: string | null;
  waitingRooms: WaitingRoomSummary[];
  isLoadingWaitingRooms: boolean;
  error: string | null;
  connect: (token: string) => void;
  disconnect: () => void;
  fetchTiers: (token: string) => void;
  selectTier: (tierId: string) => void;
  joinQueue: (token: string, anteId: string) => Promise<boolean>;
  leaveQueue: (token: string) => void;
  startQueuePolling: (token: string) => void;
  stopQueuePolling: () => void;
  leaveRoom: (token: string) => void;
  listWaitingRooms: (token: string, anteId?: string) => Promise<void>;
  browseAllWaitingRooms: (token: string) => Promise<void>;
  createWaitingRoom: (token: string, anteId: string) => Promise<boolean>;
  joinWaitingRoom: (token: string, roomId: string) => Promise<boolean>;
  clearError: () => void;
  reset: () => void;
}

function applyQueueJoined(
  set: (partial: Partial<CareerLobbyState>) => void,
  get: () => CareerLobbyState,
  data: Partial<QueueState> & { anteId?: string; tierId?: string; position?: number }
) {
  set({
    queueState: {
      inQueue: true,
      position: data.position ?? 1,
      waitTime: data.waitTime ?? 0,
      searchRange: data.searchRange ?? 100,
      queueSize: data.queueSize ?? 0,
      anteId: data.anteId,
      tierId: data.tierId,
      fallbackMode: data.fallbackMode,
    },
    isJoiningQueue: false,
    queueJoinedAt: Date.now(),
    error: null,
  });
  const { authToken } = get();
  if (authToken) get().startQueuePolling(authToken);
}

export const useCareerLobbyStore = create<CareerLobbyState>((set, get) => ({
  socket: null,
  isConnected: false,
  isConnecting: false,
  authToken: null,
  isAuthenticated: false,
  playerRating: 0,
  playerBankroll: 0,
  tiers: [],
  selectedTierId: null,
  isLoadingTiers: false,
  queueState: null,
  isJoiningQueue: false,
  queueJoinedAt: null,
  queuePollInterval: null,
  matchFound: null,
  currentRoom: null,
  isJoiningRoom: false,
  gameRoomId: null,
  waitingRooms: [],
  isLoadingWaitingRooms: false,
  error: null,

  connect: (token: string) => {
    const { socket } = get();
    if (socket?.connected) return;

    set({ isConnecting: true, error: null, authToken: token });

    const newSocket = io(getApiUrl(), {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    newSocket.on("connect", () => {
      set({ isConnected: true, isConnecting: false });
      newSocket.emit("career:auth", { token }, (err: any, data: any) => {
        if (err) {
          set({ error: err.message, isAuthenticated: false });
          return;
        }
        set({
          isAuthenticated: true,
          playerRating: data.rating,
          playerBankroll: data.bankroll,
        });
        get().fetchTiers(token);
      });
    });

    newSocket.on("disconnect", () => {
      set({ isConnected: false, isAuthenticated: false });
      get().stopQueuePolling();
    });

    newSocket.on("connect_error", (err) => {
      set({ isConnecting: false, error: formatConnectionError(err?.message) });
    });

    newSocket.on("career:roomUpdate", (data: CareerRoomState) => {
      set({ currentRoom: data, matchFound: null });
    });

    newSocket.on("career:queueJoined", (data: QueueState & { anteId: string; tierId: string }) => {
      applyQueueJoined(set, get, data);
    });

    newSocket.on("career:queueStatus", (data: QueueState) => {
      if (get().matchFound) return;
      set({ queueState: data.inQueue ? data : null, queueJoinedAt: data.inQueue ? get().queueJoinedAt : null });
    });

    newSocket.on("career:matchFound", (data: MatchFoundData) => {
      set({ matchFound: data, queueState: null, isJoiningQueue: false, queueJoinedAt: null });
      get().stopQueuePolling();
    });

    newSocket.on("career:autoStartTimer", (data: { roomId: string; startsAt: number; secondsRemaining: number }) => {
      const { currentRoom } = get();
      if (currentRoom?.roomId === data.roomId) {
        set({
          currentRoom: {
            ...currentRoom,
            autoStartAt: data.startsAt,
            secondsRemaining: data.secondsRemaining,
          },
        });
      }
    });

    newSocket.on("career:transitionToGame", (data: { gameRoomId: string }) => {
      set({ gameRoomId: data.gameRoomId });
    });

    newSocket.on("career:gameFinished", () => {
      set({ currentRoom: null, gameRoomId: null, matchFound: null });
    });

    newSocket.on("career:error", (err: { message: string }) => {
      set({ error: err.message, isJoiningQueue: false });
    });

    set({ socket: newSocket });
  },

  disconnect: () => {
    get().stopQueuePolling();
    const { socket } = get();
    if (socket && typeof socket.disconnect === "function") {
      socket.disconnect();
    }
    set({
      socket: null,
      isConnected: false,
      isAuthenticated: false,
      authToken: null,
      queueState: null,
      matchFound: null,
      currentRoom: null,
      gameRoomId: null,
    });
  },

  fetchTiers: (token: string) => {
    const { socket } = get();
    if (!socket?.connected) return;
    set({ isLoadingTiers: true, error: null });
    socket.emit("career:getTiers", { token }, (err: any, data: any) => {
      if (err) {
        set({ isLoadingTiers: false, error: err.message });
        return;
      }
      set({
        tiers: data.tiers,
        playerRating: data.playerRating,
        playerBankroll: data.playerBankroll,
        isLoadingTiers: false,
      });
    });
  },

  selectTier: (tierId: string) => {
    set({ selectedTierId: tierId || null, error: null });
  },

  joinQueue: async (token: string, anteId: string): Promise<boolean> => {
    const { socket, selectedTierId, isJoiningQueue, queueState } = get();
    if (!socket?.connected) {
      set({ error: "Not connected to server" });
      return false;
    }
    if (isJoiningQueue || queueState?.inQueue) {
      return false;
    }
    // Immediate feedback before ACK (CAREER-UX-001)
    set({
      isJoiningQueue: true,
      error: null,
      authToken: token,
      matchFound: null,
      queueJoinedAt: Date.now(),
      queueState: {
        inQueue: true,
        position: 0,
        waitTime: 0,
        searchRange: 100,
        queueSize: 0,
        anteId,
        tierId: selectedTierId ?? undefined,
      },
    });
    return new Promise((resolve) => {
      socket.emit(
        "career:joinAnte",
        { token, anteId },
        (err: { message?: string } | null, data?: QueueState & { anteId?: string; tierId?: string }) => {
          if (err) {
            set({
              isJoiningQueue: false,
              queueState: null,
              queueJoinedAt: null,
              error: err.message ?? "Could not join queue",
            });
            resolve(false);
            return;
          }
          if (data) {
            applyQueueJoined(set, get, { ...data, anteId: data.anteId ?? anteId });
          } else {
            set({ isJoiningQueue: false });
          }
          resolve(true);
        }
      );
    });
  },

  leaveQueue: (token: string) => {
    const { socket, queueState } = get();
    if (!socket?.connected || !queueState?.inQueue) {
      set({ queueState: null, isJoiningQueue: false, queueJoinedAt: null });
      return;
    }
    socket.emit("career:leaveQueue", { token }, (err: { message?: string } | null) => {
      if (err) {
        set({ error: err.message ?? "Could not leave queue" });
        return;
      }
      set({ queueState: null, matchFound: null, isJoiningQueue: false, queueJoinedAt: null });
      get().stopQueuePolling();
    });
  },

  startQueuePolling: (token: string) => {
    const { socket, queuePollInterval } = get();
    if (!socket?.connected) return;
    if (queuePollInterval) clearInterval(queuePollInterval);

    const interval = setInterval(() => {
      const { socket: currentSocket, queueState, matchFound } = get();
      if (!currentSocket?.connected || !queueState?.inQueue || matchFound) {
        get().stopQueuePolling();
        return;
      }
      currentSocket.emit("career:getQueueStatus", { token }, (err: any, data: QueueState) => {
        if (err || get().matchFound) return;
        if (data?.inQueue) {
          set({ queueState: data });
        } else {
          set({ queueState: null });
          get().stopQueuePolling();
        }
      });
    }, 2000);

    set({ queuePollInterval: interval });
  },

  stopQueuePolling: () => {
    const { queuePollInterval } = get();
    if (queuePollInterval) {
      clearInterval(queuePollInterval);
      set({ queuePollInterval: null });
    }
  },

  leaveRoom: (token: string) => {
    const { socket, currentRoom } = get();
    if (!socket?.connected || !currentRoom) return;
    socket.emit("career:leaveRoom", { token }, (err: { message?: string } | null) => {
      if (err) {
        set({ error: err.message ?? "Could not leave room" });
        return;
      }
      set({ currentRoom: null, matchFound: null });
    });
  },

  listWaitingRooms: async (token: string, anteId?: string): Promise<void> => {
    const { socket } = get();
    if (!socket?.connected) {
      set({ error: "Not connected to server" });
      return;
    }
    set({ isLoadingWaitingRooms: true, error: null });
    return new Promise((resolve) => {
      const payload = anteId ? { token, anteId } : { token };
      socket.emit(
        "career:listWaitingRooms",
        payload,
        (err: { message?: string } | null, data?: { rooms?: WaitingRoomSummary[] }) => {
          if (err) {
            set({ isLoadingWaitingRooms: false, error: err.message ?? "Could not list tables" });
            resolve();
            return;
          }
          set({
            waitingRooms: (data?.rooms ?? []).filter((r) => r.status === "waiting"),
            isLoadingWaitingRooms: false,
          });
          resolve();
        }
      );
    });
  },

  browseAllWaitingRooms: async (token: string): Promise<void> => {
    return get().listWaitingRooms(token);
  },

  createWaitingRoom: async (token: string, anteId: string): Promise<boolean> => {
    const { socket, isJoiningRoom } = get();
    if (!socket?.connected) {
      set({ error: "Not connected to server" });
      return false;
    }
    if (isJoiningRoom) return false;
    set({ isJoiningRoom: true, error: null, authToken: token });
    return new Promise((resolve) => {
      socket.emit(
        "career:createWaitingRoom",
        { token, anteId },
        (err: { message?: string } | null) => {
          set({ isJoiningRoom: false });
          if (err) {
            set({ error: err.message ?? "Could not create waiting table" });
            resolve(false);
            return;
          }
          resolve(true);
        }
      );
    });
  },

  joinWaitingRoom: async (token: string, roomId: string): Promise<boolean> => {
    const { socket, isJoiningRoom } = get();
    if (!socket?.connected) {
      set({ error: "Not connected to server" });
      return false;
    }
    if (isJoiningRoom) return false;
    set({ isJoiningRoom: true, error: null, authToken: token });
    return new Promise((resolve) => {
      socket.emit(
        "career:joinWaitingRoom",
        { token, roomId },
        (err: { message?: string } | null) => {
          set({ isJoiningRoom: false });
          if (err) {
            set({ error: err.message ?? "Could not join waiting table" });
            resolve(false);
            return;
          }
          resolve(true);
        }
      );
    });
  },

  clearError: () => set({ error: null }),

  reset: () => {
    get().stopQueuePolling();
    const { socket } = get();
    if (socket && typeof socket.disconnect === "function") {
      socket.disconnect();
    }
    set({
      socket: null,
      isConnected: false,
      isConnecting: false,
      authToken: null,
      isAuthenticated: false,
      playerRating: 0,
      playerBankroll: 0,
      tiers: [],
      selectedTierId: null,
      isLoadingTiers: false,
      queueState: null,
      isJoiningQueue: false,
      queueJoinedAt: null,
      queuePollInterval: null,
      matchFound: null,
      currentRoom: null,
      isJoiningRoom: false,
      gameRoomId: null,
      waitingRooms: [],
      isLoadingWaitingRooms: false,
      error: null,
    });
  },
}));
