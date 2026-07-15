import type { RoomStore } from "./roomStore.js";
import { InMemoryRoomStore } from "./roomStore.js";
import type { RedisRoomStore } from "./redisRoomStore.js";

let activeStore: RoomStore = new InMemoryRoomStore();

export type RoomStoreHandle = RoomStore & {
  listLobbyFromRedis?: () => Promise<Array<Record<string, unknown>>>;
  hydrateRoom?: (id: string) => Promise<import("../types.js").Room | undefined>;
  resolveCodeAsync?: (code: string) => Promise<string | undefined>;
  isDistributed?: () => boolean;
};

export function initRoomStore(store?: RoomStore): RoomStoreHandle {
  if (store) activeStore = store;
  return activeStore as RoomStoreHandle;
}

export function getRoomStore(): RoomStoreHandle {
  return activeStore as RoomStoreHandle;
}

export function isRedisRoomStore(): boolean {
  return activeStore.isDistributed();
}

export function getRedisRoomStore(): RedisRoomStore | null {
  if (!activeStore.isDistributed()) return null;
  return activeStore as RedisRoomStore;
}
