/**
 * Career queue Socket.IO integration tests (Sprint 2)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import path from "path";
import fs from "fs";
import os from "os";
import {
  getDatabase,
  closeDatabase,
  createUser,
  getRawDb,
} from "@kouppi/database";
import { createKouppiServer } from "../../src/serverFactory.js";
import { generateToken } from "../../src/auth/jwt.js";
import { clearQueue } from "../../src/career/queue.js";
import { roomsInfo } from "../../src/rooms.js";
import type { AddressInfo } from "net";

const tmpDb = path.join(os.tmpdir(), `kouppi-career-queue-${Date.now()}.db`);

function dbAvailable(): boolean {
  try {
    getRawDb();
    return true;
  } catch {
    return false;
  }
}

describe("Career queue integration", () => {
  let httpServer: ReturnType<typeof createKouppiServer>["httpServer"];
  let stopCleanup: () => void;
  let serverUrl = "";
  let user1Token = "";
  let user2Token = "";

  beforeAll(async () => {
    process.env.DATABASE_PATH = tmpDb;
    process.env.JWT_SECRET = "career-queue-test-secret";
    getDatabase(tmpDb);

    const user1 = await createUser("career_queue_a", "password123");
    const user2 = await createUser("career_queue_b", "password123");
    user1Token = generateToken(user1.id, user1.username);
    user2Token = generateToken(user2.id, user2.username);

    const server = createKouppiServer({ corsOrigin: "*", websocketOnly: true });
    httpServer = server.httpServer;
    stopCleanup = server.stopCleanup;
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    stopCleanup?.();
    httpServer?.close();
    closeDatabase();
    try {
      fs.unlinkSync(tmpDb);
    } catch {
      // ignore
    }
  });

  beforeEach(() => {
    clearQueue();
  });

  it("matches two authenticated clients and emits career:matchFound with same room id", async () => {
    if (!dbAvailable()) return;

    const client1 = ioClient(serverUrl, { transports: ["websocket"] });
    const client2 = ioClient(serverUrl, { transports: ["websocket"] });

    await Promise.all([
      new Promise<void>((resolve) => client1.on("connect", () => resolve())),
      new Promise<void>((resolve) => client2.on("connect", () => resolve())),
    ]);

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        client1.emit("career:auth", { token: user1Token }, (err: any) => (err ? reject(err) : resolve()));
      }),
      new Promise<void>((resolve, reject) => {
        client2.emit("career:auth", { token: user2Token }, (err: any) => (err ? reject(err) : resolve()));
      }),
    ]);

    const matchPromises = [
      new Promise<any>((resolve) => client1.once("career:matchFound", resolve)),
      new Promise<any>((resolve) => client2.once("career:matchFound", resolve)),
    ];

    await new Promise<void>((resolve, reject) => {
      client1.emit("career:joinAnte", { token: user1Token, anteId: "bronze-1" }, (err: any) =>
        err ? reject(err) : resolve()
      );
    });

    await new Promise<void>((resolve, reject) => {
      client2.emit("career:joinAnte", { token: user2Token, anteId: "bronze-1" }, (err: any) =>
        err ? reject(err) : resolve()
      );
    });

    const [match1, match2] = await Promise.all(matchPromises);
    expect(match1.roomId).toBeTruthy();
    expect(match1.roomId).toBe(match2.roomId);
    expect(match1.opponent.username).toBeTruthy();

    client1.disconnect();
    client2.disconnect();
  }, 15000);

  it("excludes career game rooms from casual lobby listing after transition", async () => {
    if (!dbAvailable()) return;
    expect(roomsInfo().every((room) => !room.id.startsWith("career-game-"))).toBe(true);
  });

  it("removes a player from queue on disconnect before matching", async () => {
    if (!dbAvailable()) return;

    const client = ioClient(serverUrl, { transports: ["websocket"] });
    await new Promise<void>((resolve) => client.on("connect", () => resolve()));
    await new Promise<void>((resolve, reject) => {
      client.emit("career:auth", { token: user1Token }, (err: any) => (err ? reject(err) : resolve()));
    });
    await new Promise<void>((resolve, reject) => {
      client.emit("career:joinAnte", { token: user1Token, anteId: "bronze-1" }, (err: any) =>
        err ? reject(err) : resolve()
      );
    });

    client.disconnect();

    await new Promise<void>((resolve, reject) => {
      const checker = ioClient(serverUrl, { transports: ["websocket"] });
      checker.on("connect", () => {
        checker.emit("career:auth", { token: user1Token }, (err: any) => {
          if (err) {
            checker.disconnect();
            reject(err);
            return;
          }
          checker.emit("career:getQueueStatus", { token: user1Token }, (statusErr: any, data: any) => {
            checker.disconnect();
            if (statusErr) reject(statusErr);
            else {
              expect(data.inQueue).toBe(false);
              resolve();
            }
          });
        });
      });
    });
  }, 15000);
});
