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

async function createRoom(host: Socket, code: string, creatorId = "host-1") {
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

async function joinRoom(client: Socket, code: string, player: { id: string; name: string }) {
  return new Promise<any>((resolve, reject) => {
    client.emit("joinRoom", { roomId: code, player }, (err: any, snap: any, roomData: any) => {
      if (err) reject(err);
      else resolve({ snap, roomData });
    });
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

async function startGame(host: Socket, roomId: string, by: string) {
  return new Promise<any>((resolve, reject) => {
    host.emit("startRoom", { roomId, by }, (err: any, snap: any) => {
      if (err) reject(err);
      else resolve(snap);
    });
  });
}

describe("Sprint 2 — host control and chat polish", () => {
  it("transfers host to another player", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "XFER01";

    await createRoom(host, code);
    await joinRoom(guest, code, { id: "p2", name: "Bob" });

    const roomData = await new Promise<any>((resolve, reject) => {
      host.emit("transferHost", { roomId: code, targetId: "p2" }, (err: any, data: any) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    expect(roomData.hostId).toBe("p2");

    host.close();
    guest.close();
  }, 20000);

  it("host closes room and notifies clients with host_closed", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "CLOSE1";

    await createRoom(host, code);
    await joinRoom(guest, code, { id: "p2", name: "Bob" });

    const closedPromise = new Promise<any>((resolve) => {
      guest.once("roomClosed", (data) => resolve(data));
    });

    await new Promise<void>((resolve, reject) => {
      host.emit("closeRoomAsHost", { roomId: code }, (err: any) => (err ? reject(err) : resolve()));
    });

    const closed = await closedPromise;
    expect(closed.reason).toBe("host_closed");

    host.close();
    guest.close();
  }, 20000);

  it("blocks kicking the player whose turn it is during an active round", async () => {
    const host = await connectClient();
    const p2 = await connectClient();
    const p3 = await connectClient();
    const code = "KICKIG";

    await createRoom(host, code);
    await joinRoom(p2, code, { id: "p2", name: "Bob" });
    await joinRoom(p3, code, { id: "p3", name: "Carol" });
    await setReady(p2, code, true);
    await setReady(p3, code, true);

    const snap = await startGame(host, code, "host-1");
    const currentId = snap.players[snap.currentIndex]?.id;
    expect(currentId).toBeTruthy();

    const kickErr = await new Promise<any>((resolve) => {
      host.emit("kickPlayer", { roomId: code, targetId: currentId }, (err: any) => resolve(err));
    });
    expect(kickErr?.code).toBe("cannot_kick_current_player");

    host.close();
    p2.close();
    p3.close();
  }, 20000);

  it("allows host to kick non-current player during an active round", async () => {
    const host = await connectClient();
    const p2 = await connectClient();
    const p3 = await connectClient();
    const code = "KICKOK";

    await createRoom(host, code);
    await joinRoom(p2, code, { id: "p2", name: "Bob" });
    await joinRoom(p3, code, { id: "p3", name: "Carol" });
    await setReady(p2, code, true);
    await setReady(p3, code, true);

    const snap = await startGame(host, code, "host-1");
    const currentId = snap.players[snap.currentIndex]?.id;
    const targetId = snap.players.find((p: any) => p.id !== currentId && p.id !== "host-1")?.id;
    expect(targetId).toBeTruthy();

    const updateAfterKick = new Promise<any>((resolve) => {
      const handler = (data: any) => {
        if (!data.players.some((p: any) => p.id === targetId)) {
          host.off("roomUpdate", handler);
          resolve(data);
        }
      };
      host.on("roomUpdate", handler);
    });

    await new Promise<void>((resolve, reject) => {
      host.emit("kickPlayer", { roomId: code, targetId }, (err: any) => (err ? reject(err) : resolve()));
    });

    const update = await updateAfterKick;
    expect(update.players.some((p: any) => p.id === targetId)).toBe(false);

    host.close();
    p2.close();
    p3.close();
  }, 20000);

  it("rate-limits chat messages", async () => {
    const host = await connectClient();
    const code = "CHAT01";

    await createRoom(host, code);

    await new Promise<void>((resolve, reject) => {
      host.emit("chatMessage", { roomId: code, message: "hello" }, (err: any) =>
        err ? reject(err) : resolve()
      );
    });

    const rateErr = await new Promise<any>((resolve) => {
      host.emit("chatMessage", { roomId: code, message: "again" }, (err: any) => resolve(err));
    });
    expect(rateErr?.code).toBe("rate_limited");

    host.close();
  }, 20000);

  it("broadcasts system chat messages on join", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "SYS001";

    await createRoom(host, code);

    const systemMsgPromise = new Promise<any>((resolve) => {
      host.once("chatMessage", (msg) => {
        if (msg.isSystem && msg.message.includes("joined")) resolve(msg);
      });
    });

    await joinRoom(guest, code, { id: "p2", name: "Bob" });

    const msg = await systemMsgPromise;
    expect(msg.playerId).toBe("system");
    expect(msg.message).toMatch(/Bob joined the room/i);

    host.close();
    guest.close();
  }, 20000);

  it("rejects leave during active round with pot unless bankrupt and not current turn", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "LEAVE1";

    await createRoom(host, code);
    await joinRoom(guest, code, { id: "p2", name: "Bob" });
    await setReady(guest, code, true);
    await startGame(host, code, "host-1");

    const leaveErr = await new Promise<any>((resolve) => {
      guest.emit("leaveRoom", { roomId: code }, (err: any) => resolve(err));
    });
    expect(leaveErr?.code).toBe("cannot_leave");

    host.close();
    guest.close();
  }, 20000);
});
