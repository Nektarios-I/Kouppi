import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as clientIo, Socket } from "socket.io-client";
import { createKouppiServer } from "../src/serverFactory";

let httpServer: any;
let ioServer: any;
let port = 0;

beforeAll(async () => {
  const created = createKouppiServer({ corsOrigin: "*", skipCareerDatabase: true });
  httpServer = created.httpServer;
  ioServer = created.io;
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === "object" && addr ? addr.port : 4400;
      resolve();
    });
  });
}, 20000);

afterAll(async () => {
  ioServer?.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
}, 30000);

function connectClient(): Promise<Socket> {
  const c: Socket = clientIo(`http://127.0.0.1:${port}`, {
    autoConnect: true,
    transports: ["websocket"],
  });
  return new Promise((resolve, reject) => {
    c.on("connect", () => resolve(c));
    c.on("connect_error", reject);
  });
}

async function createAndStartGame(code: string) {
  const host = await connectClient();
  const guest = await connectClient();

  await new Promise<void>((resolve, reject) => {
    host.emit(
      "createRoom",
      {
        code,
        roomId: code,
        creator: { id: "host-1", name: "Host" },
        config: { maxPlayers: 4, spectatorsAllowed: true },
      },
      (err: any) => (err ? reject(err) : resolve())
    );
  });

  await new Promise<void>((resolve, reject) => {
    guest.emit(
      "joinRoom",
      { roomId: code, player: { id: "p2", name: "Bob" } },
      (err: any) => (err ? reject(err) : resolve())
    );
  });

  await new Promise<void>((resolve, reject) => {
    guest.emit("setReady", { roomId: code, ready: true }, (err: any) => (err ? reject(err) : resolve()));
  });

  const snap = await new Promise<any>((resolve, reject) => {
    host.emit("startRoom", { roomId: code, by: "host-1" }, (err: any, state: any) =>
      err ? reject(err) : resolve(state)
    );
  });

  return { host, guest, snap };
}

describe("Sprint 3 — mobile & reconnect hardening", () => {
  it("includes monotonic version on game state snapshots", async () => {
    const { host, guest, snap } = await createAndStartGame("VER001");
    expect(typeof snap.version).toBe("number");
    expect(snap.version).toBeGreaterThan(0);

    host.close();
    guest.close();
  }, 20000);

  it("increments state version after player intent", async () => {
    const { host, guest, snap } = await createAndStartGame("VER002");
    const startVersion = snap.version;
    const currentId = snap.players[snap.currentIndex]?.id;
    const actor = currentId === "host-1" ? host : guest;

    const afterPass = await new Promise<any>((resolve, reject) => {
      actor.emit("intent", { roomId: "VER002", intent: { type: "pass" } }, (err: any, state: any) =>
        err ? reject(err) : resolve(state)
      );
    });

    expect(afterPass.version).toBeGreaterThan(startVersion);

    host.close();
    guest.close();
  }, 20000);

  it("gives spectators reconnect grace instead of immediate removal", async () => {
    const host = await connectClient();
    const spectator = await connectClient();
    const code = "SPECGR";

    await new Promise<void>((resolve, reject) => {
      host.emit(
        "createRoom",
        {
          code,
          roomId: code,
          creator: { id: "host-1", name: "Host" },
          config: { maxPlayers: 4, spectatorsAllowed: true },
        },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    await new Promise<void>((resolve, reject) => {
      spectator.emit(
        "joinAsSpectator",
        { roomId: code, spectator: { id: "spec-1", name: "Watcher" } },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    const graceUpdate = new Promise<any>((resolve) => {
      host.once("roomUpdate", (data) => {
        const spec = data.spectators?.find((s: any) => s.id === "spec-1");
        if (spec?.connected === false && spec.reconnectRemainingSec != null) resolve(data);
      });
    });

    spectator.disconnect();

    const update = await graceUpdate;
    const spec = update.spectators.find((s: any) => s.id === "spec-1");
    expect(spec.connected).toBe(false);
    expect(spec.reconnectRemainingSec).toBeGreaterThan(0);

    host.close();
  }, 20000);

  it("allows spectator to reclaim seat within grace window", async () => {
    let spectator = await connectClient();
    const host = await connectClient();
    const code = "SPECRE";

    await new Promise<void>((resolve, reject) => {
      host.emit(
        "createRoom",
        {
          code,
          roomId: code,
          creator: { id: "host-1", name: "Host" },
          config: { maxPlayers: 4, spectatorsAllowed: true },
        },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    const specTokenHolder = { token: "" as string };
    await new Promise<void>((resolve, reject) => {
      spectator.emit(
        "joinAsSpectator",
        { roomId: code, spectator: { id: "spec-1", name: "Watcher" } },
        (err: any, _snap: any, roomData: any) => {
          if (err) reject(err);
          else {
            specTokenHolder.token = roomData.joinSessionToken;
            resolve();
          }
        }
      );
    });

    spectator.disconnect();
    spectator = await connectClient();

    const rejoined = await new Promise<any>((resolve, reject) => {
      spectator.emit(
        "joinAsSpectator",
        {
          roomId: code,
          spectator: { id: "spec-1", name: "Watcher" },
          joinSessionToken: specTokenHolder.token,
        },
        (err: any, _snap: any, roomData: any) => (err ? reject(err) : resolve(roomData))
      );
    });

    const spec = rejoined.spectators.find((s: any) => s.id === "spec-1");
    expect(spec.connected).toBe(true);

    host.close();
    spectator.close();
  }, 20000);
});
