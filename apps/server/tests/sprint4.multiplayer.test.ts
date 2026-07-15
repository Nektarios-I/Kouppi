import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as clientIo, Socket } from "socket.io-client";
import { createKouppiServer } from "../src/serverFactory";
import { hashRoomPassword, verifyRoomPassword } from "../src/security/password";
import { sanitizeDisplayName, sanitizeChatText } from "../src/security/sanitize";
import { resetRateLimits } from "../src/security/rateLimit";

let httpServer: any;
let ioServer: any;
let port = 0;

beforeAll(async () => {
  resetRateLimits();
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

describe("Sprint 4 — production hardening", () => {
  it("hashes and verifies room passwords without storing plaintext", () => {
    const hash = hashRoomPassword("secret-room");
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(verifyRoomPassword("secret-room", hash)).toBe(true);
    expect(verifyRoomPassword("wrong", hash)).toBe(false);
  });

  it("sanitizes display names and chat messages", () => {
    expect(sanitizeDisplayName("<b>Alice</b>")).toBe("Alice");
    expect(sanitizeChatText("visit https://evil.test now")).toBe("visit [link removed] now");
  });

  it("rejects join to private room with wrong password (hashed storage)", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "PRIV01";

    await new Promise<void>((resolve, reject) => {
      host.emit(
        "createRoom",
        {
          code,
          roomId: code,
          creator: { id: "host-1", name: "Host" },
          password: "secret",
          config: { maxPlayers: 4, spectatorsAllowed: true },
        },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    const joinErr = await new Promise<any>((resolve) => {
      guest.emit(
        "joinRoom",
        { roomId: code, player: { id: "p2", name: "Bob" }, password: "wrong" },
        (err: any) => resolve(err)
      );
    });
    expect(joinErr?.code).toBe("wrong_password");

    const joined = await new Promise<any>((resolve, reject) => {
      guest.emit(
        "joinRoom",
        { roomId: code, player: { id: "p2", name: "Bob" }, password: "secret" },
        (err: any, _snap: any, roomData: any) => (err ? reject(err) : resolve(roomData))
      );
    });
    expect(joined.players.some((p: any) => p.id === "p2")).toBe(true);

    host.close();
    guest.close();
  }, 20000);

  it("rate-limits rapid createRoom calls from one socket", async () => {
    resetRateLimits();
    const client = await connectClient();

    await new Promise<void>((resolve, reject) => {
      client.emit(
        "createRoom",
        {
          roomId: "RATE0",
          creator: { id: "host-1", name: "Host" },
          config: { maxPlayers: 4 },
        },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    const rateErr = await new Promise<any>((resolve) => {
      client.emit(
        "createRoom",
        {
          roomId: "RATE1",
          creator: { id: "host-1", name: "Host" },
          config: { maxPlayers: 4 },
        },
        (err: any) => resolve(err)
      );
    });
    expect(rateErr?.code).toBe("rate_limited");

    client.close();
  }, 20000);

  it("exposes health and ready endpoints with server stats", async () => {
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    const healthJson = await health.json();
    expect(healthJson.ok).toBe(true);
    expect(typeof healthJson.uptimeSec).toBe("number");

    const ready = await fetch(`http://127.0.0.1:${port}/health/ready`);
    const readyJson = await ready.json();
    expect(readyJson.ok).toBe(true);
    expect(typeof readyJson.connections).toBe("number");
  }, 20000);
});
