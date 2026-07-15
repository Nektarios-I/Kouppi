import type { Server } from "socket.io";

type RedisClient = {
  duplicate: () => RedisClient;
  connect: () => Promise<void>;
  on: (event: string, handler: (err: Error) => void) => void;
};

/** Attach Socket.IO Redis adapter when REDIS_URL is set (requires redis + @socket.io/redis-adapter on the host). */
export async function attachRedisAdapterIfConfigured(io: Server): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return;

  try {
    // Optional peer deps — install `redis` and `@socket.io/redis-adapter` on the game server when scaling.
    // @ts-expect-error optional runtime dependency
    const { createClient } = await import("redis");
    // @ts-expect-error optional runtime dependency
    const { createAdapter } = await import("@socket.io/redis-adapter");

    const pub = createClient({ url: redisUrl }) as RedisClient;
    const sub = pub.duplicate();

    pub.on("error", (err: Error) => console.error("[Redis] Pub client error:", err));
    sub.on("error", (err: Error) => console.error("[Redis] Sub client error:", err));

    await Promise.all([pub.connect(), sub.connect()]);
    io.adapter(createAdapter(pub, sub) as Parameters<Server["adapter"]>[0]);
    console.log("[Redis] Socket.IO adapter enabled");
  } catch (error) {
    console.error("[Redis] Failed to enable Socket.IO adapter:", error);
  }
}
