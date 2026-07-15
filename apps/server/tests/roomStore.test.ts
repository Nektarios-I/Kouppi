import { describe, it, expect } from "vitest";
import { InMemoryRoomStore } from "../src/stores/roomStore.js";
import { serializeRoom, deserializeRoom, toRoomSnapshot } from "../src/stores/roomSnapshot.js";
import type { Room } from "../src/types.js";

function makeRoom(id: string): Room {
  return {
    id,
    code: "ABC123",
    seed: 42,
    config: {
      ante: 10,
      startingBankroll: 100,
      minBetPolicy: { type: "fixed", value: 10 },
      shistri: { enabled: true, percent: 5, minChip: 1 },
      maxPlayers: 8,
      deckPolicy: "single_no_reshuffle_until_empty",
      allowKouppi: true,
      spectatorsAllowed: true,
      language: "en",
    } as Room["config"],
    maxPlayers: 8,
    players: [],
    started: false,
    revision: 0,
    stateRevision: 0,
    listedInLobby: true,
    createdAt: Date.now(),
  };
}

describe("room store", () => {
  it("in-memory store get/set/delete and code resolution", () => {
    const store = new InMemoryRoomStore();
    const room = makeRoom("room-1");
    store.set(room.id, room);
    store.registerCode(room);

    expect(store.get("room-1")).toBeDefined();
    expect(store.resolveCode("abc123")).toBe("room-1");
    expect(store.has("room-1")).toBe(true);

    store.delete("room-1");
    expect(store.get("room-1")).toBeUndefined();
  });

  it("serializes room without runtime timer handles", () => {
    const room = makeRoom("room-2");
    room.turnTimer = setTimeout(() => {}, 1000) as unknown as Room["turnTimer"];
    const json = serializeRoom(room);
    const restored = deserializeRoom(json);
    expect(restored.turnTimer).toBeUndefined();
    expect(restored.id).toBe("room-2");

    const snapshot = toRoomSnapshot(room);
    expect(snapshot.turnTimer).toBeUndefined();
  });
});
