import { describe, expect, it } from "vitest";
import { applyAction, initGame } from "../src/reducer";

describe("deck configuration", () => {
  it("builds exact shoe sizes with unique ids", () => {
    const s = initGame({
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
      ],
      config: {
        deckCount: 3,
        shufflePolicy: "RESET_EACH_ROUND",
      },
      seed: 42,
    });
    expect(s.deck.length).toBe(156);
    const ids = new Set(s.deck.map((c) => c.id));
    expect(ids.size).toBe(156);
  });

  it("reset policy rebuilds full shoe each round", () => {
    let s = initGame({
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
      ],
      config: {
        deckCount: 1,
        shufflePolicy: "RESET_EACH_ROUND",
      },
      seed: 11,
    });
    s = applyAction(s, { type: "startRound" });
    s = applyAction(s, { type: "ante" });
    s = applyAction(s, { type: "determineStarter" });
    expect(s.deck.length).toBeLessThan(52);

    s = applyAction(s, { type: "nextRound" });
    expect(s.deck.length).toBe(52);
  });

  it("continuous shoe keeps remaining cards across rounds", () => {
    let s = initGame({
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
      ],
      config: {
        deckCount: 1,
        shufflePolicy: "CONTINUOUS_SHOE",
      },
      seed: 11,
    });
    s = applyAction(s, { type: "startRound" });
    s = applyAction(s, { type: "ante" });
    s = applyAction(s, { type: "determineStarter" });
    const afterStarter = s.deck.length;

    s = applyAction(s, { type: "nextRound" });
    expect(s.deck.length).toBe(afterStarter);
  });
});
