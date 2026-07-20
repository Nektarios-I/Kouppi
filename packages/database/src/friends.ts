import { v4 as uuidv4 } from "uuid";
import { getRawDb } from "./client.js";
import { getProfileById, getUserByUsername } from "./users.js";

export type FriendRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

export type FriendRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: number;
  respondedAt: number | null;
};

export type FriendProfile = {
  id: string;
  username: string;
  avatarEmoji: string;
  avatarColor: string;
  avatarBorder: string;
  friendsSince: number;
};

export type FriendRequestWithProfiles = FriendRequest & {
  fromUsername: string;
  toUsername: string;
};

function rowToRequest(row: Record<string, unknown>): FriendRequest {
  return {
    id: row.id as string,
    fromUserId: row.from_user_id as string,
    toUserId: row.to_user_id as string,
    status: row.status as FriendRequestStatus,
    createdAt: row.created_at as number,
    respondedAt: (row.responded_at as number | null) ?? null,
  };
}

function areFriends(userId: string, otherId: string): boolean {
  const db = getRawDb();
  const row = db
    .prepare("SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?")
    .get(userId, otherId);
  return !!row;
}

function hasPendingRequestBetween(a: string, b: string): FriendRequest | null {
  const db = getRawDb();
  const row = db
    .prepare(
      `SELECT * FROM friend_requests
       WHERE status = 'pending'
         AND ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))`
    )
    .get(a, b, b, a) as Record<string, unknown> | undefined;
  return row ? rowToRequest(row) : null;
}

/** Send a friend request by username. */
export function sendFriendRequest(
  fromUserId: string,
  target: { username?: string; userId?: string }
): { request: FriendRequest } | { error: string } {
  if (target.userId && target.userId === fromUserId) return { error: "cannot_friend_self" };
  if (target.username) {
    const user = getUserByUsername(target.username);
    if (!user) return { error: "user_not_found" };
    if (user.id === fromUserId) return { error: "cannot_friend_self" };
    target.userId = user.id;
  }
  if (!target.userId) return { error: "user_not_found" };

  if (areFriends(fromUserId, target.userId)) return { error: "already_friends" };
  const existing = hasPendingRequestBetween(fromUserId, target.userId);
  if (existing) {
    if (existing.fromUserId === fromUserId) return { error: "request_already_sent" };
    return { error: "incoming_request_pending" };
  }

  const db = getRawDb();
  // UNIQUE(from_user_id, to_user_id) keeps declined/cancelled rows — reopen instead of INSERT.
  const prior = db
    .prepare(
      `SELECT * FROM friend_requests
       WHERE from_user_id = ? AND to_user_id = ?
         AND status IN ('declined', 'cancelled')`
    )
    .get(fromUserId, target.userId) as Record<string, unknown> | undefined;

  if (prior) {
    const now = Date.now();
    db.prepare(
      `UPDATE friend_requests
       SET status = 'pending', created_at = ?, responded_at = NULL
       WHERE id = ?`
    ).run(now, prior.id);
    return {
      request: {
        id: prior.id as string,
        fromUserId,
        toUserId: target.userId,
        status: "pending",
        createdAt: now,
        respondedAt: null,
      },
    };
  }

  const request: FriendRequest = {
    id: uuidv4(),
    fromUserId,
    toUserId: target.userId,
    status: "pending",
    createdAt: Date.now(),
    respondedAt: null,
  };

  db.prepare(
    `INSERT INTO friend_requests (id, from_user_id, to_user_id, status, created_at)
     VALUES (?, ?, ?, 'pending', ?)`
  ).run(request.id, request.fromUserId, request.toUserId, request.createdAt);

  return { request };
}

/** Accept a pending friend request (recipient only). */
export function acceptFriendRequest(
  requestId: string,
  userId: string
): { request: FriendRequest } | { error: string } {
  const db = getRawDb();
  const row = db.prepare("SELECT * FROM friend_requests WHERE id = ?").get(requestId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return { error: "request_not_found" };
  const request = rowToRequest(row);
  if (request.toUserId !== userId) return { error: "not_authorized" };
  if (request.status !== "pending") return { error: "request_not_pending" };

  const now = Date.now();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE friend_requests SET status = 'accepted', responded_at = ? WHERE id = ?`
    ).run(now, requestId);
    db.prepare(
      `INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)`
    ).run(request.fromUserId, request.toUserId, now);
    db.prepare(
      `INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)`
    ).run(request.toUserId, request.fromUserId, now);
  });
  tx();

  return {
    request: { ...request, status: "accepted", respondedAt: now },
  };
}

/** Decline a pending friend request (recipient only). */
export function declineFriendRequest(
  requestId: string,
  userId: string
): { request: FriendRequest } | { error: string } {
  const db = getRawDb();
  const row = db.prepare("SELECT * FROM friend_requests WHERE id = ?").get(requestId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return { error: "request_not_found" };
  const request = rowToRequest(row);
  if (request.toUserId !== userId) return { error: "not_authorized" };
  if (request.status !== "pending") return { error: "request_not_pending" };

  const now = Date.now();
  db.prepare(
    `UPDATE friend_requests SET status = 'declined', responded_at = ? WHERE id = ?`
  ).run(now, requestId);

  return { request: { ...request, status: "declined", respondedAt: now } };
}

/** Cancel an outgoing pending request (sender only). */
export function cancelFriendRequest(
  requestId: string,
  userId: string
): { request: FriendRequest } | { error: string } {
  const db = getRawDb();
  const row = db.prepare("SELECT * FROM friend_requests WHERE id = ?").get(requestId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return { error: "request_not_found" };
  const request = rowToRequest(row);
  if (request.fromUserId !== userId) return { error: "not_authorized" };
  if (request.status !== "pending") return { error: "request_not_pending" };

  const now = Date.now();
  db.prepare(
    `UPDATE friend_requests SET status = 'cancelled', responded_at = ? WHERE id = ?`
  ).run(now, requestId);

  return { request: { ...request, status: "cancelled", respondedAt: now } };
}

/** Remove a friend (both directions). */
export function removeFriend(userId: string, friendId: string): { ok: true } | { error: string } {
  if (userId === friendId) return { error: "cannot_friend_self" };
  if (!areFriends(userId, friendId)) return { error: "not_friends" };

  const db = getRawDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM friendships WHERE user_id = ? AND friend_id = ?").run(userId, friendId);
    db.prepare("DELETE FROM friendships WHERE user_id = ? AND friend_id = ?").run(friendId, userId);
  });
  tx();
  return { ok: true };
}

/** List friends with profile info. */
export function listFriends(userId: string): FriendProfile[] {
  const db = getRawDb();
  const rows = db
    .prepare(
      `SELECT f.friend_id, f.created_at, u.username, u.avatar_emoji, u.avatar_color, u.avatar_border
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = ?
       ORDER BY u.username COLLATE NOCASE`
    )
    .all(userId) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.friend_id as string,
    username: row.username as string,
    avatarEmoji: row.avatar_emoji as string,
    avatarColor: row.avatar_color as string,
    avatarBorder: row.avatar_border as string,
    friendsSince: row.created_at as number,
  }));
}

/** List pending requests (incoming + outgoing). */
export function listPendingRequests(userId: string): {
  incoming: FriendRequestWithProfiles[];
  outgoing: FriendRequestWithProfiles[];
} {
  const db = getRawDb();
  const rows = db
    .prepare(
      `SELECT r.*, fu.username AS from_username, tu.username AS to_username
       FROM friend_requests r
       JOIN users fu ON fu.id = r.from_user_id
       JOIN users tu ON tu.id = r.to_user_id
       WHERE r.status = 'pending' AND (r.from_user_id = ? OR r.to_user_id = ?)
       ORDER BY r.created_at DESC`
    )
    .all(userId, userId) as Record<string, unknown>[];

  const incoming: FriendRequestWithProfiles[] = [];
  const outgoing: FriendRequestWithProfiles[] = [];

  for (const row of rows) {
    const req: FriendRequestWithProfiles = {
      ...rowToRequest(row),
      fromUsername: row.from_username as string,
      toUsername: row.to_username as string,
    };
    if (req.toUserId === userId) incoming.push(req);
    else outgoing.push(req);
  }

  return { incoming, outgoing };
}

/** Search users by username prefix (for add-friend). */
export function searchUsersByUsername(
  query: string,
  excludeUserId: string,
  limit = 10
): Array<{ id: string; username: string; avatarEmoji: string; avatarColor: string; avatarBorder: string }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const db = getRawDb();
  const rows = db
    .prepare(
      `SELECT id, username, avatar_emoji, avatar_color, avatar_border
       FROM users
       WHERE username LIKE ? COLLATE NOCASE AND id != ?
       ORDER BY username COLLATE NOCASE
       LIMIT ?`
    )
    .all(`${trimmed}%`, excludeUserId, limit) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as string,
    username: row.username as string,
    avatarEmoji: row.avatar_emoji as string,
    avatarColor: row.avatar_color as string,
    avatarBorder: row.avatar_border as string,
  }));
}

/** Get friend request by id (for socket notifications). */
export function getFriendRequestById(requestId: string): FriendRequestWithProfiles | null {
  const db = getRawDb();
  const row = db
    .prepare(
      `SELECT r.*, fu.username AS from_username, tu.username AS to_username
       FROM friend_requests r
       JOIN users fu ON fu.id = r.from_user_id
       JOIN users tu ON tu.id = r.to_user_id
       WHERE r.id = ?`
    )
    .get(requestId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    ...rowToRequest(row),
    fromUsername: row.from_username as string,
    toUsername: row.to_username as string,
  };
}

/** Check if two users are friends. */
export function isFriend(userId: string, otherId: string): boolean {
  return areFriends(userId, otherId);
}

/** Get friend profile by id if they are friends. */
export function getFriendProfile(userId: string, friendId: string): FriendProfile | null {
  if (!areFriends(userId, friendId)) return null;
  const profile = getProfileById(friendId);
  if (!profile) return null;
  const db = getRawDb();
  const row = db
    .prepare("SELECT created_at FROM friendships WHERE user_id = ? AND friend_id = ?")
    .get(userId, friendId) as { created_at: number } | undefined;
  return {
    id: profile.id,
    username: profile.username,
    avatarEmoji: profile.avatarEmoji,
    avatarColor: profile.avatarColor,
    avatarBorder: profile.avatarBorder,
    friendsSince: row?.created_at ?? Date.now(),
  };
}
