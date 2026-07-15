import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as clientIo, Socket } from "socket.io-client";
import { createKouppiServer } from "../src/serverFactory";
import { sanitizeDisplayName, sanitizeChatText } from "../src/security/sanitize";
import { filterProfanity, containsProfanity } from "../src/security/profanity";
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
      port = typeof addr === "object" && addr ? addr.port : 4500;
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

async function createRoom(host: Socket, code: string) {
  return new Promise<any>((resolve, reject) => {
    host.emit(
      "createRoom",
      {
        code,
        roomId: code,
        creator: { id: "host-1", name: "Host" },
        config: { maxPlayers: 4, spectatorsAllowed: true },
      },
      (err: any, _snap: any, roomData: any) => (err ? reject(err) : resolve(roomData))
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

describe("Sprint 5 — social and trust", () => {
  it("filters profanity in chat and rejects profane display names", () => {
    expect(containsProfanity("what the fuck")).toBe(true);
    expect(filterProfanity("what the fuck")).toBe("what the ****");
    expect(sanitizeDisplayName("BadWord fucker")).toBe("");
    expect(sanitizeChatText("you are shit")).toBe("you are ****");
  });

  it("rejects join with inappropriate display name", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "SOC01";

    await createRoom(host, code);

    const joinErr = await new Promise<any>((resolve) => {
      guest.emit(
        "joinRoom",
        { roomId: code, player: { id: "p2", name: "fucker" } },
        (err: any) => resolve(err)
      );
    });
    expect(joinErr?.code).toBe("inappropriate_name");

    host.close();
    guest.close();
  }, 20000);

  it("host can ban a player and blocked player cannot rejoin", async () => {
    const host = await connectClient();
    const bully = await connectClient();
    const code = "SOC02";

    const roomData = await createRoom(host, code);
    await joinRoom(bully, code, { id: "bully-1", name: "Bully" });

    const kickedPromise = new Promise<any>((resolve) => {
      bully.once("playerKicked", (data) => resolve(data));
    });

    await new Promise<void>((resolve, reject) => {
      host.emit("banPlayer", { roomId: roomData.roomId, targetId: "bully-1" }, (err: any) =>
        err ? reject(err) : resolve()
      );
    });

    const kicked = await kickedPromise;
    expect(kicked.reason).toBe("banned_by_host");

    resetRateLimits();
    const rejoinErr = await new Promise<any>((resolve) => {
      bully.emit(
        "joinRoom",
        { roomId: code, player: { id: "bully-1", name: "Bully" } },
        (err: any) => resolve(err)
      );
    });
    expect(rejoinErr?.code).toBe("player_banned");

    host.close();
    bully.close();
  }, 20000);

  it("host can mute all chat and muted players cannot send messages", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "SOC03";

    const roomData = await createRoom(host, code);
    await joinRoom(guest, code, { id: "p2", name: "Bob" });

    await new Promise<void>((resolve, reject) => {
      host.emit("setRoomChatMuted", { roomId: roomData.roomId, muted: true }, (err: any) =>
        err ? reject(err) : resolve()
      );
    });

    const chatErr = await new Promise<any>((resolve) => {
      guest.emit(
        "chatMessage",
        { roomId: roomData.roomId, message: "hello?" },
        (err: any) => resolve(err)
      );
    });
    expect(chatErr?.code).toBe("chat_muted_all");

    const emoteErr = await new Promise<any>((resolve) => {
      guest.emit("sendEmote", { roomId: roomData.roomId, emote: "👍" }, (err: any) => resolve(err));
    });
    expect(emoteErr?.code).toBe("chat_muted_all");

    host.close();
    guest.close();
  }, 20000);

  it("accepts player reports and logs structured event", async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const code = "SOC04";

    const roomData = await createRoom(host, code);
    await joinRoom(guest, code, { id: "p2", name: "Bob" });

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.map(String).join(" "));
      originalLog(...args);
    };

    await new Promise<void>((resolve, reject) => {
      guest.emit(
        "reportPlayer",
        { roomId: roomData.roomId, targetId: "host-1", reason: "harassment", details: "spam in chat" },
        (err: any) => (err ? reject(err) : resolve())
      );
    });

    console.log = originalLog;
    const reportLog = logs.find((line) => line.includes("player_reported"));
    expect(reportLog).toBeTruthy();
    expect(reportLog).toContain("harassment");

    host.close();
    guest.close();
  }, 20000);
});
