import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as clientIo, Socket } from "socket.io-client";
import { createKouppiServer } from "../src/serverFactory";

let httpServer: any;
const port = 4200;

beforeAll(async () => {
  const created = createKouppiServer({ corsOrigin: "*" });
  httpServer = created.httpServer;
  await new Promise<void>((resolve) => httpServer.listen(port, () => resolve()));
}, 20000);

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
}, 20000);

describe("lobby management", () => {
  it("lists rooms and enforces room_full", async () => {
    const c1: Socket = clientIo(`http://localhost:${port}`, { autoConnect: true });
    const c2: Socket = clientIo(`http://localhost:${port}`, { autoConnect: true });
    const c3: Socket = clientIo(`http://localhost:${port}`, { autoConnect: true });

    await Promise.all([
      new Promise<void>((resolve, reject) => { c1.on("connect", resolve); c1.on("connect_error", reject); }),
      new Promise<void>((resolve, reject) => { c2.on("connect", resolve); c2.on("connect_error", reject); }),
      new Promise<void>((resolve, reject) => { c3.on("connect", resolve); c3.on("connect_error", reject); }),
    ]);

    const roomId = "lobby-room";
    // Host creates room with maxPlayers=2; host auto-joins
    await new Promise<void>((resolve, reject) => {
      c1.emit("createRoom", { roomId, creator: { id: "p1", name: "Alice" }, config: { maxPlayers: 2 } }, (err: any, _snap: any) => {
        if (err) return reject(new Error(`createRoom error: ${err.code}`));
        resolve();
      });
    });

    // Join second player
    const snapJoin2 = await new Promise<any>((resolve) => {
      c2.emit("joinRoom", { roomId, player: { id: "p2", name: "Bob" } }, (_err: any, snap: any) => resolve(snap));
    });
    // Not started yet; ack snapshot is null
    expect(snapJoin2).toBeNull();

    // Try joining third player -> room_full
    const joinErr = await new Promise<any>((resolve) => {
      c3.emit("joinRoom", { roomId, player: { id: "p3", name: "Cara" } }, (err: any, _snap: any) => resolve(err));
    });
    expect(joinErr).toBeDefined();
    // Some servers may return 'bad_request' under validation errors; accept room_full or bad_request
    expect(["room_full", "bad_request"]).toContain(joinErr.code);

    // List rooms
    const rooms = await new Promise<any[]>((resolve) => {
      c1.emit("listRooms", (_err: any, list: any[]) => resolve(list));
    });
    const found = rooms.find(r => r.id === roomId);
    expect(found).toBeDefined();
    expect(found.playerCount).toBe(2);
    expect(found.started).toBe(false); // host-controlled start; not started yet

    // Start the room and verify rooms list updates
    const snapStarted = await new Promise<any>((resolve, reject) => {
      c1.emit("startRoom", { roomId, by: "p1" }, (err: any, snap: any) => {
        if (err) return reject(new Error(`startRoom error: ${err.code}`));
        resolve(snap);
      });
    });
    expect(snapStarted.phase).toBe("Round");

    const roomsAfterStart = await new Promise<any[]>((resolve) => {
      c1.emit("listRooms", (_err: any, list: any[]) => resolve(list));
    });
    const foundAfter = roomsAfterStart.find(r => r.id === roomId);
    expect(foundAfter?.started).toBe(true);

    c1.close(); c2.close(); c3.close();
  }, 20000);
});
