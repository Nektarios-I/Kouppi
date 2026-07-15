/**
 * Friend system socket handlers — presence, invites, real-time notifications.
 */

import { Server, Socket } from "socket.io";
import { verifyToken } from "../auth/jwt.js";
import {
  getUserById,
  listFriends,
  getFriendRequestById,
  getFriendProfile,
  isFriend,
} from "@kouppi/database";
import {
  refreshUserPresence,
  getFriendsPresence,
  clearUserPresence,
  schedulePresenceOffline,
  cancelPresenceOfflineGrace,
  type UserPresence,
  type PresenceStatus,
} from "./presence.js";

const authenticatedSockets = new Map<string, { userId: string; username: string }>();
const userSocketCounts = new Map<string, number>();

function authenticateSocket(socket: Socket, token: string): { userId: string; username: string } | null {
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = getUserById(payload.userId);
  if (!user) return null;
  const info = { userId: user.id, username: user.username };
  authenticatedSockets.set(socket.id, info);
  return info;
}

function getSocketUser(socket: Socket): { userId: string; username: string } | null {
  return authenticatedSockets.get(socket.id) ?? null;
}

function userChannel(userId: string): string {
  return `user:${userId}`;
}

async function buildFriendsSnapshot(userId: string): Promise<{
  friends: ReturnType<typeof listFriends>;
  presence: Record<string, UserPresence>;
}> {
  const friends = listFriends(userId);
  const friendIds = friends.map((f: { id: string }) => f.id);
  const presenceMap = await getFriendsPresence(friendIds);
  const presence: Record<string, UserPresence> = {};
  for (const [id, p] of presenceMap) {
    presence[id] = p;
  }
  return { friends, presence };
}

function incrementUserSockets(userId: string): void {
  userSocketCounts.set(userId, (userSocketCounts.get(userId) ?? 0) + 1);
}

function decrementUserSockets(userId: string): number {
  const next = (userSocketCounts.get(userId) ?? 1) - 1;
  if (next <= 0) {
    userSocketCounts.delete(userId);
    return 0;
  }
  userSocketCounts.set(userId, next);
  return next;
}

/** Notify a user's personal channel */
export function emitToUser(io: Server, userId: string, event: string, data: unknown): void {
  io.to(userChannel(userId)).emit(event, data);
}

/** Update presence and broadcast to friends */
export async function updateAndBroadcastPresence(
  io: Server,
  userId: string,
  patch: Partial<Omit<UserPresence, "userId">>
): Promise<void> {
  const presence = await refreshUserPresence(userId, patch);
  const friends = listFriends(userId);
  for (const friend of friends) {
    emitToUser(io, friend.id, "friends:presence", { userId, presence });
  }
}

export function registerFriendHandlers(io: Server, socket: Socket): void {
  socket.on("friends:auth", async (payload: { token: string }, cb?: (err: unknown, data?: unknown) => void) => {
    const result = authenticateSocket(socket, payload.token);
    if (!result) {
      const err = { code: "auth_failed", message: "Invalid token" };
      cb ? cb(err) : socket.emit("friends:error", err);
      return;
    }

    incrementUserSockets(result.userId);
    cancelPresenceOfflineGrace(result.userId);
    await socket.join(userChannel(result.userId));
    await refreshUserPresence(result.userId, { status: "lobby" });

    const snapshot = await buildFriendsSnapshot(result.userId);
    const response = {
      userId: result.userId,
      username: result.username,
      ...snapshot,
    };
    cb ? cb(null, response) : socket.emit("friends:authenticated", response);
  });

  socket.on("friends:heartbeat", async (_payload: unknown, cb?: (err: unknown) => void) => {
    const user = getSocketUser(socket);
    if (!user) {
      cb?.({ code: "not_authenticated", message: "Authenticate first" });
      return;
    }
    const current = await refreshUserPresence(user.userId, {});
    cb?.(null);
    const friends = listFriends(user.userId);
    for (const friend of friends) {
      emitToUser(io, friend.id, "friends:presence", { userId: user.userId, presence: current });
    }
  });

  socket.on(
    "friends:invite",
    async (
      payload: { friendId: string; roomCode: string; roomId: string },
      cb?: (err: unknown) => void
    ) => {
      const user = getSocketUser(socket);
      if (!user) {
        cb?.({ code: "not_authenticated", message: "Authenticate first" });
        return;
      }
      if (!isFriend(user.userId, payload.friendId)) {
        cb?.({ code: "not_friends", message: "You can only invite friends" });
        return;
      }
      const friendProfile = getFriendProfile(user.userId, payload.friendId);
      emitToUser(io, payload.friendId, "friends:invite", {
        fromUserId: user.userId,
        fromUsername: user.username,
        roomCode: payload.roomCode,
        roomId: payload.roomId,
        timestamp: Date.now(),
      });
      cb?.(null);
    }
  );

  socket.on(
    "friends:setStatus",
    async (
      payload: { status: PresenceStatus; roomCode?: string; roomId?: string },
      cb?: (err: unknown) => void
    ) => {
      const user = getSocketUser(socket);
      if (!user) {
        cb?.({ code: "not_authenticated", message: "Authenticate first" });
        return;
      }
      await updateAndBroadcastPresence(io, user.userId, {
        status: payload.status,
        roomCode: payload.roomCode,
        roomId: payload.roomId,
      });
      cb?.(null);
    }
  );

  socket.on("friends:notifyRequest", (payload: { requestId: string }) => {
    const request = getFriendRequestById(payload.requestId);
    if (!request) return;
    emitToUser(io, request.toUserId, "friends:request", { request });
  });

  socket.on("friends:notifyAccepted", (payload: { requestId: string; friendId: string }) => {
    const request = getFriendRequestById(payload.requestId);
    if (!request) return;
    const accepterProfile = getFriendProfile(request.toUserId, request.fromUserId);
    const requesterProfile = getFriendProfile(request.fromUserId, request.toUserId);
    emitToUser(io, request.fromUserId, "friends:accepted", {
      request,
      friend: accepterProfile,
    });
    if (requesterProfile) {
      emitToUser(io, request.toUserId, "friends:accepted", {
        request,
        friend: requesterProfile,
      });
    }
  });

  socket.on("friends:notifyRemoved", (payload: { friendId: string }) => {
    const user = getSocketUser(socket);
    if (!user) return;
    emitToUser(io, payload.friendId, "friends:removed", { userId: user.userId });
  });

  socket.on("disconnect", async () => {
    const user = authenticatedSockets.get(socket.id);
    authenticatedSockets.delete(socket.id);
    if (!user) return;

    const remaining = decrementUserSockets(user.userId);
    if (remaining === 0) {
      schedulePresenceOffline(user.userId);
      const friends = listFriends(user.userId);
      setTimeout(async () => {
        const stillOffline = (userSocketCounts.get(user.userId) ?? 0) === 0;
        if (!stillOffline) return;
        await clearUserPresence(user.userId);
        for (const friend of friends) {
          emitToUser(io, friend.id, "friends:presence", {
            userId: user.userId,
            presence: { userId: user.userId, status: "offline", lastSeen: Date.now() },
          });
        }
      }, 30_500);
    }
  });
}

export function getAuthenticatedUserId(socketId: string): string | undefined {
  return authenticatedSockets.get(socketId)?.userId;
}
