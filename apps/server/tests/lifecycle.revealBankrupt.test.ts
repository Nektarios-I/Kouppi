import { describe, it, expect, beforeEach } from "vitest";
import { ROUND_RESULT_REVEAL_DELAY_MS, defaultAnteProgression, deriveAnte } from "@kouppi/game-core";
import {
  createRoomWithCreator,
  demoteBankruptPlayers,
  getRoom,
  resetAllRoomsForTests,
  startRoom,
} from "../src/rooms";
import { resetRateLimits } from "../src/security/rateLimit";

beforeEach(() => {
  resetRateLimits();
  resetAllRoomsForTests();
});

describe("ROUND_RESULT_REVEAL_DELAY_MS", () => {
  it("is 3000ms centralized in game-core", () => {
    expect(ROUND_RESULT_REVEAL_DELAY_MS).toBe(3000);
  });
});

describe("demoteBankruptPlayers", () => {
  it("demotes zero-bankroll seats to spectators and keeps winners", () => {
    const room = createRoomWithCreator(
      "room-bust-1",
      { id: "h1", name: "Host", socketId: "sock-h" },
      {
        ante: 10,
        startingBankroll: 100,
        maxPlayers: 3,
        spectatorsAllowed: true,
        anteProgression: defaultAnteProgression(10),
      } as any,
      42
    );
    room.players.push({
      id: "g1",
      name: "Guest",
      socketId: "sock-g",
      ready: true,
    });
    room.players.push({
      id: "g2",
      name: "Broke",
      socketId: "sock-b",
      ready: true,
    });
    for (const p of room.players) p.ready = true;
    startRoom("room-bust-1", "h1");

    const live = getRoom("room-bust-1")!;
    expect(live.state).toBeTruthy();
    const broke = live.state!.players.find((p) => p.id === "g2")!;
    broke.bankroll = 0;
    const host = live.state!.players.find((p) => p.id === "h1")!;
    host.bankroll = 80;

    const demoted = demoteBankruptPlayers("room-bust-1");
    expect(demoted.map((d) => d.id)).toContain("g2");
    expect(demoted.find((d) => d.id === "g2")?.toSpectator).toBe(true);
    expect(live.players.some((p) => p.id === "g2")).toBe(false);
    expect(live.spectators?.some((s) => s.id === "g2")).toBe(true);
    expect(live.players.some((p) => p.id === "h1")).toBe(true);
    // Idempotent
    expect(demoteBankruptPlayers("room-bust-1")).toEqual([]);
  });
});

describe("room ante progression defaults", () => {
  it("stores starting ante progression on create", () => {
    const room = createRoomWithCreator(
      "room-ante-1",
      { id: "h1", name: "Host", socketId: "sock-h" },
      { ante: 10 } as any,
      1
    );
    expect(room.config.anteProgression?.enabled).toBe(true);
    expect(room.config.anteProgression?.intervalRounds).toBe(5);
    expect(room.config.ante).toBe(10);
    expect(deriveAnte(room.config.anteProgression!, 5)).toBe(20);
  });
});
