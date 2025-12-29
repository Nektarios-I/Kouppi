import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { initGame, applyAction } from "../src/reducer";

describe("Invariants", () => {
  it("pot is never negative through random passes", () => {
    const G = initGame({
      players: [{id:"p1",name:"P1"},{id:"p2",name:"P2"}],
      seed: 1,
      config: { ante: 10, minBetPolicy: {type:"fixed", value: 1} }
    });
    let s = applyAction(G, { type: "startRound" });
    s = applyAction(s, { type: "ante" });
    s = applyAction(s, { type: "determineStarter" });
    for (let i=0;i<20;i++) {
      s = applyAction(s, { type: "startTurn" });
      if (s.turn) s = applyAction(s, { type: "pass" });
    }
    expect(s.round.pot).toBeGreaterThanOrEqual(0);
  });
});
