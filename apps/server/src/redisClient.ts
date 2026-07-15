/**
 * Shared Redis client for presence, room store, and Socket.IO adapter.
 */

import { initPresenceStore } from "./friends/presence.js";
import { InMemoryRoomStore } from "./stores/roomStore.js";
import { RedisRoomStore, type RedisClient } from "./stores/redisRoomStore.js";
import { initRoomStore, type RoomStoreHandle } from "./stores/initRoomStore.js";

let sharedClient: RedisClient | null = null;

export function getSharedRedisClient(): RedisClient | null {
  return sharedClient;
}

/** Connect Redis and wire presence + room store. Returns true if Redis is active. */
export async function initRedisServices(): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    initPresenceStore();
    initRoomStore(new InMemoryRoomStore());
    return false;
  }

  try {
    // @ts-expect-error optional runtime dependency
    const { createClient } = await import("redis");
    const client = createClient({ url: redisUrl }) as RedisClient & {
      connect: () => Promise<void>;
      on: (event: string, handler: (err: Error) => void) => void;
      duplicate: () => RedisClient & { connect: () => Promise<void> };
    };

    client.on("error", (err: Error) => console.error("[Redis] Client error:", err));
    await client.connect();
    sharedClient = client;

    initPresenceStore({
      hSet: (key, data) => client.hSet(key, data),
      hGetAll: (key) => client.hGetAll(key),
      expire: (key, seconds) => client.expire(key, seconds),
      del: (key) => client.del(key),
      sAdd: (key, member) => (client as any).sAdd(key, member),
      sRem: (key, member) => (client as any).sRem(key, member),
    });

    const roomStore = new RedisRoomStore(client);
    initRoomStore(roomStore);
    await roomStore.hydrateAllFromRedis();
    console.log("[Redis] Room store and presence enabled");
    return true;
  } catch (error) {
    console.error("[Redis] Failed to init services, falling back to in-memory:", error);
    initPresenceStore();
    initRoomStore(new InMemoryRoomStore());
    return false;
  }
}

export function getRoomStoreHandle(): RoomStoreHandle | null {
  return initRoomStore();
}
