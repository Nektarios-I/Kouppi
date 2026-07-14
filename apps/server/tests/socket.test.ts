import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as clientIo, Socket } from "socket.io-client";
import { createKouppiServer } from "../src/serverFactory";

let httpServer: any;
let ioServer: any;
let port = 4100;

beforeAll(async () => {
  const created = createKouppiServer({ corsOrigin: "*", skipCareerDatabase: true });
  httpServer = created.httpServer;
  ioServer = created.io;
  await new Promise<void>((resolve) => {
    httpServer.listen(port, () => resolve());
  });
}, 20000);

afterAll(async () => {
  ioServer?.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
}, 30000);

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
      c1.emit("startRoom", { roomId, by: "p1" }, (err: any, snap: any) => {
        if (err) return reject(new Error(`startRoom error: ${err.code}`));
        resolve(snap);
      });
    });
    expect(snapStarted.phase).toBe("Round");

    const currentPlayerId = snapStarted.players[snapStarted.currentIndex].id;
    const currentClient = currentPlayerId === "p1" ? c1 : c2;
    const otherClient = currentPlayerId === "p1" ? c2 : c1;

    let gameState = snapStarted;
    if (!gameState.turn?.upcards) {
      gameState = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("turn not started")), 8000);
        const handler = (snap: any) => {
          if (snap?.turn?.upcards) {
            clearTimeout(timeout);
            currentClient.off("state", handler);
            resolve(snap);
          }
        };
        currentClient.on("state", handler);
      });
    }
    expect(gameState.turn).not.toBeNull();

    const wrongTurnErr = await new Promise<any>((resolve) => {
      otherClient.emit("intent", { roomId, intent: { type: "pass" } }, (err: any) => resolve(err));
    });
    expect(wrongTurnErr?.code).toBe("intent_error");
    expect(wrongTurnErr?.message).toBe("not_current_player");

    const afterPass = await new Promise<any>((resolve, reject) => {
      currentClient.emit("intent", { roomId, intent: { type: "pass" } }, (err: any, snap: any) => {
        if (err) return reject(err);
        resolve(snap);
      });
    });
    expect(afterPass.awaitNext).toBe(true);

    // cleanup
    c1.close();
    c2.close();
  }, 20000);
});
