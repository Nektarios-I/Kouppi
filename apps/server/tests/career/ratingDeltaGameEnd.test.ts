/**
 * CAREER-RATE-001 integration: handleCareerGameEnd applies rating *delta*.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { Server } from "socket.io";
import { createServer } from "http";
import {
  getDatabase,
  closeDatabase,
  createUser,
  getUserById,
  calculateNewRating,
  getRawDb,
} from "@kouppi/database";
import {
  createCareerRoom,
  markRoomInGame,
  handleCareerGameEnd,
  cleanupRoom,
  type CareerPlayer,
} from "../../src/career/careerRoomManager.js";

const tmpDb = path.join(os.tmpdir(), `kouppi-career-rate-end-${process.pid}-${Date.now()}.db`);

function makePlayer(user: { id: string; username: string; rating: number; bankroll: number }, socketId: string): CareerPlayer {
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

describe("CAREER-RATE-001 handleCareerGameEnd uses rating delta", () => {
  let io: Server;
  let httpServer: ReturnType<typeof createServer>;

  beforeAll(() => {
    process.env.DATABASE_PATH = tmpDb;
    process.env.JWT_SECRET = "career-rate-end-secret";
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    closeDatabase();
    getDatabase(tmpDb);
    httpServer = createServer();
    io = new Server(httpServer);
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    closeDatabase();
    try {
      fs.unlinkSync(tmpDb);
    } catch {
      // ignore
    }
  });

  beforeEach(() => {
    // no-op; each test creates its own room id
  });

  it("stores Elo delta result, not previousRating + absoluteNewRating", async () => {
    const winnerProfile = await createUser(`win_${Date.now()}`, "password123");
    const loserProfile = await createUser(`lose_${Date.now()}`, "password123");

    const rating = 1300;
    getRawDb().prepare("UPDATE users SET rating = ?, trophies = ? WHERE id = ?").run(rating, 100, winnerProfile.id);
    getRawDb().prepare("UPDATE users SET rating = ?, trophies = ? WHERE id = ?").run(rating, 100, loserProfile.id);

    const winner = getUserById(winnerProfile.id)!;
    const loser = getUserById(loserProfile.id)!;

    const room = createCareerRoom("bronze-1");
    expect(room).toBeTruthy();
    room!.players.push(
      makePlayer({ id: winner.id, username: winner.username, rating: winner.rating, bankroll: winner.bankroll }, "sock-w"),
      makePlayer({ id: loser.id, username: loser.username, rating: loser.rating, bankroll: loser.bankroll }, "sock-l")
    );
    room!.startedAt = Date.now() - 60_000;

    const gameRoomId = `career-game-rate-${Date.now()}`;
    expect(markRoomInGame(room!.id, gameRoomId)).toBe(true);

    const expectedWinnerRating = calculateNewRating(rating, rating, 1);
    const expectedLoserRating = calculateNewRating(rating, rating, 0);

    handleCareerGameEnd(
      gameRoomId,
      [
        {
          userId: winner.id,
          finalBankroll: 1200,
          chipsWon: 200,
          handsWon: 2,
          handsPlayed: 3,
        },
        {
          userId: loser.id,
          finalBankroll: 800,
          chipsWon: -200,
          handsWon: 1,
          handsPlayed: 3,
        },
      ],
      io
    );

    // handleCareerGameEnd uses dynamic import().then — wait briefly
    await new Promise((r) => setTimeout(r, 200));

    const winnerAfter = getUserById(winner.id)!;
    const loserAfter = getUserById(loser.id)!;

    expect(winnerAfter.rating).toBe(expectedWinnerRating);
    expect(loserAfter.rating).toBe(expectedLoserRating);

    // Absolute-rating bug would yield ~1300 + ~1316
    expect(winnerAfter.rating).toBeLessThan(rating + 80);
    expect(loserAfter.rating).toBeGreaterThan(rating - 80);
    expect(winnerAfter.rating).not.toBe(rating + expectedWinnerRating);

    cleanupRoom(room!.id);
  });
});
