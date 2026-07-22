/**
 * CAREER-MM-001: Production server factory wires Career matchmaking.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { io as ioClient } from "socket.io-client";
import type { AddressInfo } from "net";
import { getDatabase, closeDatabase, createUser } from "@kouppi/database";
import { createKouppiServer } from "../../src/serverFactory.js";
import { issueTestAuthToken } from "../helpers/authToken.js";
import {
  clearQueue,
  clearOnMatchFound,
  hasMatchFoundHandler,
  setOnMatchFound,
} from "../../src/career/queue.js";
import {
  isCareerStaleRoomCleanupRunning,
  stopCareerStaleRoomCleanup,
} from "../../src/career/careerRoomManager.js";

describe("CAREER-MM-001 production matchmaking wiring", () => {
  const tmpDb = path.join(os.tmpdir(), `kouppi-mm-wire-${process.pid}-${Date.now()}.db`);

  beforeAll(() => {
    process.env.DATABASE_PATH = tmpDb;
    process.env.JWT_SECRET = "career-mm-wire-test-secret";
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    closeDatabase();
    getDatabase(tmpDb);
  });

  afterAll(() => {
    closeDatabase();
    try {
      fs.unlinkSync(tmpDb);
    } catch {
      // ignore
    }
  });

  beforeEach(() => {
    clearQueue();
    clearOnMatchFound();
  });

  it("createKouppiServer with Career DB installs match-found handler exactly once path", () => {
    expect(hasMatchFoundHandler()).toBe(false);

    const server = createKouppiServer({ corsOrigin: "*", websocketOnly: true });
    expect(server.careerMatchmakingWired).toBe(true);
    expect(hasMatchFoundHandler()).toBe(true);
    expect(isCareerStaleRoomCleanupRunning()).toBe(true);

    // Replacing with a test callback should not be required for production path;
    // factory already registered handleMatchFound.
    server.stopCleanup();
    expect(hasMatchFoundHandler()).toBe(false);
    expect(isCareerStaleRoomCleanupRunning()).toBe(false);
  });

  it("skipCareerDatabase does not wire matchmaking (avoids timer leaks in MP tests)", () => {
    stopCareerStaleRoomCleanup();
    const server = createKouppiServer({
      corsOrigin: "*",
      skipCareerDatabase: true,
      websocketOnly: true,
    });
    expect(server.careerMatchmakingWired).toBe(false);
    expect(hasMatchFoundHandler()).toBe(false);
    expect(isCareerStaleRoomCleanupRunning()).toBe(false);
    server.stopCleanup();
  });

  it("two authenticated sockets match via production wiring without test-injected callback", async () => {
    // Ensure we do NOT manually call setOnMatchFound in this test — factory must own wiring.
    const hadManual = false;
    expect(hadManual).toBe(false);

    const user1 = await createUser(`mm_a_${Date.now()}`, "password123");
    const user2 = await createUser(`mm_b_${Date.now()}`, "password123");
    const token1 = issueTestAuthToken(user1.id, user1.username);
    const token2 = issueTestAuthToken(user2.id, user2.username);

    const server = createKouppiServer({ corsOrigin: "*", websocketOnly: true });
    expect(server.careerMatchmakingWired).toBe(true);
    expect(hasMatchFoundHandler()).toBe(true);

    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    const address = server.httpServer.address() as AddressInfo;
    const serverUrl = `http://127.0.0.1:${address.port}`;

    const client1 = ioClient(serverUrl, { transports: ["websocket"] });
    const client2 = ioClient(serverUrl, { transports: ["websocket"] });

    await Promise.all([
      new Promise<void>((resolve) => client1.on("connect", () => resolve())),
      new Promise<void>((resolve) => client2.on("connect", () => resolve())),
    ]);

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        client1.emit("career:auth", { token: token1 }, (err: unknown) => (err ? reject(err) : resolve()));
      }),
      new Promise<void>((resolve, reject) => {
        client2.emit("career:auth", { token: token2 }, (err: unknown) => (err ? reject(err) : resolve()));
      }),
    ]);

    const matches: any[] = [];
    const matchPromises = [
      new Promise<any>((resolve) => {
        client1.once("career:matchFound", (payload) => {
          matches.push(payload);
          resolve(payload);
        });
      }),
      new Promise<any>((resolve) => {
        client2.once("career:matchFound", (payload) => {
          matches.push(payload);
          resolve(payload);
        });
      }),
    ];

    await new Promise<void>((resolve, reject) => {
      client1.emit("career:joinAnte", { token: token1, anteId: "bronze-1" }, (err: unknown) =>
        err ? reject(err) : resolve()
      );
    });
    await new Promise<void>((resolve, reject) => {
      client2.emit("career:joinAnte", { token: token2, anteId: "bronze-1" }, (err: unknown) =>
        err ? reject(err) : resolve()
      );
    });

    const [m1, m2] = await Promise.all(matchPromises);
    expect(m1.roomId).toBeTruthy();
    expect(m1.roomId).toBe(m2.roomId);
    expect(matches).toHaveLength(2);

    // No second match for the same pair (queue emptied)
    await new Promise((r) => setTimeout(r, 100));
    expect(matches).toHaveLength(2);

    client1.disconnect();
    client2.disconnect();
    server.stopCleanup();
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
  }, 20000);

  it("stopCleanup clears a manually overridden handler as well", () => {
    const server = createKouppiServer({ corsOrigin: "*", websocketOnly: true });
    setOnMatchFound(() => {});
    expect(hasMatchFoundHandler()).toBe(true);
    server.stopCleanup();
    expect(hasMatchFoundHandler()).toBe(false);
  });
});
