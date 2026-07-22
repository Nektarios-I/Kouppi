/**
 * Career waiting-table sockets — waiting only, no late join to in-progress.
 */
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import type { AddressInfo } from "net";
import fs from "fs";
import os from "os";
import path from "path";
import { createKouppiServer } from "../../src/serverFactory.js";
import { getDatabase, closeDatabase, createUser } from "@kouppi/database";
import { issueTestAuthToken } from "../helpers/authToken.js";
import {
  createCareerRoom,
  joinCareerRoom,
  type CareerPlayer,
} from "../../src/career/careerRoomManager.js";
import { clearQueue, clearOnMatchFound } from "../../src/career/queue.js";

const tmpDb = path.join(os.tmpdir(), `kouppi-career-wait-${process.pid}-${Date.now()}.db`);

function emitAck<T>(
  socket: ClientSocket,
  event: string,
  payload: unknown
): Promise<{ err: { code?: string; message?: string } | null; data: T | null }> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (err: { code?: string; message?: string } | null, data: T) => {
      resolve({ err: err ?? null, data: data ?? null });
    });
  });
}

describe("Career waiting tables (Phase 5)", () => {
  beforeAll(() => {
    process.env.DATABASE_PATH = tmpDb;
    process.env.JWT_SECRET = "test-secret-career-wait";
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

  it("joinAnte ACK returns queueJoined payload (cb + event contract)", async () => {
    const user = await createUser(`wait_q_${Date.now()}`, "password123");
    const token = issueTestAuthToken(user.id, user.username);
    const server = createKouppiServer({ corsOrigin: "*", websocketOnly: true });
    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    const address = server.httpServer.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const socket = ioc(baseUrl, { transports: ["websocket"], forceNew: true });
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });

    const { err, data } = await emitAck<{
      inQueue: boolean;
      position: number;
      anteId: string;
      tierId: string;
    }>(socket, "career:joinAnte", { token, anteId: "bronze-1" });

    expect(err).toBeNull();
    expect(data?.inQueue).toBe(true);
    expect(data?.anteId).toBe("bronze-1");

    await emitAck(socket, "career:leaveQueue", { token });
    socket.disconnect();
    server.stopCleanup();
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close((e) => (e ? reject(e) : resolve()));
    });
  });

  it("rejects joinWaitingRoom when status is not waiting", async () => {
    const host = await createUser(`wait_h_${Date.now()}`, "password123");
    const guest = await createUser(`wait_g_${Date.now()}`, "password123");
    const guestToken = issueTestAuthToken(guest.id, guest.username);

    const server = createKouppiServer({ corsOrigin: "*", websocketOnly: true });
    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    const address = server.httpServer.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const room = createCareerRoom("bronze-1");
    expect(room).toBeTruthy();
    if (!room) return;

    const hostPlayer: CareerPlayer = {
      odlayerId: host.id,
      odlayerName: host.username,
      odlating: host.rating,
      odankroll: host.bankroll,
      odocketId: "fake-host-socket",
      userId: host.id,
      username: host.username,
      rating: host.rating,
      bankroll: host.bankroll,
      socketId: "fake-host-socket",
      avatarEmoji: host.avatarEmoji,
      avatarColor: host.avatarColor,
      avatarBorder: host.avatarBorder,
      joinedAt: Date.now(),
    };
    joinCareerRoom(room.id, hostPlayer, server.io);
    room.status = "in-game";

    const socket = ioc(baseUrl, { transports: ["websocket"], forceNew: true });
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });

    const { err } = await emitAck(socket, "career:joinWaitingRoom", {
      token: guestToken,
      roomId: room.id,
    });
    expect(err?.code).toBe("game_in_progress");
    socket.disconnect();
    server.stopCleanup();
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close((e) => (e ? reject(e) : resolve()));
    });
  });

  it("createWaitingRoom seats creator and returns room in ACK", async () => {
    const host = await createUser(`cw_${Date.now().toString().slice(-8)}`, "password123");
    const token = issueTestAuthToken(host.id, host.username);
    const server = createKouppiServer({ corsOrigin: "*", websocketOnly: true });
    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    const address = server.httpServer.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const socket = ioc(baseUrl, { transports: ["websocket"], forceNew: true });
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });

    const roomUpdate = new Promise<any>((resolve) => {
      socket.once("career:roomUpdate", resolve);
    });

    const { err, data } = await emitAck<{
      success: boolean;
      roomId: string;
      room: { roomId: string; playerCount: number; status: string };
    }>(socket, "career:createWaitingRoom", { token, anteId: "bronze-1" });

    expect(err).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.roomId).toBeTruthy();
    expect(data?.room?.playerCount).toBe(1);
    expect(data?.room?.status).toBe("waiting");

    const update = await roomUpdate;
    expect(update.roomId).toBe(data?.roomId);
    expect(update.playerCount).toBe(1);

    socket.disconnect();
    server.stopCleanup();
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close((e) => (e ? reject(e) : resolve()));
    });
  });

  it("lists all waiting rooms when anteId is omitted", async () => {
    const host = await createUser(`wa_${Date.now().toString().slice(-8)}`, "password123");
    const token = issueTestAuthToken(host.id, host.username);
    const server = createKouppiServer({ corsOrigin: "*", websocketOnly: true });
    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    const address = server.httpServer.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const room = createCareerRoom("bronze-1");
    expect(room).toBeTruthy();
    if (!room) return;

    const hostPlayer: CareerPlayer = {
      odlayerId: host.id,
      odlayerName: host.username,
      odlating: host.rating,
      odankroll: host.bankroll,
      odocketId: "fake-host-all",
      userId: host.id,
      username: host.username,
      rating: host.rating,
      bankroll: host.bankroll,
      socketId: "fake-host-all",
      avatarEmoji: host.avatarEmoji,
      avatarColor: host.avatarColor,
      avatarBorder: host.avatarBorder,
      joinedAt: Date.now(),
    };
    joinCareerRoom(room.id, hostPlayer, server.io);

    const socket = ioc(baseUrl, { transports: ["websocket"], forceNew: true });
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });

    const { err, data } = await emitAck<{ rooms: Array<{ roomId: string; status: string }> }>(
      socket,
      "career:listWaitingRooms",
      { token }
    );
    expect(err).toBeNull();
    expect(data?.rooms.some((r) => r.roomId === room.id && r.status === "waiting")).toBe(true);

    socket.disconnect();
    server.stopCleanup();
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close((e) => (e ? reject(e) : resolve()));
    });
  });
});
