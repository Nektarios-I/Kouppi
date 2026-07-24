import { describe, it, expect } from "vitest";
import {
  KOUPPI_CHIP_DENOMINATIONS,
  decomposeAmountToChips,
  sumChipCounts,
  buildVisualChipStack,
  countVisibleDiscs,
  formatChipAmountExact,
  formatChipAmountCompact,
  CHIP_VISUAL_CAPS,
  deriveChipTransfersFromResolution,
  chipTransferDedupeKey,
  ChipTransferDedupeSet,
  boundTransferQueue,
} from "@/lib/chips";

describe("decomposeAmountToChips", () => {
  it("returns empty for zero", () => {
    expect(decomposeAmountToChips(0)).toEqual([]);
  });

  it.each([1, 5, 10, 25, 100, 500, 1000])(
    "decomposes exact denomination %i",
    (value) => {
      const counts = decomposeAmountToChips(value);
      expect(sumChipCounts(counts)).toBe(value);
      expect(counts).toHaveLength(1);
      expect(counts[0].denomination.value).toBe(value);
      expect(counts[0].count).toBe(1);
    }
  );

  it("decomposes 146", () => {
    const counts = decomposeAmountToChips(146);
    expect(sumChipCounts(counts)).toBe(146);
    expect(counts.map((c) => [c.denomination.value, c.count])).toEqual([
      [100, 1],
      [25, 1],
      [10, 2],
      [1, 1],
    ]);
  });

  it("decomposes 635", () => {
    const counts = decomposeAmountToChips(635);
    expect(sumChipCounts(counts)).toBe(635);
    expect(counts.map((c) => [c.denomination.value, c.count])).toEqual([
      [500, 1],
      [100, 1],
      [25, 1],
      [10, 1],
    ]);
  });

  it("decomposes 2347", () => {
    const counts = decomposeAmountToChips(2347);
    expect(sumChipCounts(counts)).toBe(2347);
    // 2×1000 + 3×100 + 1×25 + 2×10 + 2×1 = 2347
    expect(counts.map((c) => [c.denomination.value, c.count])).toEqual([
      [1000, 2],
      [100, 3],
      [25, 1],
      [10, 2],
      [1, 2],
    ]);
  });

  it("decomposes 999999 exactly", () => {
    const counts = decomposeAmountToChips(999999);
    expect(sumChipCounts(counts)).toBe(999999);
  });

  it("handles invalid / negative / NaN safely", () => {
    expect(decomposeAmountToChips(-1)).toEqual([]);
    expect(decomposeAmountToChips(NaN)).toEqual([]);
    expect(decomposeAmountToChips(Infinity)).toEqual([]);
    expect(decomposeAmountToChips(undefined)).toEqual([]);
    expect(decomposeAmountToChips(null)).toEqual([]);
    expect(decomposeAmountToChips("10" as unknown as number)).toEqual([]);
  });

  it("does not mutate denomination catalog", () => {
    const before = KOUPPI_CHIP_DENOMINATIONS.map((d) => d.value);
    decomposeAmountToChips(1234);
    expect(KOUPPI_CHIP_DENOMINATIONS.map((d) => d.value)).toEqual(before);
  });

  it("returns descending denomination order", () => {
    const counts = decomposeAmountToChips(1636);
    const values = counts.map((c) => c.denomination.value);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1]);
    }
  });
});

describe("buildVisualChipStack caps", () => {
  it("caps denomination groups at 7", () => {
    const stack = buildVisualChipStack(999999, "player-bankroll");
    expect(stack.renderedStacks.length).toBeLessThanOrEqual(
      CHIP_VISUAL_CAPS.maxDenominationGroups
    );
  });

  it("caps visible discs per denomination at 5", () => {
    // 6 × 1000 maroon — greedy exact; visual discs capped at 5 with overflow marker
    const stack = buildVisualChipStack(6000, "player-bankroll");
    const maroon = stack.renderedStacks.find((s) => s.denomination.value === 1000);
    expect(maroon).toBeTruthy();
    expect(maroon!.visibleChipCount).toBeLessThanOrEqual(
      CHIP_VISUAL_CAPS.maxVisiblePerDenomination
    );
    expect(maroon!.overflowCount).toBeGreaterThan(0);
    expect(maroon!.representedValue).toBe(6000);
  });

  it("caps player total discs at 18", () => {
    const stack = buildVisualChipStack(999999, "player-bankroll");
    expect(countVisibleDiscs(stack)).toBeLessThanOrEqual(CHIP_VISUAL_CAPS["player-bankroll"]);
  });

  it("caps pot total discs at 22", () => {
    const stack = buildVisualChipStack(999999, "pot");
    expect(countVisibleDiscs(stack)).toBeLessThanOrEqual(CHIP_VISUAL_CAPS.pot);
  });

  it("caps transfer total discs at 10", () => {
    const stack = buildVisualChipStack(999999, "transfer");
    expect(countVisibleDiscs(stack)).toBeLessThanOrEqual(CHIP_VISUAL_CAPS.transfer);
  });

  it("keeps representedAmount exact with overflow markers", () => {
    const stack = buildVisualChipStack(2347, "player-bankroll");
    expect(stack.representedAmount).toBe(2347);
    expect(stack.sourceAmount).toBe(2347);
    expect(stack.isApproximate).toBe(false);
  });

  it("returns empty for zero", () => {
    const stack = buildVisualChipStack(0, "pot");
    expect(stack.renderedStacks).toEqual([]);
    expect(stack.representedAmount).toBe(0);
  });
});

describe("formatChipAmount", () => {
  it("formats exact amounts with locale separators", () => {
    expect(formatChipAmountExact(2347, "en-US")).toBe("2,347");
    expect(formatChipAmountExact(0)).toBe("0");
  });

  it("formats compact labels", () => {
    expect(formatChipAmountCompact(1000)).toBe("1K");
    expect(formatChipAmountCompact(12500)).toBe("12.5K");
    expect(formatChipAmountCompact(1_000_000)).toBe("1M");
    expect(formatChipAmountCompact(125)).toBe("125");
  });

  it("does not invent precision for invalid input", () => {
    expect(formatChipAmountExact(NaN)).toBe("0");
    expect(formatChipAmountCompact(-5)).toBe("0");
  });
});

describe("deriveChipTransfersFromResolution", () => {
  it("emits one bet-to-pot for a loss", () => {
    const transfers = deriveChipTransfersFromResolution({
      resolution: {
        kind: "bet",
        playerId: "p1",
        amount: 20,
        win: false,
        reveal: { rank: 2, suit: "S" },
      },
      sequenceSalt: 1,
    });
    expect(transfers).toHaveLength(1);
    expect(transfers[0].kind).toBe("bet-to-pot");
    expect(transfers[0].amount).toBe(20);
    expect(transfers[0].from).toEqual({ type: "player-bankroll", playerId: "p1" });
    expect(transfers[0].to).toEqual({ type: "pot" });
  });

  it("emits one pot-to-winner for a win", () => {
    const transfers = deriveChipTransfersFromResolution({
      resolution: {
        kind: "bet",
        playerId: "p1",
        amount: 40,
        win: true,
        reveal: { rank: 7, suit: "H" },
      },
    });
    expect(transfers).toHaveLength(1);
    expect(transfers[0].kind).toBe("pot-to-winner");
    expect(transfers[0].from).toEqual({ type: "pot" });
    expect(transfers[0].to).toEqual({ type: "player-bankroll", playerId: "p1" });
  });

  it("maps SHISTRI win/loss kinds with actual amounts", () => {
    const win = deriveChipTransfersFromResolution({
      resolution: {
        kind: "shistri",
        playerId: "p1",
        amount: 100,
        win: true,
        reveal: { rank: 6, suit: "C" },
      },
    });
    expect(win[0].kind).toBe("shistri-win");
    expect(win[0].amount).toBe(100);

    const loss = deriveChipTransfersFromResolution({
      resolution: {
        kind: "shistri",
        playerId: "p1",
        amount: 7,
        win: false,
        reveal: { rank: 1, suit: "H" },
      },
    });
    expect(loss[0].kind).toBe("shistri-loss");
    expect(loss[0].amount).toBe(7);
  });

  it("emits nothing for pass / zero / invalid", () => {
    expect(
      deriveChipTransfersFromResolution({
        resolution: { kind: "pass", playerId: "p1", amount: 0, win: false },
      })
    ).toEqual([]);
    expect(
      deriveChipTransfersFromResolution({
        resolution: { kind: "bet", playerId: "p1", amount: 0, win: true },
      })
    ).toEqual([]);
    expect(deriveChipTransfersFromResolution({ resolution: null })).toEqual([]);
  });

  it("does not invent split-pot winners", () => {
    // Single resolution → at most one transfer; no pot-to-winners without allocation data
    const transfers = deriveChipTransfersFromResolution({
      resolution: {
        kind: "kouppi",
        playerId: "p1",
        amount: 50,
        win: true,
        reveal: { rank: 9, suit: "D" },
      },
    });
    expect(transfers.every((t) => t.kind !== "pot-to-winners")).toBe(true);
  });
});

describe("ChipTransferDedupeSet", () => {
  it("dedupes duplicate ids and stays bounded", () => {
    const set = new ChipTransferDedupeSet(8);
    expect(set.add("a")).toBe(true);
    expect(set.add("a")).toBe(false);
    for (let i = 0; i < 20; i++) set.add(`id-${i}`);
    expect(set.size).toBeLessThanOrEqual(8);
  });

  it("same resolution key is stable", () => {
    const res = {
      kind: "bet" as const,
      playerId: "p1",
      amount: 10,
      win: false,
      reveal: { rank: 3, suit: "C" },
    };
    expect(chipTransferDedupeKey(res, 2)).toBe(chipTransferDedupeKey(res, 2));
  });

  it("bounds transfer queues", () => {
    expect(boundTransferQueue([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
  });
});
