import { describe, it, expect } from "vitest";
import { initGame, applyAction } from "../src/reducer";

/**
 * Invariant: During a Round, the game should never be in a state where
 * - `turn` is null AND `awaitNext` is false.
 * In other words, either a player's turn with upcards is active,
 * or we're awaiting result display before moving to next player.
 */

describe("flow invariants", () => {
  it("ensures always actionable or awaiting resolution", () => {
    const state0 = initGame({
      players: [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" },
      ],
    });

    // Start a round
    let s = applyAction(state0, { type: "startRound" });
    s = applyAction(s, { type: "ante" });
    s = applyAction(s, { type: "determineStarter" });
    s = applyAction(s, { type: "startTurn" });

    // Helper to assert invariant in Round phase
    const assertInvariant = (st: any) => {
      if (st.phase === "Round") {
        const hasTurn = !!st.turn && !!st.turn.upcards;
        const awaiting = !!st.awaitNext;
        expect(hasTurn || awaiting).toBe(true);
      }
    };

    // Check initial turn
    assertInvariant(s);

    // Simulate a pass, then nextPlayer + startTurn
    s = applyAction(s, { type: "pass" });
    assertInvariant(s);
    s = applyAction(s, { type: "nextPlayer" });
    // After nextPlayer alone, invariant may be temporarily violated; server should call startTurn.
    // Simulate server calling startTurn immediately to maintain invariant.
    s = applyAction(s, { type: "startTurn" });
    assertInvariant(s);

    // Simulate a regular bet flow
    s = applyAction(s, { type: "bet", amount: 5 });
    assertInvariant(s);
    s = applyAction(s, { type: "nextPlayer" });
    s = applyAction(s, { type: "startTurn" });
    assertInvariant(s);

    // Simulate multiple cycles and ensure invariant holds
    for (let i = 0; i < 5; i++) {
      s = applyAction(s, { type: "pass" });
      assertInvariant(s);
      s = applyAction(s, { type: "nextPlayer" });
      s = applyAction(s, { type: "startTurn" });
      assertInvariant(s);
    }
  });
});
