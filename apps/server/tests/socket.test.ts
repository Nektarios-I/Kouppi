import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as clientIo, Socket } from "socket.io-client";
import { createKouppiServer } from "../src/serverFactory";

let httpServer: any;
let port = 4100;

beforeAll(async () => {
  const created = createKouppiServer({ corsOrigin: "*" });
  httpServer = created.httpServer;
  await new Promise<void>((resolve) => {
    httpServer.listen(port, () => resolve());
  });
}, 20000);

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

describe("socket.io room flow", () => {
  it("creates and joins a room with two clients and applies intents", async () => {
    const c1: Socket = clientIo(`http://localhost:${port}`, { autoConnect: true });
    const c2: Socket = clientIo(`http://localhost:${port}`, { autoConnect: true });

    await new Promise<void>((resolve, reject) => {
      c1.on("connect", () => resolve());
      c1.on("connect_error", (err) => reject(err));
    });
    await new Promise<void>((resolve, reject) => {
      c2.on("connect", () => resolve());
      c2.on("connect_error", (err) => reject(err));
    });

    const roomId = "vitest-room";
    // Host creates room with config overrides; host auto-joins
    await new Promise<void>((resolve, reject) => {
      c1.emit("createRoom", { roomId, creator: { id: "p1", name: "Alice" }, config: { maxPlayers: 2, ante: 10 } }, (err: any, _snap: any) => {
        if (err) return reject(new Error(`createRoom error: ${err.code}`));
        resolve();
      });
    });

    // both join (ack)
    // Host already joined during creation
    const snapJoin2 = await new Promise<any>((resolve) => {
      c2.emit("joinRoom", { roomId, player: { id: "p2", name: "Bob" } }, (_err: any, snap: any) => resolve(snap));
    });
    // Room not started yet; ack snapshot should be null
    expect(snapJoin2).toBeNull();
    const snapStarted = await new Promise<any>((resolve, reject) => {
      const handler = (snap: any) => resolve(snap);
      c1.once("state", handler);
      c1.emit("startRoom", { roomId, by: "p1" }, (err: any, snap: any) => {
        if (err) return reject(new Error(`startRoom error: ${err.code}`));
        if (snap) resolve(snap);
      });
    });
    expect(snapStarted.phase).toBe("Round");

    // Start a turn; if forced pass occurs (pair/consecutive), try again a few times
    let afterStartTurn: any = null;
    for (let i = 0; i < 10; i++) {
      const currentPlayerId = snapStarted.players[snapStarted.currentIndex].id;
      // eslint-disable-next-line no-await-in-loop
      afterStartTurn = await new Promise<any>((resolve) => {
        c1.emit("intent", { roomId, playerId: currentPlayerId, intent: { type: "startTurn" } }, (_err: any, snap: any) => resolve(snap));
      });
      if (afterStartTurn?.turn) break;
    }
    expect(afterStartTurn.turn).not.toBeNull();

    const passPlayerId = afterStartTurn.players[afterStartTurn.currentIndex].id;
    const afterPass = await new Promise<any>((resolve) => {
      c1.emit("intent", { roomId, playerId: passPlayerId, intent: { type: "pass" } }, (_err: any, snap: any) => resolve(snap));
    });
    expect(afterPass.awaitNext).toBe(true);

    // cleanup
    c1.close();
    c2.close();
  }, 20000);
});
