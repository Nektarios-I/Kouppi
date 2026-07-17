/**
 * Career queue algorithm tests (Sprint 2)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  joinQueue,
  leaveQueue,
  tryFindMatch,
  runMatchmaking,
  getQueueStatus,
  isInQueue,
  clearQueue,
  setQueueClock,
  resetQueueClock,
  setOnMatchFound,
  getQueueSize,
  type QueueEntry,
} from "../../src/career/queue.js";

function entry(
  id: string,
  rating: number,
  anteId = "bronze-1",
  socketId?: string
): QueueEntry {
  return {
    playerId: id,
    playerName: `Player-${id}`,
    rating,
    trophies: 0,
    socketId: socketId ?? `socket-${id}`,
    anteId,
    queuedAt: 0,
  };
}

describe("Career matchmaking queue", () => {
  let now = 1_000_000;

  beforeEach(() => {
    clearQueue();
    setOnMatchFound(() => {});
    setQueueClock(() => now);
  });

  afterEach(() => {
    clearQueue();
    resetQueueClock();
  });

  it("matches two compatible players in initial ±100 range", () => {
    joinQueue(entry("a", 1200));
    joinQueue(entry("b", 1270));
    expect(isInQueue("a")).toBe(false);
    expect(isInQueue("b")).toBe(false);
    expect(getQueueSize()).toBe(0);
  });

  it("does not match players outside initial range before expansion", () => {
    joinQueue(entry("a", 1200));
    joinQueue(entry("b", 1350));
    expect(tryFindMatch("a")).toBeNull();
    expect(getQueueSize()).toBe(2);
  });

  it("expands matching at 15-second fallback to ±250", () => {
    joinQueue(entry("a", 1200));
    joinQueue(entry("b", 1440));
    now += 15_000;
    expect(tryFindMatch("a")).toBeTruthy();
  });

  it("allows cross-tier matching up to ±400 after 30 seconds", () => {
    joinQueue(entry("a", 1100));
    joinQueue(entry("b", 1480));
    now += 30_000;
    expect(tryFindMatch("a")).toBeTruthy();
  });

  it("quick match after 45 seconds accepts any rating gap", () => {
    joinQueue(entry("a", 900));
    joinQueue(entry("b", 1900));
    now += 45_000;
    expect(tryFindMatch("a")).toBeTruthy();
  });

  it("does not falsely match a single queued player", () => {
    joinQueue(entry("solo", 1200));
    expect(runMatchmaking()).toHaveLength(0);
    expect(isInQueue("solo")).toBe(true);
  });

  it("refreshes duplicate enqueue with new socket id", () => {
    joinQueue(entry("a", 1200, "bronze-1", "socket-old"));
    joinQueue(entry("a", 1200, "bronze-2", "socket-new"));
    const status = getQueueStatus("a");
    expect(status.inQueue).toBe(true);
    expect(status.position).toBe(1);
  });

  it("removes a player on leave", () => {
    joinQueue(entry("a", 1200));
    expect(leaveQueue("a")).toBe(true);
    expect(isInQueue("a")).toBe(false);
  });

  it("removes matched players from queue", () => {
    joinQueue(entry("a", 1200));
    joinQueue(entry("b", 1210));
    runMatchmaking();
    expect(isInQueue("a")).toBe(false);
    expect(isInQueue("b")).toBe(false);
  });

  it("does not include the same player in two matches across ticks", () => {
    const matchedIds = new Set<string>();
    setOnMatchFound((match) => {
      matchedIds.add(match.player1.playerId);
      matchedIds.add(match.player2.playerId);
    });
    joinQueue(entry("a", 1200));
    joinQueue(entry("b", 1210));
    expect(matchedIds.size).toBe(2);
    expect(runMatchmaking()).toHaveLength(0);
  });

  it("reports queue position and fallback mode thresholds", () => {
    joinQueue(entry("a", 1200));
    now += 16_000;
    const status = getQueueStatus("a");
    expect(status.position).toBe(1);
    expect(status.waitTime).toBe(16);
    expect(status.searchRange).toBe(250);
    expect(status.fallbackMode).toBe("expanded");
  });

  it("invokes match callback exactly once per pairing", () => {
    const callback = vi.fn();
    setOnMatchFound(callback);
    joinQueue(entry("a", 1200));
    joinQueue(entry("b", 1210));
    tryFindMatch("a");
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
