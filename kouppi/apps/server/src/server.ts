import { createKouppiServer } from "./serverFactory.js";

const { httpServer } = createKouppiServer();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

httpServer.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
