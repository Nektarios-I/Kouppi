import { describe, it, expect } from "vitest";
import {
  FeedbackDedupeSet,
  advanceRibbon,
  classifyMatchEnd,
  createRibbonQueue,
  enqueueRibbon,
  historyLimitForViewport,
  normalizeResolutionEvent,
  normalizeStakePulse,
  pushHistory,
  resolutionDedupeKey,
  buildResolutionCopy,
  calmDealerMessage,
} from "@/lib/tableEventFeedback";
import { effectiveEffectsLevel } from "@/store/tableEffectsStore";

const players = [
  { id: "you", name: "Nektarios" },
  { id: "bot1", name: "Bot 1", isBot: true },
];

describe("tableEventFeedback normalize", () => {
  it("maps local bet win", () => {
    const ev = normalizeResolutionEvent({
      resolution: {
        kind: "bet",
        playerId: "you",
        amount: 20,
        win: true,
        reveal: { rank: 7, suit: "H" },
      },
      players,
      localPlayerId: "you",
      sequenceSalt: 3,
    });
    expect(ev).not.toBeNull();
    expect(ev!.channel).toBe("table");
    expect(ev!.ribbonText).toBe("You won 20");
    expect(ev!.tone).toBe("win");
    expect(ev!.physical.some((p) => p.kind === "chip_from_pot")).toBe(true);
    expect(ev!.physical.some((p) => p.kind === "seat_win_highlight")).toBe(true);
  });

  it("maps local bet loss", () => {
    const ev = normalizeResolutionEvent({
      resolution: {
        kind: "bet",
        playerId: "you",
        amount: 10,
        win: false,
        reveal: { rank: 2, suit: "S" },
      },
      players,
      localPlayerId: "you",
    });
    expect(ev!.ribbonText).toBe("You lost 10");
    expect(ev!.tone).toBe("loss");
    expect(ev!.physical.some((p) => p.kind === "chip_to_pot")).toBe(true);
  });

  it("maps pot win for remote player without inventing currency", () => {
    const ev = normalizeResolutionEvent({
      resolution: {
        kind: "bet",
        playerId: "bot1",
        amount: 60,
        win: true,
        reveal: { rank: 8, suit: "D" },
      },
      players,
      localPlayerId: "you",
    });
    expect(ev!.ribbonText).toBe("Bot 1 won 60");
    expect(ev!.ribbonText.includes("€")).toBe(false);
  });

  it("maps SHISTRI declaration/result from resolution kind", () => {
    const win = normalizeResolutionEvent({
      resolution: {
        kind: "shistri",
        playerId: "you",
        amount: 40,
        win: true,
        reveal: { rank: 6, suit: "C" },
      },
      players,
      localPlayerId: "you",
    });
    expect(win!.ribbonText).toBe("You won SHISTRI · +40");
    expect(win!.tone).toBe("shistri");
    expect(win!.physical.some((p) => p.kind === "shistri_badge")).toBe(true);

    const loss = normalizeResolutionEvent({
      resolution: {
        kind: "shistri",
        playerId: "bot1",
        amount: 14,
        win: false,
        reveal: { rank: 1, suit: "H" },
      },
      players,
      localPlayerId: "you",
    });
    expect(loss!.ribbonText).toBe("Bot 1 lost SHISTRI · -14");
  });

  it("maps pass action", () => {
    const ev = normalizeResolutionEvent({
      resolution: { kind: "pass", playerId: "bot1", amount: 0, win: false },
      players,
      localPlayerId: "you",
    });
    expect(ev!.ribbonText).toBe("Bot 1 passed");
    expect(ev!.physical).toEqual([]);
  });

  it("falls back when amount missing", () => {
    const copy = buildResolutionCopy({
      resolution: { kind: "bet", playerId: "you", win: true },
      playerName: "Nektarios",
      isLocal: true,
    });
    expect(copy.ribbonText).toBe("You won the pot");
  });

  it("handles empty bot names safely", () => {
    const ev = normalizeResolutionEvent({
      resolution: {
        kind: "bet",
        playerId: "x",
        amount: 5,
        win: true,
        reveal: { rank: 5, suit: "S" },
      },
      players: [{ id: "x", name: "   " }],
      localPlayerId: "you",
    });
    expect(ev!.ribbonText.startsWith("Player")).toBe(true);
  });

  it("classifies RoundEnd as major and not table ribbon channel", () => {
    expect(classifyMatchEnd("RoundEnd")).toBe("major");
    expect(classifyMatchEnd("Round")).toBe("none");
    const ev = normalizeResolutionEvent({
      resolution: {
        kind: "kouppi",
        playerId: "you",
        amount: 100,
        win: true,
        reveal: { rank: 9, suit: "H" },
      },
      players,
      localPlayerId: "you",
    });
    expect(ev!.channel).toBe("table");
  });

  it("builds stake pulse with shistri declare copy", () => {
    const ev = normalizeStakePulse({
      playerId: "bot1",
      playerName: "Bot 1",
      amount: 14,
      kind: "shistri",
      nonce: "abc",
    });
    expect(ev.ribbonText).toBe("Bot 1 declared SHISTRI");
    expect(ev.logText).toContain("risk 14");
  });
});

describe("dedupe and bounded queue", () => {
  it("suppresses identical resolution keys", () => {
    const set = new FeedbackDedupeSet(8);
    const key = resolutionDedupeKey({
      kind: "bet",
      playerId: "you",
      amount: 10,
      win: true,
      reveal: { rank: 5, suit: "H" },
    });
    expect(set.tryAdd(key)).toBe(true);
    expect(set.tryAdd(key)).toBe(false);
  });

  it("preserves distinct sequential events and bounds history", () => {
    let hist: ReturnType<typeof normalizeResolutionEvent>[] = [];
    const a = normalizeResolutionEvent({
      resolution: {
        kind: "bet",
        playerId: "you",
        amount: 1,
        win: true,
        reveal: { rank: 3, suit: "H" },
      },
      players,
      localPlayerId: "you",
      sequenceSalt: 1,
    })!;
    const b = normalizeResolutionEvent({
      resolution: {
        kind: "bet",
        playerId: "bot1",
        amount: 2,
        win: false,
        reveal: { rank: 4, suit: "H" },
      },
      players,
      localPlayerId: "you",
      sequenceSalt: 2,
    })!;
    hist = pushHistory(hist as never, a, 2);
    hist = pushHistory(hist as never, b, 2);
    hist = pushHistory(hist as never, a, 2); // duplicate id ignored
    expect(hist).toHaveLength(2);
    expect(hist[0]!.id).toBe(a.id);
    expect(hist[1]!.id).toBe(b.id);

    const c = normalizeResolutionEvent({
      resolution: {
        kind: "pass",
        playerId: "you",
        amount: 0,
        win: false,
      },
      players,
      localPlayerId: "you",
      sequenceSalt: 3,
    })!;
    hist = pushHistory(hist as never, c, 2);
    expect(hist).toHaveLength(2);
    expect(hist[0]!.id).toBe(b.id);
    expect(hist[1]!.id).toBe(c.id);
  });

  it("keeps one ribbon and replaces low with low", () => {
    let q = createRibbonQueue();
    const low1 = normalizeStakePulse({
      playerId: "you",
      playerName: "Nektarios",
      amount: 5,
      kind: "bet",
      nonce: "1",
    });
    const low2 = normalizeStakePulse({
      playerId: "you",
      playerName: "Nektarios",
      amount: 8,
      kind: "bet",
      nonce: "2",
    });
    q = enqueueRibbon(q, low1);
    q = enqueueRibbon(q, low2);
    expect(q.current?.id).toBe(low2.id);
    expect(q.pending).toHaveLength(0);

    const high = normalizeResolutionEvent({
      resolution: {
        kind: "shistri",
        playerId: "you",
        amount: 20,
        win: true,
        reveal: { rank: 7, suit: "D" },
      },
      players,
      localPlayerId: "you",
      sequenceSalt: 9,
    })!;
    q = enqueueRibbon(q, high);
    expect(q.current?.id).toBe(high.id);

    q = advanceRibbon(q);
    expect(q.current).toBeNull();
  });

  it("bounds viewport history limits", () => {
    expect(historyLimitForViewport(375)).toBe(16);
    expect(historyLimitForViewport(1280)).toBe(28);
  });
});

describe("effects preferences", () => {
  it("maps Full/Reduced/Off and prefers-reduced-motion override", () => {
    expect(effectiveEffectsLevel("full", false)).toBe("full");
    expect(effectiveEffectsLevel("full", true)).toBe("reduced");
    expect(effectiveEffectsLevel("reduced", true)).toBe("reduced");
    expect(effectiveEffectsLevel("off", true)).toBe("off");
  });

  it("calm dealer message avoids WIN!/LOSS shouts", () => {
    const msg = calmDealerMessage({
      awaitingNext: true,
      resolution: { kind: "bet", playerId: "you", win: true, amount: 10 },
      isMyTurn: false,
    });
    expect(msg).toBe("RESOLVED");
    expect(msg.includes("!")).toBe(false);
  });
});
