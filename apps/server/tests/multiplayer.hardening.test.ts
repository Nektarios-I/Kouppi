import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as clientIo, Socket } from "socket.io-client";
import { createKouppiServer } from "../src/serverFactory";

let httpServer: any;
let ioServer: any;
const port = 4300;

beforeAll(async () => {
  const created = createKouppiServer({ corsOrigin: "*" });
  httpServer = created.httpServer;
  ioServer = created.io;
  await new Promise<void>((resolve) => httpServer.listen(port, () => resolve()));
}, 20000);

afterAll(async () => {
  ioServer?.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
}, 30000);

function connectClient(): Promise<Socket> {
  const c: Socket = clientIo(`http://localhost:${port}`, { autoConnect: true });
  return new Promise((resolve, reject) => {
    c.on("connect", () => resolve(c));
    c.on("connect_error", reject);
  });
}

describe("multiplayer hardening", () => {
  it("rejects join after game started with game_in_progress", async () => {
    const c1 = await connectClient();
    const c3 = await connectClient();
    const roomId = "hardening-started";

    await new Promise<void>((resolve, reject) => {
      c1.emit(
        "createRoom",
        { roomId, creator: { id: "p1", name: "Alice" }, config: { maxPlayers: 2, spectatorsAllowed: true } },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    const c2 = await connectClient();
    await new Promise<void>((resolve) => {
      c2.emit("joinRoom", { roomId, player: { id: "p2", name: "Bob" } }, () => resolve());
    });

    await new Promise<void>((resolve, reject) => {
      c1.emit("startRoom", { roomId, by: "p1" }, (err: any) => (err ? reject(err) : resolve()));
    });

    const joinErr = await new Promise<any>((resolve) => {
      c3.emit("joinRoom", { roomId, player: { id: "p3", name: "Cara" } }, (err: any) => resolve(err));
    });
    expect(joinErr?.code).toBe("game_in_progress");

    c1.close();
    c2.close();
    c3.close();
  }, 20000);

  it("allows spectator join when enabled and rejects without password on private room", async () => {
    const host = await connectClient();
    const spec = await connectClient();
    const roomId = "hardening-private-spec";

    await new Promise<void>((resolve, reject) => {
      host.emit(
        "createRoom",
        {
          roomId,
          creator: { id: "p1", name: "Alice" },
          config: { maxPlayers: 4, spectatorsAllowed: true },
          password: "secret",
        },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    const badSpec = await new Promise<any>((resolve) => {
      spec.emit(
        "joinAsSpectator",
        { roomId, spectator: { id: "s1", name: "Watcher" } },
        (err: any) => resolve(err)
      );
    });
    expect(badSpec?.code).toBe("wrong_password");

    const goodSpec = await new Promise<any>((resolve) => {
      spec.emit(
        "joinAsSpectator",
        { roomId, spectator: { id: "s1", name: "Watcher" }, password: "secret" },
        (err: any, snap: any) => resolve({ err, snap })
      );
    });
    expect(goodSpec.err).toBeNull();

    host.close();
    spec.close();
  }, 20000);

  it("rejects intent impersonation and forbidden system intents", async () => {
    const c1 = await connectClient();
    const c2 = await connectClient();
    const roomId = "hardening-intent";

    await new Promise<void>((resolve, reject) => {
      c1.emit(
        "createRoom",
        { roomId, creator: { id: "p1", name: "Alice" }, config: { maxPlayers: 2 } },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    await new Promise<void>((resolve) => {
      c2.emit("joinRoom", { roomId, player: { id: "p2", name: "Bob" } }, () => resolve());
    });

    const snapStarted = await new Promise<any>((resolve, reject) => {
      c1.emit("startRoom", { roomId, by: "p1" }, (err: any, snap: any) => {
        if (err) reject(err);
        else resolve(snap);
      });
    });

    const currentPlayerId = snapStarted.players[snapStarted.currentIndex].id;
    const wrongClient = currentPlayerId === "p1" ? c2 : c1;

    const impersonateErr = await new Promise<any>((resolve) => {
      wrongClient.emit("intent", { roomId, intent: { type: "pass" } }, (err: any) => resolve(err));
    });
    expect(impersonateErr?.code).toBe("intent_error");
    expect(impersonateErr?.message).toBe("not_current_player");

    const forbiddenErr = await new Promise<any>((resolve) => {
      c1.emit("intent", { roomId, intent: { type: "nextPlayer" } }, (err: any) => resolve(err));
    });
    expect(forbiddenErr?.code).toBe("intent_error");

    c1.close();
    c2.close();
  }, 20000);

  it("promotes host when host leaves and keeps room open", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const roomId = "hardening-host-promote";

    await new Promise<void>((resolve, reject) => {
      host.emit(
        "createRoom",
        { roomId, creator: { id: "p1", name: "Alice" }, config: { maxPlayers: 4 } },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    await new Promise<void>((resolve) => {
      guest.emit("joinRoom", { roomId, player: { id: "p2", name: "Bob" } }, () => resolve());
    });

    const updatePromise = new Promise<any>((resolve) => {
      guest.once("roomUpdate", resolve);
    });

    await new Promise<void>((resolve) => {
      host.emit("leaveRoom", { roomId }, () => resolve());
    });

    const update = await updatePromise;
    expect(update.hostId).toBe("p2");

    const roomClosed = new Promise<any>((resolve) => {
      guest.once("roomClosed", resolve);
    });
    await Promise.race([
      roomClosed,
      new Promise((resolve) => setTimeout(() => resolve("no-close"), 500)),
    ]).then((result) => {
      expect(result).toBe("no-close");
    });

    guest.close();
  }, 20000);
});
