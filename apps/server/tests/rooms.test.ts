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
  RECONNECT_GRACE_MS,
} from "../src/rooms";
import type { TableConfig } from "@kouppi/game-core";

const cfg: TableConfig = {
  ante: 10,
  startingBankroll: 100,
  minBetPolicy: { type: "fixed", value: 10 },
  shistri: { enabled: true, percent: 5, minChip: 1 },
  maxPlayers: 8,
  deckPolicy: "single_no_reshuffle_until_empty",
  allowKouppi: true,
  spectatorsAllowed: false,
  language: "en",
};

describe("rooms", () => {
  it("does not start until host starts; then initializes state", () => {
     const room = createRoomWithCreator("r1", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 1234);
    joinRoom("r1", { id: "p2", name: "Bob", socketId: "s2" });
    expect(snapshot("r1")).toBeUndefined();
    startRoom("r1", "p1");
    const state = snapshot("r1");
    expect(state?.players.length).toBe(2);
    expect(state?.phase).toBe("Round");
  });

  it("applies basic intents", () => {
    createRoomWithCreator("r2", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 9999);
    joinRoom("r2", { id: "p2", name: "Bob", socketId: "s2" });

    startRoom("r2", "p1");
    applySystemIntent("r2", { type: "startTurn" });
    const state = snapshot("r2");
    expect(state?.phase).toBe("Round");
    expect(state?.turn).not.toBeNull();
  });

  it("rejects join after game started for new players", () => {
    createRoomWithCreator("r3", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 5555);
    joinRoom("r3", { id: "p2", name: "Bob", socketId: "s2" });
    startRoom("r3", "p1");
    expect(() => joinRoom("r3", { id: "p3", name: "Cara", socketId: "s3" })).toThrow("game_in_progress");
  });

  it("allows reconnect for existing player after start", () => {
    createRoomWithCreator("r4", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 7777);
    joinRoom("r4", { id: "p2", name: "Bob", socketId: "s2" });
    startRoom("r4", "p1");
    const room = joinRoom("r4", { id: "p2", name: "Bob", socketId: "s-new" });
    expect(room.players.find((p) => p.id === "p2")?.socketId).toBe("s-new");
  });

  it("rejects forbidden client intents", () => {
    createRoomWithCreator("r5", { id: "p1", name: "Alice", socketId: "s1" }, cfg, 8888);
    joinRoom("r5", { id: "p2", name: "Bob", socketId: "s2" });
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

  afterEach(() => {
    vi.useRealTimers();
  });
});
