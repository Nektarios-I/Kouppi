/**
 * Friends store — REST API + socket for friend list, requests, presence, invites.
 */

import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import type { FriendProfile, FriendRequestInfo, UserPresence, FriendsGameInvite } from "@kouppi/protocol";
import { useAuthStore } from "./authStore";

function getServerUrl(): string {
  return typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin.replace(":3000", ":4000")
    : process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
}

type SearchResult = {
  id: string;
  username: string;
  avatarEmoji: string;
  avatarColor: string;
  avatarBorder: string;
};

interface FriendsState {
  connected: boolean;
  friends: FriendProfile[];
  presence: Record<string, UserPresence>;
  incomingRequests: FriendRequestInfo[];
  outgoingRequests: FriendRequestInfo[];
  pendingInvite: FriendsGameInvite | null;
  searchResults: SearchResult[];
  error: string | null;
  loading: boolean;

  connect: () => void;
  disconnect: () => void;
  refreshFriends: () => Promise<void>;
  refreshRequests: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  sendRequest: (username: string) => Promise<{ ok: boolean; error?: string }>;
  acceptRequest: (requestId: string) => Promise<{ ok: boolean; error?: string }>;
  declineRequest: (requestId: string) => Promise<{ ok: boolean; error?: string }>;
  cancelRequest: (requestId: string) => Promise<{ ok: boolean; error?: string }>;
  removeFriend: (friendId: string) => Promise<{ ok: boolean; error?: string }>;
  inviteFriend: (friendId: string, roomCode: string, roomId: string) => Promise<{ ok: boolean; error?: string }>;
  clearPendingInvite: () => void;
  clearError: () => void;
}

let socket: Socket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${getServerUrl()}${path}`, { ...options, headers });
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  connected: false,
  friends: [],
  presence: {},
  incomingRequests: [],
  outgoingRequests: [],
  pendingInvite: null,
  searchResults: [],
  error: null,
  loading: false,

  connect: () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    if (socket?.connected) return;

    socket = io(getServerUrl(), { transports: ["websocket", "polling"], autoConnect: true });

    socket.on("connect", () => {
      socket?.emit("friends:auth", { token }, (err: unknown, data?: {
        friends: FriendProfile[];
        presence: Record<string, UserPresence>;
      }) => {
        if (err) {
          set({ connected: false, error: "Friends auth failed" });
          return;
        }
        set({
          connected: true,
          friends: data?.friends ?? [],
          presence: data?.presence ?? {},
          error: null,
        });
      });

      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        socket?.emit("friends:heartbeat");
      }, 30_000);
    });

    socket.on("disconnect", () => {
      set({ connected: false });
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    });

    socket.on("friends:request", (data: { request: FriendRequestInfo }) => {
      const req = data.request;
      set((s) => ({
        incomingRequests: [req, ...s.incomingRequests.filter((r) => r.id !== req.id)],
      }));
    });

    socket.on("friends:accepted", (data: { request: FriendRequestInfo; friend: FriendProfile }) => {
      set((s) => ({
        friends: [...s.friends.filter((f) => f.id !== data.friend.id), data.friend],
        incomingRequests: s.incomingRequests.filter((r) => r.id !== data.request.id),
        outgoingRequests: s.outgoingRequests.filter((r) => r.id !== data.request.id),
      }));
    });

    socket.on("friends:removed", (data: { userId: string }) => {
      set((s) => ({
        friends: s.friends.filter((f) => f.id !== data.userId),
        presence: Object.fromEntries(
          Object.entries(s.presence).filter(([id]) => id !== data.userId)
        ),
      }));
    });

    socket.on("friends:presence", (data: { userId: string; presence: UserPresence }) => {
      set((s) => ({
        presence: { ...s.presence, [data.userId]: data.presence },
      }));
    });

    socket.on("friends:invite", (data: FriendsGameInvite) => {
      set({ pendingInvite: data });
    });
  },

  disconnect: () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    socket?.disconnect();
    socket = null;
    set({ connected: false });
  },

  refreshFriends: async () => {
    try {
      const res = await apiFetch("/api/friends");
      const data = await res.json();
      if (data.success) set({ friends: data.friends });
    } catch {
      // ignore
    }
  },

  refreshRequests: async () => {
    try {
      const res = await apiFetch("/api/friends/requests");
      const data = await res.json();
      if (data.success) {
        set({
          incomingRequests: data.requests.incoming,
          outgoingRequests: data.requests.outgoing,
        });
      }
    } catch {
      // ignore
    }
  },

  searchUsers: async (query: string) => {
    if (query.trim().length < 2) {
      set({ searchResults: [] });
      return;
    }
    try {
      const res = await apiFetch(`/api/friends/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) set({ searchResults: data.results });
    } catch {
      set({ searchResults: [] });
    }
  },

  sendRequest: async (username: string) => {
    set({ loading: true, error: null });
    try {
      const res = await apiFetch("/api/friends/request", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!data.success) {
        set({ loading: false, error: data.error || data.code });
        return { ok: false, error: data.error };
      }
      await get().refreshRequests();
      socket?.emit("friends:notifyRequest", { requestId: data.request.id });
      set({ loading: false, searchResults: [] });
      return { ok: true };
    } catch {
      set({ loading: false, error: "Request failed" });
      return { ok: false, error: "Request failed" };
    }
  },

  acceptRequest: async (requestId: string) => {
    const res = await apiFetch("/api/friends/accept", {
      method: "POST",
      body: JSON.stringify({ requestId }),
    });
    const data = await res.json();
    if (!data.success) return { ok: false, error: data.error };
    await get().refreshFriends();
    await get().refreshRequests();
    socket?.emit("friends:notifyAccepted", { requestId, friendId: data.request.fromUserId });
    return { ok: true };
  },

  declineRequest: async (requestId: string) => {
    const res = await apiFetch("/api/friends/decline", {
      method: "POST",
      body: JSON.stringify({ requestId }),
    });
    const data = await res.json();
    if (!data.success) return { ok: false, error: data.error };
    await get().refreshRequests();
    return { ok: true };
  },

  cancelRequest: async (requestId: string) => {
    const res = await apiFetch("/api/friends/cancel", {
      method: "POST",
      body: JSON.stringify({ requestId }),
    });
    const data = await res.json();
    if (!data.success) return { ok: false, error: data.error };
    await get().refreshRequests();
    return { ok: true };
  },

  removeFriend: async (friendId: string) => {
    const res = await apiFetch(`/api/friends/${friendId}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.success) return { ok: false, error: data.error };
    set((s) => ({
      friends: s.friends.filter((f) => f.id !== friendId),
    }));
    socket?.emit("friends:notifyRemoved", { friendId });
    return { ok: true };
  },

  inviteFriend: async (friendId: string, roomCode: string, roomId: string) => {
    return new Promise((resolve) => {
      socket?.emit("friends:invite", { friendId, roomCode, roomId }, (err: { code?: string; message?: string } | null) => {
        if (err) resolve({ ok: false, error: err.code || err.message });
        else resolve({ ok: true });
      });
    });
  },

  clearPendingInvite: () => set({ pendingInvite: null }),
  clearError: () => set({ error: null }),
}));

export function presenceLabel(status: UserPresence["status"]): string {
  switch (status) {
    case "lobby": return "In lobby";
    case "in_room": return "In a room";
    case "in_game": return "In game";
    case "career_queue": return "Career queue";
    case "career_room": return "Career room";
    case "offline":
    default: return "Offline";
  }
}
