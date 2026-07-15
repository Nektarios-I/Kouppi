import { describe, it, expect } from "vitest";
import { BetIntent, Intent, ClientIntent, CreateRoomPayload, JoinRoomPayload, StartRoomPayload, RoomsListItem } from "../src/messages";

describe("protocol schemas", () => {
  it("validates BetIntent", () => {
    const parsed = BetIntent.parse({ type: "bet", amount: 10 });
    expect(parsed.amount).toBe(10);
  });

  it("rejects invalid BetIntent", () => {
    expect(() => BetIntent.parse({ type: "bet", amount: 0 })).toThrow();
  });

  it("validates Intent union", () => {
    const parsed = Intent.parse({ type: "pass" });
    expect(parsed.type).toBe("pass");
  });

  it("ClientIntent rejects system-only intents", () => {
    expect(() => ClientIntent.parse({ type: "nextPlayer" })).toThrow();
    expect(() => ClientIntent.parse({ type: "startTurn" })).toThrow();
    expect(ClientIntent.parse({ type: "pass" }).type).toBe("pass");
  });

  it("validates room create/join/start payloads", () => {
    const cr = CreateRoomPayload.parse({ roomId: "room-123", creator: { id: "p1", name: "Alice" }, config: { ante: 5 } });
    expect(cr.roomId).toBe("room-123");
    expect(cr.creator.id).toBe("p1");

    const jr = JoinRoomPayload.parse({ roomId: "room-123", player: { id: "p2", name: "Bob" } });
    expect(jr.player.name).toBe("Bob");

    const sr = StartRoomPayload.parse({ roomId: "room-123", by: "p1" });
    expect(sr.by).toBe("p1");
  });

  it("validates join session token on JoinRoomPayload", () => {
    const jr = JoinRoomPayload.parse({
      roomId: "room-123",
      player: { id: "p2", name: "Bob" },
      joinSessionToken: "a".repeat(24),
    });
    expect(jr.joinSessionToken?.length).toBe(24);
  });
});
