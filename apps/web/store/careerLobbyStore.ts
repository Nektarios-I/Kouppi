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
  queuePollInterval: ReturnType<typeof setInterval> | null;
  matchFound: MatchFoundData | null;
  currentRoom: CareerRoomState | null;
  isJoiningRoom: boolean;
  gameRoomId: string | null;
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
  clearError: () => void;
  reset: () => void;
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
  queuePollInterval: null,
  matchFound: null,
  currentRoom: null,
  isJoiningRoom: false,
  gameRoomId: null,
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
      set({
        queueState: {
          inQueue: true,
          position: data.position,
          waitTime: data.waitTime ?? 0,
          searchRange: data.searchRange ?? 100,
          queueSize: data.queueSize ?? 0,
          anteId: data.anteId,
          tierId: data.tierId,
          fallbackMode: data.fallbackMode,
        },
        isJoiningQueue: false,
      });
      const { authToken } = get();
      if (authToken) get().startQueuePolling(authToken);
    });

    newSocket.on("career:queueStatus", (data: QueueState) => {
      if (get().matchFound) return;
      set({ queueState: data.inQueue ? data : null });
    });

    newSocket.on("career:matchFound", (data: MatchFoundData) => {
      set({ matchFound: data, queueState: null });
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
    const { socket } = get();
    if (!socket?.connected) {
      set({ error: "Not connected to server" });
      return false;
    }
    set({ isJoiningQueue: true, error: null, authToken: token });
    return new Promise((resolve) => {
      socket.emit("career:joinAnte", { token, anteId }, (err: any) => {
        if (err) {
          set({ isJoiningQueue: false, error: err.message });
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  },

  leaveQueue: (token: string) => {
    const { socket, queueState } = get();
    if (!socket?.connected || !queueState?.inQueue) return;
    socket.emit("career:leaveQueue", { token }, (err: any) => {
      if (err) {
        set({ error: err.message });
        return;
      }
      set({ queueState: null, matchFound: null, isJoiningQueue: false });
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
    socket.emit("career:leaveRoom", { token }, (err: any) => {
      if (err) {
        set({ error: err.message });
        return;
      }
      set({ currentRoom: null, matchFound: null });
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
      queuePollInterval: null,
      matchFound: null,
      currentRoom: null,
      isJoiningRoom: false,
      gameRoomId: null,
      error: null,
    });
  },
}));
