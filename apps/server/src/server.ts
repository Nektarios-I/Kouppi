import { createKouppiServer } from "./serverFactory.js";
import { attachRedisAdapterIfConfigured } from "./redisAdapter.js";
import { initRedisServices } from "./redisClient.js";

const corsOrigin = process.env.CORS_ORIGIN || "*";

async function start() {
  await initRedisServices();

  const { httpServer, io } = createKouppiServer({ corsOrigin });
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;

  await attachRedisAdapterIfConfigured(io);

  httpServer.listen(port, () => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "server_start",
        port,
        corsOrigin,
        redis: !!process.env.REDIS_URL,
        nodeEnv: process.env.NODE_ENV || "development",
      })
    );
  });
}

start().catch((error) => {
  console.error("[Server] Failed to start:", error);
  process.exit(1);
});
