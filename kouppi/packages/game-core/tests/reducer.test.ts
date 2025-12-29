import { describe, it, expect } from "vitest";
import { initGame, applyAction } from "../src/reducer";

describe("KOUPPI reducer basic flow", () => {
  it("starts a round, antes, determines starter, and starts a turn", () => {
    const G = initGame({
      players: [{id:"p1",name:"P1"},{id:"p2",name:"P2", isBot:true}],
      seed: 42,
      config: { ante: 10, minBetPolicy: {type:"fixed", value: 5} }
    });
    let s = G;
    s = applyAction(s, { type: "startRound" });
    s = applyAction(s, { type: "ante" });
    s = applyAction(s, { type: "determineStarter" });
    s = applyAction(s, { type: "startTurn" });
    expect(s.phase).toBe("Round");
    expect(s.turn).not.toBeNull();
  });
});
