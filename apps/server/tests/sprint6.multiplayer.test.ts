import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as clientIo, Socket } from "socket.io-client";
import { createKouppiServer } from "../src/serverFactory";
import { resetAllRoomsForTests } from "../src/rooms";
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
      port = typeof addr === "object" && addr ? addr.port : 4600;
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

describe("Sprint 6 — discovery and retention", () => {
  it("hides unlisted private rooms from lobby list", async () => {
    const host = await connectClient();
    const guest = await connectClient();

    await new Promise<void>((resolve, reject) => {
      host.emit(
        "createRoom",
        {
          code: "HID01",
          roomId: "HID01",
          creator: { id: "host-1", name: "Host" },
          password: "secret",
          listedInLobby: false,
          config: { maxPlayers: 4 },
        },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    const listed = await new Promise<any[]>((resolve, reject) => {
      guest.emit("listRooms", (err: any, rooms: any[]) => (err ? reject(err) : resolve(rooms)));
    });
    expect(listed.some((r) => r.code === "HID01")).toBe(false);

    host.close();
    guest.close();
  }, 20000);

  it("lists public rooms with preset label and seats metadata", async () => {
    const host = await connectClient();
    const guest = await connectClient();

    await new Promise<void>((resolve, reject) => {
      host.emit(
        "createRoom",
        {
          code: "PUB01",
          roomId: "PUB01",
          creator: { id: "host-1", name: "Host" },
          listedInLobby: true,
          presetLabel: "Classic",
          config: { maxPlayers: 4 },
        },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    const listed = await new Promise<any[]>((resolve, reject) => {
      guest.emit("listRooms", (err: any, rooms: any[]) => (err ? reject(err) : resolve(rooms)));
    });
    const room = listed.find((r) => r.code === "PUB01");
    expect(room).toBeTruthy();
    expect(room.presetLabel).toBe("Classic");
    expect(room.seatsOpen).toBe(true);
    expect(typeof room.createdAt).toBe("number");

    host.close();
    guest.close();
  }, 20000);

  it("playAgain resets table to waiting room for same players", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "PLAY6";

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
      host.emit("setReady", { roomId: roomData.roomId, ready: true }, (err: any) => (err ? reject(err) : resolve()));
    });
    await new Promise<void>((resolve, reject) => {
      guest.emit("setReady", { roomId: roomData.roomId, ready: true }, (err: any) => (err ? reject(err) : resolve()));
    });

    await new Promise<void>((resolve, reject) => {
      host.emit("startRoom", { roomId: roomData.roomId, by: "host-1" }, (err: any) => (err ? reject(err) : resolve()));
    });

    const tableResetPromise = new Promise<void>((resolve) => {
      guest.once("tableReset", () => resolve());
    });

    const playAgainResult = await new Promise<any>((resolve, reject) => {
      host.emit("playAgain", { roomId: roomData.roomId }, (err: any, data: any) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    expect(playAgainResult.players.some((p: any) => p.id === "p2" && p.ready === false)).toBe(true);
    expect(playAgainResult.players.some((p: any) => p.id === "host-1" && p.ready === true)).toBe(true);
    await tableResetPromise;

    host.close();
    guest.close();
  }, 30000);
});
