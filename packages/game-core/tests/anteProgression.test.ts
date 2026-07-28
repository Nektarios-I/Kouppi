import { describe, expect, it } from "vitest";
import {
  defaultAnteProgression,
  deriveAnte,
  normalizeAnteProgression,
} from "../src/anteProgression";
import { ROUND_RESULT_REVEAL_DELAY_MS } from "../src/timing";
import { applyAction, initGame } from "../src/reducer";

describe("ROUND_RESULT_REVEAL_DELAY_MS", () => {
  it("is centralized at 3000ms", () => {
    expect(ROUND_RESULT_REVEAL_DELAY_MS).toBe(3000);
  });
});

describe("deriveAnte", () => {
  const base = defaultAnteProgression(10);

  it("keeps starting ante for rounds 0-4", () => {
    for (let r = 0; r < 5; r++) {
      expect(deriveAnte(base, r)).toBe(10);
    }
  });

  it("doubles after 5 and 10 completed rounds", () => {
    expect(deriveAnte(base, 5)).toBe(20);
    expect(deriveAnte(base, 9)).toBe(20);
    expect(deriveAnte(base, 10)).toBe(40);
    expect(deriveAnte(base, 15)).toBe(80);
  });

  it("supports ADD strategy and maxAnte cap", () => {
    const add = normalizeAnteProgression(
      {
        enabled: true,
        strategy: "ADD",
        intervalRounds: 3,
        incrementAmount: 5,
        startingAnte: 10,
        maxAnte: 18,
      },
      10
    );
    expect(deriveAnte(add, 0)).toBe(10);
    expect(deriveAnte(add, 3)).toBe(15);
    expect(deriveAnte(add, 6)).toBe(18); // capped
  });

  it("returns flat ante when disabled", () => {
    const flat = normalizeAnteProgression({ enabled: false, startingAnte: 25 }, 25);
    expect(deriveAnte(flat, 100)).toBe(25);
  });
});

describe("ante progression in reducer", () => {
  it("charges derived ante after completed rounds", () => {
    let s = initGame({
      players: [
        { id: "p1", name: "P1" },
        { id: "p2", name: "P2" },
      ],
      seed: 1,
      config: {
        ante: 10,
        startingBankroll: 500,
        anteProgression: defaultAnteProgression(10),
      },
    });
    expect(s.config.anteProgression?.startingAnte).toBe(10);
    s = applyAction(s, { type: "startRound" });
    s = applyAction(s, { type: "ante" });
    expect(s.config.ante).toBe(10);
    expect(s.round.pot).toBe(20);

    s.completedRounds = 5;
    s.round.pot = 0;
    s = applyAction(s, { type: "nextRound" });
    s = applyAction(s, { type: "ante" });
    expect(s.config.ante).toBe(20);
    expect(s.round.pot).toBe(40);
  });
});
