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

async function createRoomWithCode(host: Socket, code: string, creatorId = "host-1") {
  return new Promise<{ code: string; roomId: string; roomData: any }>((resolve, reject) => {
    host.emit(
      "createRoom",
      {
        code,
        roomId: code,
        creator: { id: creatorId, name: "Host" },
        config: { maxPlayers: 4, spectatorsAllowed: true },
      },
      (err: any, _snap: any, roomData: any) => {
        if (err) reject(err);
        else resolve({ code: roomData.code, roomId: roomData.roomId, roomData });
      }
    );
  });
}

async function joinByCode(
  client: Socket,
  code: string,
  player: { id: string; name: string },
  options?: { joinSessionToken?: string }
) {
  return new Promise<any>((resolve, reject) => {
    client.emit(
      "joinRoom",
      { roomId: code, player, joinSessionToken: options?.joinSessionToken },
      (err: any, snap: any, roomData: any) => {
        if (err) reject(err);
        else resolve({ snap, roomData });
      }
    );
  });
}

async function setReady(client: Socket, roomId: string, ready: boolean) {
  return new Promise<any>((resolve, reject) => {
    client.emit("setReady", { roomId, ready }, (err: any, roomData: any) => {
      if (err) reject(err);
      else resolve(roomData);
    });
  });
}

describe("Sprint 1 — friends can play", () => {
  it("creates room with short code and joins by case-insensitive code", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "PLAY42";

    const created = await createRoomWithCode(host, code);
    expect(created.code).toBe(code);
    expect(created.roomData.players).toHaveLength(1);
    expect(created.roomData.players[0].ready).toBe(true);

    const joined = await joinByCode(guest, "play42", { id: "guest-1", name: "Guest" });
    expect(joined.roomData.players).toHaveLength(2);
    expect(joined.roomData.players.find((p: any) => p.id === "guest-1")?.ready).toBe(false);

    host.close();
    guest.close();
  }, 20000);

  it("blocks host start until all players ready, then starts game", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "READY1";

    await createRoomWithCode(host, code);
    await joinByCode(guest, code, { id: "p2", name: "Bob" });

    const notReadyErr = await new Promise<any>((resolve) => {
      host.emit("startRoom", { roomId: code, by: "host-1" }, (err: any) => resolve(err));
    });
    expect(notReadyErr?.code).toBe("not_all_ready");

    await setReady(guest, code, true);

    const started = await new Promise<any>((resolve, reject) => {
      host.emit("startRoom", { roomId: code, by: "host-1" }, (err: any, snap: any) => {
        if (err) reject(err);
        else resolve(snap);
      });
    });
    expect(started.phase).toBe("Round");

    host.close();
    guest.close();
  }, 20000);

  it("host kicks guest from waiting room and room updates for host", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "KICK01";

    await createRoomWithCode(host, code);
    await joinByCode(guest, code, { id: "p2", name: "Bob" });

    const updateAfterKick = new Promise<any>((resolve) => {
      const handler = (data: any) => {
        if (data.players.length === 1) {
          host.off("roomUpdate", handler);
          resolve(data);
        }
      };
      host.on("roomUpdate", handler);
    });

    await new Promise<void>((resolve, reject) => {
      host.emit("kickPlayer", { roomId: code, targetId: "p2" }, (err: any) =>
        err ? reject(err) : resolve()
      );
    });

    const update = await updateAfterKick;
    expect(update.players.some((p: any) => p.id === "p2")).toBe(false);

    host.close();
    guest.close();
  }, 20000);

  it("shows reconnect grace countdown to remaining player when guest disconnects", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "GRACE1";

    await createRoomWithCode(host, code);
    await joinByCode(guest, code, { id: "p2", name: "Bob" });

    const graceUpdatePromise = new Promise<any>((resolve) => {
      host.once("roomUpdate", (data: any) => {
        const bob = data.players.find((p: any) => p.id === "p2");
        if (bob && bob.connected === false && bob.reconnectRemainingSec != null) resolve(data);
      });
    });

    guest.disconnect();

    const graceUpdate = await graceUpdatePromise;
    const bob = graceUpdate.players.find((p: any) => p.id === "p2");
    expect(bob.connected).toBe(false);
    expect(bob.reconnectRemainingSec).toBeGreaterThan(0);
    expect(bob.reconnectRemainingSec).toBeLessThanOrEqual(45);

    host.close();
  }, 20000);

  it("allows guest to reclaim seat after disconnect within grace window", async () => {
    const host = await connectClient();
    let guest = await connectClient();
    const code = "REJOIN";

    await createRoomWithCode(host, code);
    const firstJoin = await joinByCode(guest, code, { id: "p2", name: "Bob" });
    const joinToken = firstJoin.roomData.joinSessionToken as string;
    expect(joinToken).toBeTruthy();
    guest.disconnect();

    guest = await connectClient();
    const rejoined = await joinByCode(guest, code, { id: "p2", name: "Bob" }, { joinSessionToken: joinToken });
    const bob = rejoined.roomData.players.find((p: any) => p.id === "p2");
    expect(bob.connected).toBe(true);
    expect(bob.reconnectRemainingSec).toBeNull();

    host.close();
    guest.close();
  }, 20000);
});
