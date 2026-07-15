import { createKouppiServer } from "./serverFactory.js";

const corsOrigin = process.env.CORS_ORIGIN || "*";
const { httpServer } = createKouppiServer({ corsOrigin });
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

httpServer.listen(port, () => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: "server_start",
      port,
      corsOrigin,
      nodeEnv: process.env.NODE_ENV || "development",
    })
  );
});
