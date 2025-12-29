import { describe, it, expect } from "vitest";
import { createRoomWithCreator, joinRoom, handleIntent, snapshot, startRoom } from "../src/rooms";
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
    handleIntent("r2", "p1", { type: "startTurn" });
    const state = snapshot("r2");
    expect(state?.phase).toBe("Round");
    expect(state?.turn).not.toBeNull();
  });
});
