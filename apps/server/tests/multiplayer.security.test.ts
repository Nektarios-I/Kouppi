import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as clientIo, Socket } from "socket.io-client";
import { createKouppiServer } from "../src/serverFactory";

let httpServer: any;
let ioServer: any;
const port = 4310;

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

describe("multiplayer security fixes", () => {
  it("rejects startRoom from non-host socket even with host id in payload", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const roomId = "sec-start-room";

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

    const startErr = await new Promise<any>((resolve) => {
      guest.emit("startRoom", { roomId, by: "p1" }, (err: any) => resolve(err));
    });
    expect(startErr?.code).toBe("not_host");

    host.close();
    guest.close();
  }, 20000);

  it("rejects newRound from non-host socket", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const roomId = "sec-new-round";

    await new Promise<void>((resolve, reject) => {
      host.emit(
        "createRoom",
        { roomId, creator: { id: "p1", name: "Alice" }, config: { maxPlayers: 2 } },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    await new Promise<void>((resolve) => {
      guest.emit("joinRoom", { roomId, player: { id: "p2", name: "Bob" } }, () => resolve());
    });

    await new Promise<void>((resolve, reject) => {
      host.emit("startRoom", { roomId, by: "p1" }, (err: any) => (err ? reject(err) : resolve()));
    });

    const newRoundErr = await new Promise<any>((resolve) => {
      guest.emit("newRound", { roomId, playerId: "p1" }, (err: any) => resolve(err));
    });
    expect(newRoundErr?.message).toBe("not_host");

    host.close();
    guest.close();
  }, 20000);

  it("rejects joinRoom hijack when player slot is actively connected", async () => {
    const host = await connectClient();
    const attacker = await connectClient();
    const roomId = "sec-slot-taken";

    await new Promise<void>((resolve, reject) => {
      host.emit(
        "createRoom",
        { roomId, creator: { id: "p1", name: "Alice" }, config: { maxPlayers: 4 } },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    const hijackErr = await new Promise<any>((resolve) => {
      attacker.emit(
        "joinRoom",
        { roomId, player: { id: "p1", name: "FakeAlice" } },
        (err: any) => resolve(err)
      );
    });
    expect(hijackErr?.code).toBe("slot_taken");

    host.close();
    attacker.close();
  }, 20000);

  it("binds roundDecision to socket identity", async () => {
    const c1 = await connectClient();
    const c2 = await connectClient();
    const roomId = "sec-round-decision";

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

    await new Promise<void>((resolve, reject) => {
      c1.emit("startRoom", { roomId, by: "p1" }, (err: any) => (err ? reject(err) : resolve()));
    });

    const outsider = await connectClient();
    const outsiderErr = await new Promise<any>((resolve) => {
      outsider.emit("roundDecision", { roomId, playerId: "p1", decision: "leave" }, (err: any) =>
        resolve(err)
      );
    });
    expect(outsiderErr?.code).toBe("no_decision_phase");

    c1.close();
    c2.close();
    outsider.close();
  }, 20000);
});
