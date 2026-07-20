/**
 * SHISTRI eligibility, stake, and resolution regression tests.
 * Business rule: eligible iff abs(rank1 - rank2) === 2 (Ace=1 … King=13).
 * Stake = configurable percent of pot (product intent: 7%; shipped default still 5%).
 */
import { describe, it, expect } from "vitest";
import { canShistri, gapSize, shistriBet } from "../src/validators";
import { initGame, applyAction, type Action } from "../src/reducer";
import type { Card, GameState, Rank, Suit, Upcards } from "../src/types";

function card(rank: Rank, suit: Suit = "S"): Card {
  return { rank, suit };
}

function up(a: Rank, b: Rank, suitA: Suit = "S", suitB: Suit = "H"): Upcards {
  return { a: card(a, suitA), b: card(b, suitB) };
}

/** Advance to an actionable turn, then force deterministic upcards + next reveal. */
function reachForcedTurn(opts: {
  upcards: Upcards;
  reveal: Card;
  percent?: number;
  ante?: number;
  startingBankroll?: number;
  seed?: number;
}): GameState {
  let s = initGame({
    players: [
      { id: "p1", name: "P1" },
      { id: "p2", name: "P2" },
    ],
    seed: opts.seed ?? 99,
    config: {
      ante: opts.ante ?? 10,
      startingBankroll: opts.startingBankroll ?? 500,
      minBetPolicy: { type: "fixed", value: 5 },
      shistri: { enabled: true, percent: opts.percent ?? 7, minChip: 1 },
    },
  });

  s = applyAction(s, { type: "startRound" });
  s = applyAction(s, { type: "ante" });
  s = applyAction(s, { type: "determineStarter" });
  // Force current player to p1 for stable assertions
  s = {
    ...s,
    currentIndex: 0,
    round: { ...s.round, starterIndex: 0 },
  };
  s = applyAction(s, { type: "startTurn" });

  // Replace dealt upcards and put reveal card on top of deck
  return {
    ...s,
    turn: s.turn
      ? {
          ...s.turn,
          playerId: "p1",
          upcards: {
            a: { ...opts.upcards.a },
            b: { ...opts.upcards.b },
          },
        }
      : null,
    deck: [opts.reveal, ...s.deck],
    players: s.players.map((p) => ({ ...p })),
  };
}

describe("SHISTRI eligibility (canShistri / gapSize)", () => {
  it("maps Ace=1 … King=13 and requires abs(rank diff) === 2", () => {
    // gapSize === 1 ⇔ high - low === 2 ⇔ abs(diff) === 2
    expect(gapSize(up(1, 3))).toBe(1);
    expect(canShistri(up(1, 3))).toBe(true);
  });

  it.each([
    [1, 3], // A + 3
    [2, 4],
    [5, 7],
    [10, 12], // 10 + Q
    [11, 13], // J + K
    [4, 2], // reversed order
    [3, 1],
  ] as [Rank, Rank][])("eligible for ranks %i and %i", (a, b) => {
    expect(canShistri(up(a, b))).toBe(true);
    expect(Math.abs(a - b)).toBe(2);
  });

  it.each([
    [1, 2], // A + 2 adjacent
    [2, 3],
    [12, 13], // Q + K
    [12, 1], // Q + A wrap
    [13, 1], // K + A wrap
    [13, 2], // K + 2 wrap
    [5, 5], // same rank
    [1, 13],
    [2, 8], // abs=6 — MP UI wrongly treats this as eligible
  ] as [Rank, Rank][])("not eligible for ranks %i and %i", (a, b) => {
    expect(canShistri(up(a, b))).toBe(false);
  });

  it("ignores suit / color", () => {
    expect(canShistri(up(5, 7, "S", "S"))).toBe(true);
    expect(canShistri(up(5, 7, "H", "D"))).toBe(true);
  });
});

describe("SHISTRI stake (shistriBet)", () => {
  it("uses floor(percent/100 * pot), then enforces minChip", () => {
    expect(shistriBet(100, 7, 1)).toBe(7);
    expect(shistriBet(100, 5, 1)).toBe(5);
    expect(shistriBet(10, 7, 1)).toBe(1); // floor(0.7)=0 → minChip
    expect(shistriBet(1, 7, 1)).toBe(1);
  });

  it("never returns negative or below minChip for non-negative pot", () => {
    expect(shistriBet(0, 7, 1)).toBe(1);
    expect(shistriBet(50, 7, 3)).toBe(3); // floor(3.5)=3
  });
});

describe("SHISTRI resolution accounting", () => {
  it("win: credits whole pot; bankroll gains pot; pot becomes 0", () => {
    const potBeforeAnte = 0;
    let s = reachForcedTurn({
      upcards: up(1, 3), // A + 3 eligible
      reveal: card(2), // between → win
      percent: 7,
      ante: 50,
      startingBankroll: 500,
    });
    const potBefore = s.round.pot;
    const bankBefore = s.players[0]!.bankroll;
    expect(potBefore).toBe(100); // 50+50 ante
    expect(potBeforeAnte).toBe(0);

    const stake = Math.min(
      bankBefore,
      Math.min(potBefore, shistriBet(potBefore, 7, 1))
    );
    expect(stake).toBe(7);

    s = applyAction(s, { type: "shistri" } as Action);

    expect(s.lastResolution?.win).toBe(true);
    expect(s.lastResolution?.kind).toBe("shistri");
    expect(s.lastResolution?.amount).toBe(potBefore);
    expect(s.round.pot).toBe(0);
    expect(s.players[0]!.bankroll).toBe(bankBefore + potBefore);
  });

  it("loss: deducts only SHISTRI stake, not whole pot", () => {
    let s = reachForcedTurn({
      upcards: up(11, 13), // J + K
      reveal: card(1), // not between → loss
      percent: 7,
      ante: 50,
      startingBankroll: 500,
    });
    const potBefore = s.round.pot;
    const bankBefore = s.players[0]!.bankroll;
    const stake = shistriBet(potBefore, 7, 1);

    s = applyAction(s, { type: "shistri" } as Action);

    expect(s.lastResolution?.win).toBe(false);
    expect(s.lastResolution?.amount).toBe(stake);
    expect(s.round.pot).toBe(potBefore + stake);
    expect(s.players[0]!.bankroll).toBe(bankBefore - stake);
    // Must not lose whole pot on SHISTRI loss
    expect(bankBefore - s.players[0]!.bankroll).toBe(stake);
    expect(stake).toBeLessThan(potBefore);
  });

  it("rejects ineligible SHISTRI without changing pot or bankroll (SOFT-REJECT-001)", () => {
    const s = reachForcedTurn({
      upcards: up(12, 1), // Q + A invalid
      reveal: card(7),
      percent: 7,
      ante: 50,
    });
    const potBefore = s.round.pot;
    const bankBefore = s.players[0]!.bankroll;
    const histLen = s.history.length;

    expect(() => applyAction(s, { type: "shistri" } as Action)).toThrow(/SHISTRI not allowed/);

    expect(s.round.pot).toBe(potBefore);
    expect(s.players[0]!.bankroll).toBe(bankBefore);
    expect(s.history.length).toBe(histLen);
  });

  it("KOUPPI loss risks whole pot; SHISTRI loss does not", () => {
    let kouppi = reachForcedTurn({
      upcards: up(5, 7),
      reveal: card(1),
      ante: 50,
      startingBankroll: 500,
    });
    const pot = kouppi.round.pot;
    const bank = kouppi.players[0]!.bankroll;
    kouppi = applyAction(kouppi, { type: "kouppi" });
    expect(kouppi.lastResolution?.win).toBe(false);
    expect(kouppi.players[0]!.bankroll).toBe(bank - pot);

    let shistri = reachForcedTurn({
      upcards: up(5, 7),
      reveal: card(1),
      percent: 7,
      ante: 50,
      startingBankroll: 500,
      seed: 100,
    });
    const potS = shistri.round.pot;
    const bankS = shistri.players[0]!.bankroll;
    const stake = shistriBet(potS, 7, 1);
    shistri = applyAction(shistri, { type: "shistri" });
    expect(shistri.players[0]!.bankroll).toBe(bankS - stake);
    expect(stake).not.toBe(potS);
  });
});

describe("default config percent (product constant)", () => {
  it("shipped default config uses SHISTRI_DEFAULT_PERCENT (7)", () => {
    const s = initGame({
      players: [
        { id: "p1", name: "P1" },
        { id: "p2", name: "P2" },
      ],
    });
    expect(s.config.shistri.percent).toBe(7);
  });
});
