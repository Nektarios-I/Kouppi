import type { Room } from "../types.js";
import { InMemoryRoomStore } from "./roomStore.js";
import { serializeRoom, deserializeRoom, mergeRoomSnapshot } from "./roomSnapshot.js";

export type RedisClient = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  keys: (pattern: string) => Promise<string[]>;
  hSet: (key: string, data: Record<string, string>) => Promise<number>;
  hGet: (key: string, field: string) => Promise<string | undefined>;
  hDel: (key: string, field: string) => Promise<number>;
  hGetAll: (key: string) => Promise<Record<string, string>>;
  expire: (key: string, seconds: number) => Promise<boolean>;
};

const ROOM_TTL_SEC = 24 * 60 * 60;
const ROOM_KEY_PREFIX = "room:data:";
const CODE_KEY_PREFIX = "room:code:";
const LOBBY_KEY = "room:lobby";

function roomKey(id: string): string {
  return `${ROOM_KEY_PREFIX}${id}`;
}

function codeKey(code: string): string {
  return `${CODE_KEY_PREFIX}${code}`;
}

/**
 * Redis-backed room store with in-memory cache for runtime handles (timers).
 * Authoritative game state is replicated to Redis for cross-node lobby listing and recovery.
 */
export class RedisRoomStore extends InMemoryRoomStore {
  private redis: RedisClient;
  private serverId: string;
  private syncEnabled = true;

  constructor(redis: RedisClient, serverId?: string) {
    super();
    this.redis = redis;
    this.serverId = serverId ?? `srv_${process.pid}`;
  }

  isDistributed(): boolean {
    return true;
  }

  override get(id: string): Room | undefined {
    const local = super.get(id);
    if (local) return local;

    // Lazy-load from Redis (sync — blocking via deasync not available; use cached only)
    // Async hydration happens via hydrateRoomFromRedis()
    return undefined;
  }

  /** Load room from Redis into local cache (call before mutations on remote-owned rooms). */
  async hydrateRoom(id: string): Promise<Room | undefined> {
    const local = super.get(id);
    if (local) return local;

    const json = await this.redis.get(roomKey(id));
    if (!json) return undefined;

    const snapshot = deserializeRoom(json);
    const merged = mergeRoomSnapshot(undefined, snapshot);
    super.set(id, merged);
    super.registerCode(merged);
    return merged;
  }

  /** Hydrate all rooms from Redis for lobby listing across nodes. */
  async hydrateAllFromRedis(): Promise<void> {
    const keys = await this.redis.keys(`${ROOM_KEY_PREFIX}*`);
    for (const key of keys) {
      const id = key.slice(ROOM_KEY_PREFIX.length);
      if (!super.has(id)) {
        await this.hydrateRoom(id);
      }
    }
  }

  override set(id: string, room: Room): void {
    super.set(id, room);
    if (this.syncEnabled) {
      void this.persistRoom(room);
    }
  }

  override delete(id: string): void {
    const room = super.get(id);
    if (room) {
      super.unregisterCode(room);
      void this.removeRoom(room);
    }
    super.delete(id);
  }

  override registerCode(room: Room): void {
    super.registerCode(room);
    void this.redis.set(codeKey(this.normalizeCode(room.code)), room.id);
    void this.redis.expire(codeKey(this.normalizeCode(room.code)), ROOM_TTL_SEC);
  }

  override unregisterCode(room: Room): void {
    super.unregisterCode(room);
    void this.redis.del(codeKey(this.normalizeCode(room.code)));
  }

  override resolveCode(code: string): string | undefined {
    const normalized = this.normalizeCode(code);
    const local = super.resolveCode(normalized);
    if (local) return local;
    return undefined;
  }

  /** Async code resolution from Redis */
  async resolveCodeAsync(code: string): Promise<string | undefined> {
    const normalized = this.normalizeCode(code);
    const local = super.resolveCode(normalized);
    if (local) return local;
    const remote = await this.redis.get(codeKey(normalized));
    return remote ?? undefined;
  }

  override clear(): void {
    super.clear();
  }

  private async persistRoom(room: Room): Promise<void> {
    try {
      const json = serializeRoom(room);
      await this.redis.set(roomKey(room.id), json);
      await this.redis.expire(roomKey(room.id), ROOM_TTL_SEC);
      await this.redis.hSet(LOBBY_KEY, {
        [room.id]: JSON.stringify(this.toLobbyMeta(room)),
      });
      await this.redis.hSet(`room:owner:${room.id}`, { serverId: this.serverId, updatedAt: String(Date.now()) });
      await this.redis.expire(`room:owner:${room.id}`, ROOM_TTL_SEC);
    } catch (error) {
      console.error("[RedisRoomStore] Failed to persist room:", room.id, error);
    }
  }

  private async removeRoom(room: Room): Promise<void> {
    try {
      await this.redis.del(roomKey(room.id));
      await this.redis.del(codeKey(this.normalizeCode(room.code)));
      await this.redis.hDel(LOBBY_KEY, room.id);
      await this.redis.del(`room:owner:${room.id}`);
    } catch (error) {
      console.error("[RedisRoomStore] Failed to remove room:", room.id, error);
    }
  }

  private toLobbyMeta(room: Room): Record<string, unknown> {
    return {
      id: room.id,
      code: room.code,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      started: !!room.state && room.started === true,
      hostId: room.hostId,
      spectatorsAllowed: room.config.spectatorsAllowed ?? true,
      spectatorCount: room.spectators?.length ?? 0,
      isPrivate: !!room.passwordHash,
      listedInLobby: room.listedInLobby !== false,
      seatsOpen: room.players.length < room.maxPlayers,
      createdAt: room.createdAt,
      presetLabel: room.presetLabel,
      serverId: this.serverId,
    };
  }

  /** List lobby entries from Redis (cross-node). */
  async listLobbyFromRedis(): Promise<Array<Record<string, unknown>>> {
    try {
      const all = await this.redis.hGetAll(LOBBY_KEY);
      const items: Array<Record<string, unknown>> = [];
      for (const json of Object.values(all)) {
        try {
          const meta = JSON.parse(json) as Record<string, unknown>;
          if (meta.listedInLobby !== false) items.push(meta);
        } catch {
          // skip corrupt entries
        }
      }
      return items;
    } catch (error) {
      console.error("[RedisRoomStore] Failed to list lobby:", error);
      return [];
    }
  }

  getServerId(): string {
    return this.serverId;
  }
}
