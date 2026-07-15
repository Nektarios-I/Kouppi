/**
 * Ephemeral online presence — Redis when REDIS_URL is set, in-memory fallback otherwise.
 */

export type PresenceStatus =
  | "offline"
  | "lobby"
  | "in_room"
  | "in_game"
  | "career_queue"
  | "career_room";

export type UserPresence = {
  userId: string;
  status: PresenceStatus;
  roomCode?: string;
  roomId?: string;
  lastSeen: number;
};

const PRESENCE_TTL_SEC = 60;
const OFFLINE_GRACE_MS = 30_000;

type PresenceStore = {
  set(userId: string, presence: UserPresence): Promise<void>;
  get(userId: string): Promise<UserPresence | null>;
  getMany(userIds: string[]): Promise<Map<string, UserPresence>>;
  remove(userId: string): Promise<void>;
};

/** In-memory fallback for dev / single-node */
class InMemoryPresenceStore implements PresenceStore {
  private data = new Map<string, UserPresence>();
  private pendingOffline = new Map<string, ReturnType<typeof setTimeout>>();

  async set(userId: string, presence: UserPresence): Promise<void> {
    const pending = this.pendingOffline.get(userId);
    if (pending) {
      clearTimeout(pending);
      this.pendingOffline.delete(userId);
    }
    if (presence.status === "offline") {
      this.data.delete(userId);
      return;
    }
    this.data.set(userId, presence);
  }

  async get(userId: string): Promise<UserPresence | null> {
    return this.data.get(userId) ?? null;
  }

  async getMany(userIds: string[]): Promise<Map<string, UserPresence>> {
    const result = new Map<string, UserPresence>();
    for (const id of userIds) {
      const p = this.data.get(id);
      if (p) result.set(id, p);
    }
    return result;
  }

  async remove(userId: string): Promise<void> {
    this.data.delete(userId);
    const pending = this.pendingOffline.get(userId);
    if (pending) {
      clearTimeout(pending);
      this.pendingOffline.delete(userId);
    }
  }

  scheduleOffline(userId: string, onOffline: () => void): void {
    const pending = this.pendingOffline.get(userId);
    if (pending) clearTimeout(pending);
    const timer = setTimeout(() => {
      this.pendingOffline.delete(userId);
      this.data.delete(userId);
      onOffline();
    }, OFFLINE_GRACE_MS);
    this.pendingOffline.set(userId, timer);
  }

  cancelOfflineGrace(userId: string): void {
    const pending = this.pendingOffline.get(userId);
    if (pending) {
      clearTimeout(pending);
      this.pendingOffline.delete(userId);
    }
  }
}

/** Redis-backed presence for multi-node */
class RedisPresenceStore implements PresenceStore {
  private client: {
    hSet: (key: string, data: Record<string, string>) => Promise<number>;
    hGetAll: (key: string) => Promise<Record<string, string>>;
    expire: (key: string, seconds: number) => Promise<boolean>;
    del: (key: string) => Promise<number>;
    sAdd: (key: string, member: string) => Promise<number>;
    sRem: (key: string, member: string) => Promise<number>;
  };

  constructor(client: RedisPresenceStore["client"]) {
    this.client = client;
  }

  private key(userId: string): string {
    return `presence:${userId}`;
  }

  async set(userId: string, presence: UserPresence): Promise<void> {
    const key = this.key(userId);
    if (presence.status === "offline") {
      await this.client.del(key);
      await this.client.sRem("presence:online", userId);
      return;
    }
    await this.client.hSet(key, {
      userId: presence.userId,
      status: presence.status,
      roomCode: presence.roomCode ?? "",
      roomId: presence.roomId ?? "",
      lastSeen: String(presence.lastSeen),
    });
    await this.client.expire(key, PRESENCE_TTL_SEC);
    await this.client.sAdd("presence:online", userId);
  }

  async get(userId: string): Promise<UserPresence | null> {
    const data = await this.client.hGetAll(this.key(userId));
    if (!data.userId) return null;
    return {
      userId: data.userId,
      status: data.status as PresenceStatus,
      roomCode: data.roomCode || undefined,
      roomId: data.roomId || undefined,
      lastSeen: Number(data.lastSeen),
    };
  }

  async getMany(userIds: string[]): Promise<Map<string, UserPresence>> {
    const result = new Map<string, UserPresence>();
    await Promise.all(
      userIds.map(async (id) => {
        const p = await this.get(id);
        if (p) result.set(id, p);
      })
    );
    return result;
  }

  async remove(userId: string): Promise<void> {
    await this.set(userId, { userId, status: "offline", lastSeen: Date.now() });
  }
}

let store: PresenceStore = new InMemoryPresenceStore();
let inMemoryStore: InMemoryPresenceStore | null = new InMemoryPresenceStore();
const offlineCallbacks = new Map<string, Set<() => void>>();

export function onPresenceOffline(userId: string, cb: () => void): () => void {
  if (!offlineCallbacks.has(userId)) offlineCallbacks.set(userId, new Set());
  offlineCallbacks.get(userId)!.add(cb);
  return () => offlineCallbacks.get(userId)?.delete(cb);
}

function notifyOffline(userId: string): void {
  const cbs = offlineCallbacks.get(userId);
  if (cbs) {
    for (const cb of cbs) cb();
    offlineCallbacks.delete(userId);
  }
}

/** Attach Redis presence store when client is available. */
export function initPresenceStore(redisClient?: RedisPresenceStore["client"]): void {
  if (redisClient) {
    store = new RedisPresenceStore(redisClient);
    inMemoryStore = null;
    console.log("[Presence] Redis store enabled");
  } else {
    store = inMemoryStore ?? new InMemoryPresenceStore();
    inMemoryStore = store as InMemoryPresenceStore;
    console.log("[Presence] In-memory store (single node)");
  }
}

export async function setUserPresence(presence: UserPresence): Promise<void> {
  await store.set(presence.userId, presence);
}

export async function refreshUserPresence(
  userId: string,
  patch: Partial<Omit<UserPresence, "userId">>
): Promise<UserPresence> {
  const existing = (await store.get(userId)) ?? {
    userId,
    status: "lobby" as PresenceStatus,
    lastSeen: Date.now(),
  };
  const updated: UserPresence = {
    ...existing,
    ...patch,
    userId,
    lastSeen: Date.now(),
  };
  await store.set(userId, updated);
  return updated;
}

export async function getUserPresence(userId: string): Promise<UserPresence | null> {
  return store.get(userId);
}

export async function getFriendsPresence(
  friendIds: string[]
): Promise<Map<string, UserPresence>> {
  return store.getMany(friendIds);
}

export async function clearUserPresence(userId: string): Promise<void> {
  await store.remove(userId);
}

/** Schedule offline after disconnect grace (in-memory only). */
export function schedulePresenceOffline(userId: string): void {
  if (inMemoryStore) {
    inMemoryStore.scheduleOffline(userId, () => notifyOffline(userId));
    return;
  }
  setTimeout(async () => {
    const current = await store.get(userId);
    if (current && Date.now() - current.lastSeen > OFFLINE_GRACE_MS) {
      await store.remove(userId);
      notifyOffline(userId);
    }
  }, OFFLINE_GRACE_MS);
}

export function cancelPresenceOfflineGrace(userId: string): void {
  inMemoryStore?.cancelOfflineGrace(userId);
}
