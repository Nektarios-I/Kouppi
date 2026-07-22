/**
 * CAREER Batch 1 — Tier-1 flow contract tests (current behavior characterization).
 * Uses temp SQLite + real createKouppiServer Socket.IO wiring. Requires Node 20.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import type { AddressInfo } from "net";
import fs from "fs";
import os from "os";
import path from "path";
import { createKouppiServer } from "../../src/serverFactory.js";
import { getDatabase, closeDatabase, createUser } from "@kouppi/database";
import { issueTestAuthToken } from "../helpers/authToken.js";
import {
  clearQueue,
  getQueueSize,
  isInQueue,
  runMatchmaking,
} from "../../src/career/queue.js";
import {
  clearAllCareerRoomsForTests,
  createCareerRoom,
  getAllCareerRooms,
  getAutoStartDelayMs,
  getCareerRoom,
  joinCareerRoom,
  leaveCareerRoom,
  resetAutoStartDelayMsForTests,
  setAutoStartDelayMsForTests,
  setCareerPlayerReady,
  type CareerPlayer,
} from "../../src/career/careerRoomManager.js";

const tmpDb = path.join(
  os.tmpdir(),
  `kouppi-career-flow-contracts-${process.pid}-${Date.now()}.db`
);

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

async function connectClient(baseUrl: string): Promise<ClientSocket> {
  const socket = ioc(baseUrl, { transports: ["websocket"], forceNew: true });
  await new Promise<void>((resolve, reject) => {
    socket.on("connect", () => resolve());
    socket.on("connect_error", reject);
  });
  return socket;
}

async function authClient(socket: ClientSocket, token: string): Promise<void> {
  const { err } = await emitAck(socket, "career:auth", { token });
  if (err) throw new Error(err.message ?? "auth failed");
}

describe("Career flow contracts (Batch 1)", () => {
  let httpServer: ReturnType<typeof createKouppiServer>["httpServer"];
  let stopCleanup: () => void;
  let baseUrl = "";
  let server: ReturnType<typeof createKouppiServer>;

  beforeAll(async () => {
    process.env.DATABASE_PATH = tmpDb;
    process.env.JWT_SECRET = "career-flow-contracts-secret";
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    closeDatabase();
    getDatabase(tmpDb);

    server = createKouppiServer({ corsOrigin: "*", websocketOnly: true });
    httpServer = server.httpServer;
    stopCleanup = server.stopCleanup;
    expect(server.careerMatchmakingWired).toBe(true);

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    clearQueue();
    clearAllCareerRoomsForTests();
    resetAutoStartDelayMsForTests();
    stopCleanup?.();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((e) => (e ? reject(e) : resolve()));
    });
    closeDatabase();
    try {
      fs.unlinkSync(tmpDb);
    } catch {
      // ignore
    }
  }, 20000);

  beforeEach(() => {
    clearQueue();
    clearAllCareerRoomsForTests();
    resetAutoStartDelayMsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearQueue();
    clearAllCareerRoomsForTests();
    resetAutoStartDelayMsForTests();
  });

  it("CAREER-IT-QJ-001: two authenticated Quick Joins create one room and shared matchFound", async () => {
    const u1 = await createUser(`qj1a_${Date.now().toString().slice(-6)}`, "password123");
    const u2 = await createUser(`qj1b_${Date.now().toString().slice(-6)}`, "password123");
    const t1 = issueTestAuthToken(u1.id, u1.username);
    const t2 = issueTestAuthToken(u2.id, u2.username);

    const c1 = await connectClient(baseUrl);
    const c2 = await connectClient(baseUrl);
    await authClient(c1, t1);
    await authClient(c2, t2);

    const matchP = Promise.all([
      new Promise<any>((resolve) => c1.once("career:matchFound", resolve)),
      new Promise<any>((resolve) => c2.once("career:matchFound", resolve)),
    ]);
    const roomP = Promise.all([
      new Promise<any>((resolve) => c1.once("career:roomUpdate", resolve)),
      new Promise<any>((resolve) => c2.once("career:roomUpdate", resolve)),
    ]);

    await emitAck(c1, "career:joinAnte", { token: t1, anteId: "bronze-1" });
    await emitAck(c2, "career:joinAnte", { token: t2, anteId: "bronze-1" });

    const [m1, m2] = await matchP;
    expect(m1.roomId).toBeTruthy();
    expect(m1.roomId).toBe(m2.roomId);
    expect(isInQueue(u1.id)).toBe(false);
    expect(isInQueue(u2.id)).toBe(false);
    expect(getQueueSize()).toBe(0);

    const rooms = getAllCareerRooms().filter((r) => r.id === m1.roomId);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].players).toHaveLength(2);
    expect(rooms[0].maxPlayers).toBe(2);
    expect(rooms[0].status).toBe("waiting");
    expect(rooms[0].autoStartAt).toBeNull();
    expect(rooms[0].autoStartTimer).toBeNull();
    expect(rooms[0].players.every((p) => !p.ready)).toBe(true);

    const [r1, r2] = await roomP;
    expect(r1.roomId).toBe(m1.roomId);
    expect(r2.roomId).toBe(m1.roomId);
    expect(r1.playerCount).toBe(2);
    expect(r1.status).toBe("waiting");

    // Extra matchmaking ticks must not create a second room for the same pair
    runMatchmaking();
    runMatchmaking();
    expect(getAllCareerRooms().filter((r) => r.status === "waiting" || r.status === "starting")).toHaveLength(1);

    const info1 = await emitAck<any>(c1, "career:getRoomInfo", {});
    const info2 = await emitAck<any>(c2, "career:getRoomInfo", {});
    expect(info1.err).toBeNull();
    expect(info2.err).toBeNull();
    expect(info1.data?.roomId).toBe(m1.roomId);
    expect(info2.data?.roomId).toBe(m1.roomId);
    expect(info1.data?.inRoom).toBe(true);

    c1.disconnect();
    c2.disconnect();
  }, 20000);

  it("CAREER-IT-QJ-002: duplicate Quick Join is idempotent (single queue entry)", async () => {
    const u = await createUser(`qj2_${Date.now().toString().slice(-6)}`, "password123");
    const token = issueTestAuthToken(u.id, u.username);
    const c = await connectClient(baseUrl);
    await authClient(c, token);

    const a1 = await emitAck<any>(c, "career:joinAnte", { token, anteId: "bronze-1" });
    const a2 = await emitAck<any>(c, "career:joinAnte", { token, anteId: "bronze-1" });
    expect(a1.err).toBeNull();
    expect(a2.err).toBeNull();
    expect(a1.data?.inQueue).toBe(true);
    expect(a2.data?.inQueue).toBe(true);
    expect(getQueueSize()).toBe(1);
    expect(isInQueue(u.id)).toBe(true);

    await emitAck(c, "career:leaveQueue", { token });
    c.disconnect();
  }, 15000);

  it("CAREER-IT-QJ-003: queue cancel and disconnect remove player and prevent match", async () => {
    const u1 = await createUser(`qj3a_${Date.now().toString().slice(-6)}`, "password123");
    const u2 = await createUser(`qj3b_${Date.now().toString().slice(-6)}`, "password123");
    const t1 = issueTestAuthToken(u1.id, u1.username);
    const t2 = issueTestAuthToken(u2.id, u2.username);

    // Cancel path
    const cCancel = await connectClient(baseUrl);
    await authClient(cCancel, t1);
    await emitAck(cCancel, "career:joinAnte", { token: t1, anteId: "bronze-1" });
    expect(isInQueue(u1.id)).toBe(true);
    const left = await emitAck(cCancel, "career:leaveQueue", { token: t1 });
    expect(left.err).toBeNull();
    expect(isInQueue(u1.id)).toBe(false);

    const c2 = await connectClient(baseUrl);
    await authClient(c2, t2);
    let matched = false;
    c2.on("career:matchFound", () => {
      matched = true;
    });
    await emitAck(c2, "career:joinAnte", { token: t2, anteId: "bronze-1" });
    await new Promise((r) => setTimeout(r, 100));
    expect(matched).toBe(false);
    expect(isInQueue(u2.id)).toBe(true);
    await emitAck(c2, "career:leaveQueue", { token: t2 });
    cCancel.disconnect();
    c2.disconnect();

    // Disconnect path
    const cDisc = await connectClient(baseUrl);
    await authClient(cDisc, t1);
    await emitAck(cDisc, "career:joinAnte", { token: t1, anteId: "bronze-1" });
    expect(isInQueue(u1.id)).toBe(true);
    cDisc.disconnect();
    await new Promise((r) => setTimeout(r, 50));
    expect(isInQueue(u1.id)).toBe(false);

    const cPeer = await connectClient(baseUrl);
    await authClient(cPeer, t2);
    let matchedAfterDisc = false;
    cPeer.on("career:matchFound", () => {
      matchedAfterDisc = true;
    });
    await emitAck(cPeer, "career:joinAnte", { token: t2, anteId: "bronze-1" });
    await new Promise((r) => setTimeout(r, 100));
    expect(matchedAfterDisc).toBe(false);
    await emitAck(cPeer, "career:leaveQueue", { token: t2 });
    cPeer.disconnect();
  }, 20000);

  it("CAREER-IT-CT-001: create waiting table seats creator; duplicate create is idempotent", async () => {
    const host = await createUser(`ct1_${Date.now().toString().slice(-6)}`, "password123");
    const token = issueTestAuthToken(host.id, host.username);
    const c = await connectClient(baseUrl);
    await authClient(c, token);

    const roomUpdate = new Promise<any>((resolve) => c.once("career:roomUpdate", resolve));
    const created = await emitAck<any>(c, "career:createWaitingRoom", {
      token,
      anteId: "bronze-1",
    });
    expect(created.err).toBeNull();
    expect(created.data?.success).toBe(true);
    expect(created.data?.roomId).toBeTruthy();
    expect(created.data?.room?.playerCount).toBe(1);
    expect(created.data?.room?.status).toBe("waiting");
    expect(created.data?.room?.anteId).toBe("bronze-1");
    expect(created.data?.room?.autoStartAt).toBeNull();

    const update = await roomUpdate;
    expect(update.roomId).toBe(created.data.roomId);

    const rooms = getAllCareerRooms().filter((r) => r.id === created.data.roomId);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].players[0].userId).toBe(host.id);
    expect(rooms[0].gameRoomId).toBeNull();

    const dup = await emitAck<any>(c, "career:createWaitingRoom", {
      token,
      anteId: "bronze-1",
    });
    expect(dup.err).toBeNull();
    expect(dup.data?.success).toBe(true);
    expect(dup.data?.roomId).toBe(created.data.roomId);
    expect(dup.data?.idempotent).toBe(true);
    expect(getAllCareerRooms().filter((r) => r.status === "waiting")).toHaveLength(1);

    c.disconnect();
  }, 15000);

  it("CAREER-IT-JT-001: join waiting table success and rejection matrix", async () => {
    const host = await createUser(`jt1h_${Date.now().toString().slice(-6)}`, "password123");
    const guest = await createUser(`jt1g_${Date.now().toString().slice(-6)}`, "password123");
    const other = await createUser(`jt1o_${Date.now().toString().slice(-6)}`, "password123");
    const hostTok = issueTestAuthToken(host.id, host.username);
    const guestTok = issueTestAuthToken(guest.id, guest.username);
    const otherTok = issueTestAuthToken(other.id, other.username);

    const cHost = await connectClient(baseUrl);
    const cGuest = await connectClient(baseUrl);
    const cOther = await connectClient(baseUrl);
    await authClient(cHost, hostTok);
    await authClient(cGuest, guestTok);
    await authClient(cOther, otherTok);

    const created = await emitAck<any>(cHost, "career:createWaitingRoom", {
      token: hostTok,
      anteId: "bronze-1",
    });
    const roomId = created.data!.roomId as string;
    expect(getCareerRoom(roomId)?.maxPlayers).toBe(2);

    const joined = await emitAck<any>(cGuest, "career:joinWaitingRoom", {
      token: guestTok,
      roomId,
    });
    expect(joined.err).toBeNull();
    expect(joined.data?.room?.playerCount).toBe(2);
    expect(joined.data?.roomId).toBe(roomId);
    expect(getCareerRoom(roomId)?.players.map((p) => p.userId).sort()).toEqual(
      [host.id, guest.id].sort()
    );
    // Full table at 2 — no countdown yet (neither Ready)
    expect(getCareerRoom(roomId)?.autoStartTimer).toBeNull();

    // nonexistent
    const missing = await emitAck(cOther, "career:joinWaitingRoom", {
      token: otherTok,
      roomId: "career-does-not-exist",
    });
    expect(missing.err?.code).toBe("room_not_found");

    // unauthenticated
    const cUnauth = await connectClient(baseUrl);
    const unauth = await emitAck(cUnauth, "career:joinWaitingRoom", {
      token: "not-a-jwt",
      roomId,
    });
    expect(unauth.err?.code).toBe("auth_failed");
    cUnauth.disconnect();

    // full (max 2)
    const full = await emitAck(cOther, "career:joinWaitingRoom", {
      token: otherTok,
      roomId,
    });
    expect(full.err?.code).toBe("join_failed");
    expect(full.err?.message?.toLowerCase()).toMatch(/full/);

    // Mid-countdown join locked
    const timerP = new Promise<any>((resolve) => cHost.once("career:autoStartTimer", resolve));
    await emitAck(cHost, "career:setReady", { token: hostTok, ready: true });
    await emitAck(cGuest, "career:setReady", { token: guestTok, ready: true });
    await timerP;
    expect(getCareerRoom(roomId)?.status).toBe("starting");

    const duringCountdown = await emitAck(cOther, "career:joinWaitingRoom", {
      token: otherTok,
      roomId,
    });
    expect(duringCountdown.err?.code).toBe("countdown_in_progress");

    // in-progress
    getCareerRoom(roomId)!.status = "in-game";
    const started = await emitAck(cOther, "career:joinWaitingRoom", {
      token: otherTok,
      roomId,
    });
    expect(started.err?.code).toBe("game_in_progress");

    cHost.disconnect();
    cGuest.disconnect();
    cOther.disconnect();
  }, 20000);

  it("CAREER-IT-CD-001: both Ready then auto-start once after delay; not before", async () => {
    setAutoStartDelayMsForTests(300);
    const delay = getAutoStartDelayMs();
    expect(delay).toBe(300);

    const u1 = await createUser(`cd1a_${Date.now().toString().slice(-6)}`, "password123");
    const u2 = await createUser(`cd1b_${Date.now().toString().slice(-6)}`, "password123");
    const t1 = issueTestAuthToken(u1.id, u1.username);
    const t2 = issueTestAuthToken(u2.id, u2.username);

    const c1 = await connectClient(baseUrl);
    const c2 = await connectClient(baseUrl);
    await authClient(c1, t1);
    await authClient(c2, t2);

    const matchP = Promise.all([
      new Promise<any>((resolve) => c1.once("career:matchFound", resolve)),
      new Promise<any>((resolve) => c2.once("career:matchFound", resolve)),
    ]);
    await emitAck(c1, "career:joinAnte", { token: t1, anteId: "bronze-1" });
    await emitAck(c2, "career:joinAnte", { token: t2, anteId: "bronze-1" });
    const [m1] = await matchP;
    const roomId = m1.roomId as string;

    expect(getCareerRoom(roomId)?.autoStartTimer).toBeNull();
    expect(getCareerRoom(roomId)?.status).toBe("waiting");

    // One Ready is not enough
    await emitAck(c1, "career:setReady", { token: t1, ready: true });
    expect(getCareerRoom(roomId)?.autoStartTimer).toBeNull();

    const timerP = Promise.all([
      new Promise<any>((resolve) => c1.once("career:autoStartTimer", resolve)),
      new Promise<any>((resolve) => c2.once("career:autoStartTimer", resolve)),
    ]);
    const startP = Promise.all([
      new Promise<any>((resolve) => c1.once("career:transitionToGame", resolve)),
      new Promise<any>((resolve) => c2.once("career:transitionToGame", resolve)),
    ]);

    await emitAck(c2, "career:setReady", { token: t2, ready: true });
    const [timer1] = await timerP;
    expect(timer1.secondsRemaining).toBe(delay / 1000);
    expect(getCareerRoom(roomId)?.status).toBe("starting");
    expect(getCareerRoom(roomId)?.gameRoomId).toBeNull();

    await new Promise((r) => setTimeout(r, Math.max(50, delay - 150)));
    expect(getCareerRoom(roomId)?.status).toBe("starting");
    expect(getCareerRoom(roomId)?.gameRoomId).toBeNull();

    const [s1, s2] = await startP;
    expect(s1.gameRoomId).toBeTruthy();
    expect(s1.gameRoomId).toBe(s2.gameRoomId);
    expect(getCareerRoom(roomId)?.status).toBe("in-game");
    expect(getCareerRoom(roomId)?.gameRoomId).toBe(s1.gameRoomId);

    await new Promise((r) => setTimeout(r, delay + 50));
    expect(getCareerRoom(roomId)?.gameRoomId).toBe(s1.gameRoomId);

    c1.disconnect();
    c2.disconnect();
  }, 20000);

  it("CAREER-IT-CD-002: leave during countdown cancels start", async () => {
    setAutoStartDelayMsForTests(400);

    const u1 = await createUser(`cd2a_${Date.now().toString().slice(-6)}`, "password123");
    const u2 = await createUser(`cd2b_${Date.now().toString().slice(-6)}`, "password123");
    const t1 = issueTestAuthToken(u1.id, u1.username);
    const t2 = issueTestAuthToken(u2.id, u2.username);

    const c1 = await connectClient(baseUrl);
    const c2 = await connectClient(baseUrl);
    await authClient(c1, t1);
    await authClient(c2, t2);

    const matchP = Promise.all([
      new Promise<any>((resolve) => c1.once("career:matchFound", resolve)),
      new Promise<any>((resolve) => c2.once("career:matchFound", resolve)),
    ]);
    await emitAck(c1, "career:joinAnte", { token: t1, anteId: "bronze-1" });
    await emitAck(c2, "career:joinAnte", { token: t2, anteId: "bronze-1" });
    const [m1] = await matchP;
    const roomId = m1.roomId as string;

    let started = false;
    c1.on("career:transitionToGame", () => {
      started = true;
    });
    c2.on("career:transitionToGame", () => {
      started = true;
    });

    const cancelledP = new Promise<any>((resolve) => c1.once("career:countdownCancelled", resolve));
    await emitAck(c1, "career:setReady", { token: t1, ready: true });
    await emitAck(c2, "career:setReady", { token: t2, ready: true });
    expect(getCareerRoom(roomId)?.status).toBe("starting");

    await emitAck(c2, "career:leaveRoom", { token: t2 });
    const cancelled = await cancelledP;
    expect(cancelled.reason).toBe("player_left");
    expect(getCareerRoom(roomId)?.players).toHaveLength(1);
    expect(getCareerRoom(roomId)?.autoStartTimer).toBeNull();
    expect(getCareerRoom(roomId)?.autoStartAt).toBeNull();
    expect(getCareerRoom(roomId)?.status).toBe("waiting");
    expect(getCareerRoom(roomId)?.players[0].ready).toBe(false);

    await new Promise((r) => setTimeout(r, getAutoStartDelayMs() + 200));
    expect(started).toBe(false);
    expect(getCareerRoom(roomId)?.gameRoomId).toBeNull();

    c1.disconnect();
    c2.disconnect();
  }, 20000);

  it("CAREER-IT-CD-002-unit: fake timers prove cancelled countdown does not fire start", async () => {
    setAutoStartDelayMsForTests(60_000);
    vi.useFakeTimers();

    const emits: Array<{ event: string; payload: unknown }> = [];
    const fakeIo = {
      to: (_roomId: string) => ({
        emit: (event: string, payload: unknown) => {
          emits.push({ event, payload });
        },
      }),
      sockets: { sockets: new Map() },
    } as any;

    const room = createCareerRoom("bronze-1");
    expect(room).toBeTruthy();
    const p1: CareerPlayer = {
      odlayerId: "u1",
      odlayerName: "A",
      odlating: 1200,
      odankroll: 5000,
      odocketId: "s1",
      userId: "u1",
      username: "A",
      rating: 1200,
      bankroll: 5000,
      socketId: "s1",
      avatarId: "portrait-01",
      joinedAt: Date.now(),
      ready: false,
    };
    const p2: CareerPlayer = {
      ...p1,
      odlayerId: "u2",
      odlayerName: "B",
      odocketId: "s2",
      userId: "u2",
      username: "B",
      socketId: "s2",
    };
    joinCareerRoom(room!.id, p1, fakeIo);
    joinCareerRoom(room!.id, p2, fakeIo);
    expect(getCareerRoom(room!.id)?.autoStartTimer).toBeNull();

    setCareerPlayerReady("s1", true, fakeIo);
    expect(getCareerRoom(room!.id)?.autoStartTimer).toBeNull();
    setCareerPlayerReady("s2", true, fakeIo);
    expect(getCareerRoom(room!.id)?.autoStartTimer).toBeTruthy();
    expect(getCareerRoom(room!.id)?.status).toBe("starting");
    expect(emits.some((e) => e.event === "career:autoStartTimer")).toBe(true);

    leaveCareerRoom("s2", fakeIo);
    expect(getCareerRoom(room!.id)?.autoStartTimer).toBeNull();
    expect(emits.some((e) => e.event === "career:countdownCancelled")).toBe(true);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(emits.some((e) => e.event === "career:transitionToGame")).toBe(false);
    expect(getCareerRoom(room!.id)?.status).toBe("waiting");
    expect(getCareerRoom(room!.id)?.gameRoomId).toBeNull();

    vi.useRealTimers();
  });

  it("CAREER-IT-CD-default: production auto-start delay is 60 seconds", () => {
    resetAutoStartDelayMsForTests();
    expect(getAutoStartDelayMs()).toBe(60_000);
  });

  it("CAREER-IT-NAV-001: transitionToGame then second socket can subscribeCareerRoom", async () => {
    setAutoStartDelayMsForTests(200);

    const u1 = await createUser(`nav1a_${Date.now().toString().slice(-6)}`, "password123");
    const u2 = await createUser(`nav1b_${Date.now().toString().slice(-6)}`, "password123");
    const t1 = issueTestAuthToken(u1.id, u1.username);
    const t2 = issueTestAuthToken(u2.id, u2.username);

    const lobby1 = await connectClient(baseUrl);
    const lobby2 = await connectClient(baseUrl);
    await authClient(lobby1, t1);
    await authClient(lobby2, t2);

    const matchP = Promise.all([
      new Promise<any>((resolve) => lobby1.once("career:matchFound", resolve)),
      new Promise<any>((resolve) => lobby2.once("career:matchFound", resolve)),
    ]);
    await emitAck(lobby1, "career:joinAnte", { token: t1, anteId: "bronze-1" });
    await emitAck(lobby2, "career:joinAnte", { token: t2, anteId: "bronze-1" });
    await matchP;

    const startP = Promise.all([
      new Promise<any>((resolve) => lobby1.once("career:transitionToGame", resolve)),
      new Promise<any>((resolve) => lobby2.once("career:transitionToGame", resolve)),
    ]);
    await emitAck(lobby1, "career:setReady", { token: t1, ready: true });
    await emitAck(lobby2, "career:setReady", { token: t2, ready: true });
    const [tr1, tr2] = await startP;
    expect(tr1.gameRoomId).toBe(tr2.gameRoomId);
    const gameRoomId = tr1.gameRoomId as string;

    // Dual-socket path: new clients (as /room page would) subscribe without re-joining as players
    const game1 = await connectClient(baseUrl);
    const game2 = await connectClient(baseUrl);

    const sub1 = await new Promise<{ err: any; snap: any }>((resolve) => {
      game1.emit(
        "subscribeCareerRoom",
        { roomId: gameRoomId, playerId: u1.id, playerName: u1.username },
        (err: any, snap: any) => resolve({ err: err ?? null, snap: snap ?? null })
      );
    });
    const sub2 = await new Promise<{ err: any; snap: any }>((resolve) => {
      game2.emit(
        "subscribeCareerRoom",
        { roomId: gameRoomId, playerId: u2.id, playerName: u2.username },
        (err: any, snap: any) => resolve({ err: err ?? null, snap: snap ?? null })
      );
    });

    expect(sub1.err).toBeNull();
    expect(sub2.err).toBeNull();
    expect(sub1.snap).toBeTruthy();
    expect(sub2.snap).toBeTruthy();

    lobby1.disconnect();
    lobby2.disconnect();
    game1.disconnect();
    game2.disconnect();
  }, 20000);

  it("CAREER-IT-ERR-001: queue/create/join failures return defined safe errors", async () => {
    const u = await createUser(`err1_${Date.now().toString().slice(-6)}`, "password123");
    const token = issueTestAuthToken(u.id, u.username);
    const c = await connectClient(baseUrl);
    await authClient(c, token);

    const badAuthQueue = await emitAck(c, "career:joinAnte", {
      token: "bad",
      anteId: "bronze-1",
    });
    expect(badAuthQueue.err?.code).toBe("auth_failed");
    expect(badAuthQueue.err?.message).toBeTruthy();

    const badAnte = await emitAck(c, "career:joinAnte", {
      token,
      anteId: "not-a-real-ante",
    });
    expect(badAnte.err?.code).toBe("invalid_ante");
    expect(badAnte.err?.message).toBeTruthy();

    const badCreate = await emitAck(c, "career:createWaitingRoom", {
      token,
      anteId: "not-a-real-ante",
    });
    expect(badCreate.err?.code).toBe("invalid_ante");

    const badJoin = await emitAck(c, "career:joinWaitingRoom", {
      token,
      roomId: "career-missing",
    });
    expect(badJoin.err?.code).toBe("room_not_found");
    expect(badJoin.err?.message).toBeTruthy();

    // Callback always received (no hang) — emitAck resolves
    expect(badJoin.data).toBeNull();

    c.disconnect();
  }, 15000);
});
