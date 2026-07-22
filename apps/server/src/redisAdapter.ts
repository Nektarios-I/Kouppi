import type { Server } from "socket.io";

type RedisClient = {
  duplicate: () => RedisClient;
  connect: () => Promise<unknown>;
  on: (event: string, handler: (err: Error) => void) => void;
};

/** Attach Socket.IO Redis adapter when REDIS_URL is set (requires redis + @socket.io/redis-adapter on the host). */
export async function attachRedisAdapterIfConfigured(io: Server): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return;

  try {
    // Optional peer deps — install `redis` and `@socket.io/redis-adapter` on the game server when scaling.
    const redisMod = (await import("redis")) as unknown as {
      createClient: (opts: { url: string }) => RedisClient;
    };
    const adapterMod = (await import("@socket.io/redis-adapter")) as unknown as {
      createAdapter: (pub: RedisClient, sub: RedisClient) => Parameters<Server["adapter"]>[0];
    };
    const { createClient } = redisMod;
    const { createAdapter } = adapterMod;

    const pub = createClient({ url: redisUrl });
    const sub = pub.duplicate();

    pub.on("error", (err: Error) => console.error("[Redis] Pub client error:", err));
    sub.on("error", (err: Error) => console.error("[Redis] Sub client error:", err));

    await Promise.all([pub.connect(), sub.connect()]);
    io.adapter(createAdapter(pub, sub));
    console.log("[Redis] Socket.IO adapter enabled");
  } catch (error) {
    console.error("[Redis] Failed to enable Socket.IO adapter:", error);
  }
}
