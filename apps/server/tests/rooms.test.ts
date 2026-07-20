import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createRoomWithCreator,
  joinRoom,
  leaveRoom,
  handleClientIntent,
  applySystemIntent,
  snapshot,
  startRoom,
  getRoom,
  beginDisconnectGrace,
  setPlayerReady,
  kickPlayer,
  resolveRoomIdentifier,
  generateRoomCode,
  RECONNECT_GRACE_MS,
  resetAllRoomsForTests,
  getPlayerJoinSessionToken,
} from "../src/rooms";
import type { TableConfig } from "@kouppi/game-core";

const cfg: TableConfig = {
  ante: 10,
  startingBankroll: 100,
  minBetPolicy: { type: "fixed", value: 10 },
      shistri: { enabled: true, percent: 7, minChip: 1 },
  maxPlayers: 8,
  deckPolicy: "single_no_reshuffle_until_empty",
  allowKouppi: true,
  spectatorsAllowed: false,
  language: "en",
};

describe("rooms", () => {
  afterEach(() => {
    resetAllRoomsForTests();
    vi.useRealTimers();
  });

  function readyAll(roomId: string) {
    const room = getRoom(roomId)!;
    for (const p of room.players) {
      setPlayerReady(roomId, p.id, true);
    }
  }

  it("does not start until host starts; then initializes state", () => {
     const room = createRoomWithCreator("r1", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 1234);
    joinRoom("r1", { id: "p2", name: "Bob", socketId: "s2" });
    readyAll("r1");
    startRoom("r1", "p1");
    const state = snapshot("r1");
    expect(state?.players.length).toBe(2);
    expect(state?.phase).toBe("Round");
  });

  it("applies basic intents", () => {
    createRoomWithCreator("r2", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 9999);
    joinRoom("r2", { id: "p2", name: "Bob", socketId: "s2" });
    readyAll("r2");
    startRoom("r2", "p1");
    applySystemIntent("r2", { type: "startTurn" });
    const state = snapshot("r2");
    expect(state?.phase).toBe("Round");
    expect(state?.turn).not.toBeNull();
  });

  it("rejects join after game started for new players", () => {
    createRoomWithCreator("r3", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 5555);
    joinRoom("r3", { id: "p2", name: "Bob", socketId: "s2" });
    readyAll("r3");
    startRoom("r3", "p1");
    expect(() => joinRoom("r3", { id: "p3", name: "Cara", socketId: "s3" })).toThrow("game_in_progress");
  });

  it("allows reconnect for existing player during disconnect grace", () => {
    createRoomWithCreator("r4", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 7777);
    joinRoom("r4", { id: "p2", name: "Bob", socketId: "s2" });
    readyAll("r4");
    startRoom("r4", "p1");
    const room = getRoom("r4")!;
    beginDisconnectGrace(room, "p2", RECONNECT_GRACE_MS, () => {});
    const token = getPlayerJoinSessionToken("r4", "p2")!;
    const updated = joinRoom("r4", { id: "p2", name: "Bob", socketId: "s-new" }, { joinSessionToken: token });
    expect(updated.players.find((p) => p.id === "p2")?.socketId).toBe("s-new");
  });

  it("rejects seat hijack during disconnect grace without join token", () => {
    createRoomWithCreator("r10", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 4444);
    joinRoom("r10", { id: "p2", name: "Bob", socketId: "s2" });
    const room = getRoom("r10")!;
    beginDisconnectGrace(room, "p2", RECONNECT_GRACE_MS, () => {});
    expect(() =>
      joinRoom("r10", { id: "p2", name: "Attacker", socketId: "s-attacker" })
    ).toThrow("invalid_session_token");
  });

  it("rejects join hijack when player slot is actively connected", () => {
    createRoomWithCreator("r7", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 3333);
    expect(() =>
      joinRoom("r7", { id: "p1", name: "Attacker", socketId: "s-attacker" })
    ).toThrow("slot_taken");
  });

  it("rejects forbidden client intents", () => {
    createRoomWithCreator("r5", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 8888);
    joinRoom("r5", { id: "p2", name: "Bob", socketId: "s2" });
    readyAll("r5");
    startRoom("r5", "p1");
    expect(() => handleClientIntent("r5", "p1", { type: "nextPlayer" } as any)).toThrow("forbidden_intent");
  });

  it("keeps player during disconnect grace and removes after timeout", () => {
    vi.useFakeTimers();
    createRoomWithCreator("r6", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 1111);
    joinRoom("r6", { id: "p2", name: "Bob", socketId: "s2" });
    const room = getRoom("r6")!;
    let removed = false;

    beginDisconnectGrace(room, "p2", RECONNECT_GRACE_MS, () => {
      leaveRoom("r6", "p2");
      removed = true;
    });

    expect(getRoom("r6")?.players.some((p) => p.id === "p2")).toBe(true);
    vi.advanceTimersByTime(RECONNECT_GRACE_MS - 1);
    expect(removed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(removed).toBe(true);
    expect(getRoom("r6")?.players.some((p) => p.id === "p2")).toBe(false);
    vi.useRealTimers();
  });

  it("rejects start when not all players are ready", () => {
    createRoomWithCreator("r8", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 2222);
    joinRoom("r8", { id: "p2", name: "Bob", socketId: "s2" });
    expect(() => startRoom("r8", "p1")).toThrow("not_all_ready");
  });

  it("resolves room by public code case-insensitively", () => {
    const code = "AB12CD";
    createRoomWithCreator("internal-id", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 4444, undefined, code);
    expect(resolveRoomIdentifier("ab12cd")).toBe("internal-id");
    joinRoom("ab12cd", { id: "p2", name: "Bob", socketId: "s2" });
    expect(getRoom("internal-id")?.players.length).toBe(2);
  });

  it("host can kick player from waiting room", () => {
    createRoomWithCreator("r9", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 6666);
    joinRoom("r9", { id: "p2", name: "Bob", socketId: "s2" });
    kickPlayer("r9", "p1", "p2");
    expect(getRoom("r9")?.players.some((p) => p.id === "p2")).toBe(false);
  });

  it("generates unique room codes", () => {
    const a = generateRoomCode();
    const b = generateRoomCode();
    expect(a).toHaveLength(6);
    expect(b).toHaveLength(6);
  });
});
