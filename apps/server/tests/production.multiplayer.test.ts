import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as clientIo, Socket } from "socket.io-client";
import { createKouppiServer } from "../src/serverFactory";
import { getRoom, resetAllRoomsForTests } from "../src/rooms";
import { resetRateLimits } from "../src/security/rateLimit";

let httpServer: any;
let ioServer: any;
let port = 0;

beforeAll(async () => {
  resetRateLimits();
  resetAllRoomsForTests();
  const created = createKouppiServer({ corsOrigin: "*", skipCareerDatabase: true });
  httpServer = created.httpServer;
  ioServer = created.io;
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === "object" && addr ? addr.port : 4700;
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

async function createAndStartTwoPlayerGame(code: string) {
  const host = await connectClient();
  const guest = await connectClient();

  const roomData = await new Promise<any>((resolve, reject) => {
    host.emit(
      "createRoom",
      {
        code,
        roomId: code,
        creator: { id: "host-1", name: "Host" },
        config: { maxPlayers: 4 },
      },
      (err: any, _snap: any, data: any) => (err ? reject(err) : resolve(data))
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
    host.emit("setReady", { roomId: code, ready: true }, (err: any) => (err ? reject(err) : resolve()));
  });
  await new Promise<void>((resolve, reject) => {
    guest.emit("setReady", { roomId: code, ready: true }, (err: any) => (err ? reject(err) : resolve()));
  });
  await new Promise<void>((resolve, reject) => {
    host.emit("startRoom", { roomId: code, by: "host-1" }, (err: any) => (err ? reject(err) : resolve()));
  });

  return { host, guest, roomData };
}

describe("Production multiplayer hardening", () => {
  it("blocks playAgain during an active round", async () => {
    const { host, guest } = await createAndStartTwoPlayerGame("PROD1");

    const err = await new Promise<any>((resolve) => {
      host.emit("playAgain", { roomId: "PROD1" }, (e: any) => resolve(e));
    });
    expect(err?.code).toBe("game_in_progress");

    host.close();
    guest.close();
  }, 30000);

  it("blocks newRound while stay/leave decision is active", async () => {
    const { host, guest } = await createAndStartTwoPlayerGame("PROD2");
    const room = getRoom("PROD2")!;
    room.state!.phase = "RoundEnd";
    room.decision = {
      active: true,
      deadlineTs: Date.now() + 30_000,
      choices: { "host-1": null, "p2": null },
      timer: null,
      interval: null,
    };

    const err = await new Promise<any>((resolve) => {
      host.emit("newRound", { roomId: "PROD2" }, (e: any) => resolve(e));
    });
    expect(err?.message).toBe("decision_in_progress");

    host.close();
    guest.close();
  }, 30000);

  it("setAvatar preserves ready flags in roomUpdate", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "AVTR01";

    await new Promise<void>((resolve, reject) => {
      host.emit(
        "createRoom",
        { code, roomId: code, creator: { id: "host-1", name: "Host" }, config: { maxPlayers: 4 } },
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

    const update = await new Promise<any>((resolve) => {
      guest.once("roomUpdate", (data: any) => resolve(data));
      host.emit(
        "setAvatar",
        { roomId: code, avatar: { id: "portrait-01" } },
        () => {}
      );
    });

    const bob = update.players.find((p: any) => p.id === "p2");
    expect(bob?.ready).toBe(true);
    expect(typeof update.version).toBe("number");

    host.close();
    guest.close();
  }, 30000);

  it("resolves room handlers by public code", async () => {
    const { host, guest } = await createAndStartTwoPlayerGame("CODE01");
    const room = getRoom("CODE01")!;
    room.state!.phase = "RoundEnd";

    const playAgainErr = await new Promise<any>((resolve) => {
      host.emit("playAgain", { roomId: "CODE01" }, (e: any) => resolve(e));
    });
    expect(playAgainErr).toBeNull();

    const updated = getRoom("CODE01");
    expect(updated?.started).toBe(false);

    host.close();
    guest.close();
  }, 30000);

  it("issues joinSessionToken and blocks seat hijack during disconnect grace", async () => {
    const host = await connectClient();
    let guest = await connectClient();
    const attacker = await connectClient();
    const code = "TOK01";

    await new Promise<void>((resolve, reject) => {
      host.emit(
        "createRoom",
        { code, roomId: code, creator: { id: "host-1", name: "Host" }, config: { maxPlayers: 4 } },
        (err: any, _snap: any, data: any) => {
          if (err) reject(err);
          else {
            expect(data.joinSessionToken).toBeTruthy();
            resolve();
          }
        }
      );
    });

    const guestAck = await new Promise<any>((resolve, reject) => {
      guest.emit(
        "joinRoom",
        { roomId: code, player: { id: "p2", name: "Bob" } },
        (err: any, _snap: any, data: any) => (err ? reject(err) : resolve(data))
      );
    });
    const token = guestAck.joinSessionToken as string;
    expect(token).toBeTruthy();

    guest.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 150));

    const hijackErr = await new Promise<any>((resolve) => {
      attacker.emit(
        "joinRoom",
        { roomId: code, player: { id: "p2", name: "Hacker" } },
        (err: any) => resolve(err)
      );
    });
    expect(hijackErr?.code).toBe("invalid_session_token");

    guest = await connectClient();
    const reclaimErr = await new Promise<any>((resolve) => {
      guest.emit(
        "joinRoom",
        { roomId: code, player: { id: "p2", name: "Bob" }, joinSessionToken: token },
        (err: any) => resolve(err)
      );
    });
    expect(reclaimErr).toBeNull();

    host.close();
    guest.close();
    attacker.close();
  }, 30000);
});
