/**
 * Career Lobby Store — queue-based matchmaking (Sprint 2)
 */

import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { formatConnectionError, getServerUrl, resolveServerUrl } from "@/lib/serverUrl";
import { isAuthFailureCode, parseSocketAck } from "@/lib/socketAck";
import { useAuthStore } from "./authStore";

function getApiUrl() {
  return getServerUrl();
}

function clearAuthIfNeeded(code?: string, message?: string) {
  if (!isAuthFailureCode(code)) return;
  useAuthStore.getState().clearStaleSession(
    message || "Your login session expired. Sign in again to use Career Mode."
  );
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
  avatarId: string;
  ready?: boolean;
  connected?: boolean;
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
    avatarId: string;
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
  setReady: (token: string, ready: boolean) => Promise<boolean>;
  listWaitingRooms: (token: string, anteId?: string) => Promise<void>;
  browseAllWaitingRooms: (token: string) => Promise<void>;
  createWaitingRoom: (token: string, anteId: string) => Promise<boolean>;
  joinWaitingRoom: (token: string, roomId: string) => Promise<boolean>;
  clearError: () => void;
  /** Clear waiting/game session pointers after leaving a Career in-game room. */
  clearGameSession: () => void;
  reset: () => void;
}

function applyQueueJoined(
  set: (partial: Partial<CareerLobbyState>) => void,
  get: () => CareerLobbyState,
  data: Partial<QueueState> & { anteId?: string; tierId?: string; position?: number; matched?: boolean }
) {
  // Never clobber an in-flight match / seated room with a late queue ACK
  if (get().matchFound || get().currentRoom) return;
  if (data.matched || data.inQueue === false) {
    set({ isJoiningQueue: false, queueState: null });
    return;
  }
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
    queueJoinedAt: get().queueJoinedAt ?? Date.now(),
    error: null,
  });
  const { authToken } = get();
  if (authToken) get().startQueuePolling(authToken);
}

const ACK_TIMEOUT_MS = 15000;

function withAckTimeout<T>(
  run: (finish: (result: T) => void) => void,
  onTimeout: () => T
): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(onTimeout());
    }, ACK_TIMEOUT_MS);
    run((result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    });
  });
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

    const resolved = resolveServerUrl();
    if (
      resolved.issue === "frontend_origin_fallback" ||
      resolved.issue === "missing_env_production" ||
      resolved.issue === "localhost_in_production" ||
      resolved.issue === "invalid_url"
    ) {
      set({
        isConnecting: false,
        isConnected: false,
        error: formatConnectionError("misconfigured server URL", resolved),
      });
      return;
    }

    // Reuse the existing Socket.IO client (multiplayer pattern) — do not spawn duplicates.
    if (socket) {
      set({ isConnecting: true, error: null, authToken: token });
      socket.connect();
      return;
    }

    set({ isConnecting: true, error: null, authToken: token });

    const newSocket = io(getApiUrl(), {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });

    newSocket.on("connect", () => {
      const authToken = get().authToken || token;
      set({ isConnected: true, isConnecting: false });
      newSocket.emit("career:auth", { token: authToken }, (err: unknown, data?: unknown) => {
        const parsed = parseSocketAck<{
          rating: number;
          bankroll: number;
          roomId?: string | null;
          room?: CareerRoomState | null;
        }>(err, data);
        if (!parsed.ok) {
          clearAuthIfNeeded(parsed.code, parsed.error);
          set({
            error: parsed.error || "Career authentication failed",
            isAuthenticated: false,
            tiers: [],
            isLoadingTiers: false,
          });
          return;
        }
        set({
          isAuthenticated: true,
          playerRating: parsed.data.rating,
          playerBankroll: parsed.data.bankroll,
          error: null,
          ...(parsed.data.room
            ? { currentRoom: parsed.data.room, matchFound: null }
            : !parsed.data.roomId && get().currentRoom
              ? { currentRoom: null }
              : {}),
        });
        void get().fetchTiers(authToken);
      });
    });

    newSocket.on("disconnect", () => {
      // Keep currentRoom like multiplayer — server holds the seat through reconnect grace.
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
      if (get().matchFound || get().currentRoom) return;
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
            status: "starting",
            autoStartAt: data.startsAt,
            secondsRemaining: data.secondsRemaining,
          },
        });
      }
    });

    newSocket.on("career:countdownCancelled", (data: { roomId: string; reason?: string }) => {
      const { currentRoom } = get();
      if (currentRoom?.roomId === data.roomId) {
        set({
          currentRoom: {
            ...currentRoom,
            status: "waiting",
            autoStartAt: null,
            secondsRemaining: null,
            players: currentRoom.players.map((p) => ({ ...p, ready: false })),
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
    set({ isLoadingTiers: true, error: null });

    const applyTiers = (payload: {
      tiers: Tier[];
      playerRating: number;
      playerBankroll: number;
    }) => {
      set({
        tiers: payload.tiers ?? [],
        playerRating: payload.playerRating,
        playerBankroll: payload.playerBankroll,
        isLoadingTiers: false,
        isAuthenticated: true,
        error: null,
      });
    };

    const fetchViaHttp = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/career/tiers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => null);
        if (res.status === 401) {
          clearAuthIfNeeded("auth_failed", body?.error);
          set({
            isLoadingTiers: false,
            isAuthenticated: false,
            tiers: [],
            error: body?.error || "Sign in again to load Career leagues",
          });
          return;
        }
        if (!res.ok || !body?.success || !Array.isArray(body.tiers)) {
          set({
            isLoadingTiers: false,
            error: body?.error || "Could not load Career leagues",
          });
          return;
        }
        applyTiers({
          tiers: body.tiers,
          playerRating: body.playerRating,
          playerBankroll: body.playerBankroll,
        });
      } catch {
        set({
          isLoadingTiers: false,
          error: "Could not load Career leagues — check your connection",
        });
      }
    };

    if (!socket?.connected) {
      void fetchViaHttp();
      return;
    }

    socket.emit("career:getTiers", { token }, (err: unknown, data?: unknown) => {
      const parsed = parseSocketAck<{
        tiers: Tier[];
        playerRating: number;
        playerBankroll: number;
      }>(err, data);
      if (!parsed.ok) {
        clearAuthIfNeeded(parsed.code, parsed.error);
        // Socket ack failed — try HTTP before giving up on an empty league list
        void fetchViaHttp();
        return;
      }
      if (!Array.isArray(parsed.data.tiers) || parsed.data.tiers.length === 0) {
        void fetchViaHttp();
        return;
      }
      applyTiers(parsed.data);
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
    return withAckTimeout<boolean>(
      (finish) => {
        socket.emit(
          "career:joinAnte",
          { token, anteId },
          (err: unknown, data?: unknown) => {
            const parsed = parseSocketAck<
              QueueState & { anteId?: string; tierId?: string; matched?: boolean }
            >(err, data);
            if (!parsed.ok) {
              clearAuthIfNeeded(parsed.code, parsed.error);
              set({
                isJoiningQueue: false,
                queueState: null,
                queueJoinedAt: null,
                error: parsed.error ?? "Could not join queue",
              });
              finish(false);
              return;
            }
            applyQueueJoined(set, get, { ...parsed.data, anteId: parsed.data.anteId ?? anteId });
            finish(true);
          }
        );
      },
      () => {
        set({
          isJoiningQueue: false,
          queueState: null,
          queueJoinedAt: null,
          error: "Queue request timed out — check your connection and try again",
        });
        return false;
      }
    );
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

  setReady: async (token: string, ready: boolean): Promise<boolean> => {
    const { socket, currentRoom } = get();
    if (!socket?.connected || !currentRoom) {
      set({ error: "Not in a Career waiting table" });
      return false;
    }
    return withAckTimeout<boolean>(
      (finish) => {
        socket.emit(
          "career:setReady",
          { token, ready },
          (err: unknown, data?: unknown) => {
            const parsed = parseSocketAck<{ success?: boolean; room?: CareerRoomState }>(err, data);
            if (!parsed.ok) {
              clearAuthIfNeeded(parsed.code, parsed.error);
              set({ error: parsed.error ?? "Could not update ready" });
              finish(false);
              return;
            }
            if (parsed.data.room) {
              set({ currentRoom: parsed.data.room, matchFound: null });
            }
            finish(true);
          }
        );
      },
      () => {
        set({ error: "Ready request timed out — check your connection and try again" });
        return false;
      }
    );
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
    return withAckTimeout<boolean>(
      (finish) => {
        socket.emit(
          "career:createWaitingRoom",
          { token, anteId },
          (err: unknown, data?: unknown) => {
            const parsed = parseSocketAck<{
              success?: boolean;
              roomId?: string;
              room?: CareerRoomState;
            }>(err, data);
            set({ isJoiningRoom: false });
            if (!parsed.ok) {
              clearAuthIfNeeded(parsed.code, parsed.error);
              set({ error: parsed.error ?? "Could not create waiting table" });
              finish(false);
              return;
            }
            if (parsed.data.room) {
              set({ currentRoom: parsed.data.room, matchFound: null, queueState: null });
            } else if (parsed.data.roomId) {
              // Room update event may still arrive; keep a minimal seat so UI advances
              set({
                currentRoom: {
                  roomId: parsed.data.roomId,
                  tierId: get().selectedTierId ?? "",
                  anteId,
                  ante: 0,
                  minBet: 0,
                  maxBet: 0,
                  status: "waiting",
                  players: [],
                  playerCount: 1,
                  maxPlayers: 2,
                  autoStartAt: null,
                  secondsRemaining: null,
                },
                matchFound: null,
                queueState: null,
              });
            }
            finish(true);
          }
        );
      },
      () => {
        set({
          isJoiningRoom: false,
          error: "Create table timed out — check your connection and try again",
        });
        return false;
      }
    );
  },

  joinWaitingRoom: async (token: string, roomId: string): Promise<boolean> => {
    const { socket, isJoiningRoom } = get();
    if (!socket?.connected) {
      set({ error: "Not connected to server" });
      return false;
    }
    if (isJoiningRoom) return false;
    set({ isJoiningRoom: true, error: null, authToken: token });
    return withAckTimeout<boolean>(
      (finish) => {
        socket.emit(
          "career:joinWaitingRoom",
          { token, roomId },
          (err: unknown, data?: unknown) => {
            const parsed = parseSocketAck<{
              success?: boolean;
              roomId?: string;
              room?: CareerRoomState;
            }>(err, data);
            set({ isJoiningRoom: false });
            if (!parsed.ok) {
              clearAuthIfNeeded(parsed.code, parsed.error);
              set({ error: parsed.error ?? "Could not join waiting table" });
              finish(false);
              return;
            }
            if (parsed.data.room) {
              set({ currentRoom: parsed.data.room, matchFound: null, queueState: null });
            }
            finish(true);
          }
        );
      },
      () => {
        set({
          isJoiningRoom: false,
          error: "Join table timed out — check your connection and try again",
        });
        return false;
      }
    );
  },

  clearError: () => set({ error: null }),

  clearGameSession: () => {
    set({
      gameRoomId: null,
      currentRoom: null,
      matchFound: null,
      queueState: null,
      isJoiningQueue: false,
      isJoiningRoom: false,
    });
  },

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
