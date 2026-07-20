/**
 * CAREER-FLOW-TEST-001: Career matchmaking → game-end rating delta path.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { io as ioClient } from "socket.io-client";
import type { AddressInfo } from "net";
import {
  getDatabase,
  closeDatabase,
  createUser,
  getUserById,
  calculateNewRating,
  getRawDb,
} from "@kouppi/database";
import { createKouppiServer } from "../../src/serverFactory.js";
import { issueTestAuthToken } from "../helpers/authToken.js";
import { clearQueue, hasMatchFoundHandler } from "../../src/career/queue.js";
import {
  createCareerRoom,
  markRoomInGame,
  handleCareerGameEnd,
  cleanupRoom,
  type CareerPlayer,
} from "../../src/career/careerRoomManager.js";
import { Server } from "socket.io";
import { createServer } from "http";

const tmpDb = path.join(os.tmpdir(), `kouppi-career-flow-${process.pid}-${Date.now()}.db`);

function makePlayer(
  user: { id: string; username: string; rating: number; bankroll: number },
  socketId: string
): CareerPlayer {
  return {
    odlayerId: user.id,
    odlayerName: user.username,
    odlating: user.rating,
    odankroll: user.bankroll,
    odocketId: socketId,
    userId: user.id,
    username: user.username,
    rating: user.rating,
    bankroll: user.bankroll,
    socketId,
    avatarEmoji: "🎭",
    avatarColor: "#6366f1",
    avatarBorder: "#4f46e5",
    joinedAt: Date.now(),
  };
}

describe("Career Game Flow Integration", () => {
  let httpServer: ReturnType<typeof createKouppiServer>["httpServer"];
  let stopCleanup: () => void;
  let serverUrl = "";
  let tokenA = "";
  let tokenB = "";
  let userAId = "";
  let userBId = "";

  beforeAll(async () => {
    process.env.DATABASE_PATH = tmpDb;
    process.env.JWT_SECRET = "career-flow-test-secret";
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    closeDatabase();
    getDatabase(tmpDb);

    const a = await createUser(`flow_a_${Date.now()}`, "password123");
    const b = await createUser(`flow_b_${Date.now()}`, "password123");
    userAId = a.id;
    userBId = b.id;
    tokenA = issueTestAuthToken(a.id, a.username);
    tokenB = issueTestAuthToken(b.id, b.username);

    const server = createKouppiServer({ corsOrigin: "*", websocketOnly: true });
    httpServer = server.httpServer;
    stopCleanup = server.stopCleanup;
    expect(server.careerMatchmakingWired).toBe(true);
    expect(hasMatchFoundHandler()).toBe(true);

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    clearQueue();
    stopCleanup?.();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    closeDatabase();
    try {
      fs.unlinkSync(tmpDb);
    } catch {
      // ignore
    }
  });

  it("matchmakes two authenticated players through production wiring", async () => {
    clearQueue();
    const c1 = ioClient(serverUrl, { transports: ["websocket"] });
    const c2 = ioClient(serverUrl, { transports: ["websocket"] });

    await Promise.all([
      new Promise<void>((resolve) => c1.on("connect", () => resolve())),
      new Promise<void>((resolve) => c2.on("connect", () => resolve())),
    ]);

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        c1.emit("career:auth", { token: tokenA }, (err: unknown) => (err ? reject(err) : resolve()));
      }),
      new Promise<void>((resolve, reject) => {
        c2.emit("career:auth", { token: tokenB }, (err: unknown) => (err ? reject(err) : resolve()));
      }),
    ]);

    const matches = Promise.all([
      new Promise<any>((resolve) => c1.once("career:matchFound", resolve)),
      new Promise<any>((resolve) => c2.once("career:matchFound", resolve)),
    ]);

    await new Promise<void>((resolve, reject) => {
      c1.emit("career:joinAnte", { token: tokenA, anteId: "bronze-1" }, (err: unknown) =>
        err ? reject(err) : resolve()
      );
    });
    await new Promise<void>((resolve, reject) => {
      c2.emit("career:joinAnte", { token: tokenB, anteId: "bronze-1" }, (err: unknown) =>
        err ? reject(err) : resolve()
      );
    });

    const [m1, m2] = await matches;
    expect(m1.roomId).toBe(m2.roomId);

    c1.disconnect();
    c2.disconnect();
  }, 20000);

  it("handleCareerGameEnd applies rating delta (not absolute) after a controlled finish", async () => {
    const rating = 1250;
    getRawDb().prepare("UPDATE users SET rating = ?, trophies = ? WHERE id = ?").run(rating, 50, userAId);
    getRawDb().prepare("UPDATE users SET rating = ?, trophies = ? WHERE id = ?").run(rating, 50, userBId);

    const winner = getUserById(userAId)!;
    const loser = getUserById(userBId)!;
    const expectedWin = calculateNewRating(rating, rating, 1);
    const expectedLose = calculateNewRating(rating, rating, 0);

    const room = createCareerRoom("bronze-1");
    expect(room).toBeTruthy();
    room!.players.push(
      makePlayer(
        { id: winner.id, username: winner.username, rating, bankroll: winner.bankroll },
        "sock-a"
      ),
      makePlayer(
        { id: loser.id, username: loser.username, rating, bankroll: loser.bankroll },
        "sock-b"
      )
    );
    room!.startedAt = Date.now() - 30_000;
    const gameRoomId = `career-game-flow-${Date.now()}`;
    markRoomInGame(room!.id, gameRoomId);

    const localHttp = createServer();
    const io = new Server(localHttp);
    handleCareerGameEnd(
      gameRoomId,
      [
        { userId: winner.id, finalBankroll: 1100, chipsWon: 100, handsWon: 1, handsPlayed: 2 },
        { userId: loser.id, finalBankroll: 900, chipsWon: -100, handsWon: 0, handsPlayed: 2 },
      ],
      io
    );
    await new Promise((r) => setTimeout(r, 250));

    expect(getUserById(winner.id)!.rating).toBe(expectedWin);
    expect(getUserById(loser.id)!.rating).toBe(expectedLose);
    expect(getUserById(winner.id)!.rating).toBeLessThan(rating + 80);

    cleanupRoom(room!.id);
    io.close();
    await new Promise<void>((resolve) => localHttp.close(() => resolve()));
  });
});
