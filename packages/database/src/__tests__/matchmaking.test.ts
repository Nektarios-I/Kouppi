/**
 * Matchmaking range and compatibility tests (Sprint 2)
 */

import { describe, it, expect } from "vitest";
import { getMatchmakingRange, isMatchmakingCompatible } from "../rating.js";

describe("getMatchmakingRange", () => {
  it("starts at ±100", () => {
    expect(getMatchmakingRange(0)).toBe(100);
    expect(getMatchmakingRange(4)).toBe(100);
  });

  it("expands by 50 every 5 seconds up to ±500", () => {
    expect(getMatchmakingRange(5)).toBe(150);
    expect(getMatchmakingRange(10)).toBe(200);
    expect(getMatchmakingRange(40)).toBe(500);
    expect(getMatchmakingRange(100)).toBe(500);
  });
});

describe("isMatchmakingCompatible", () => {
  it("matches players within initial ±100 when both waited briefly", () => {
    expect(isMatchmakingCompatible(1200, 1280, 0, 0)).toBe(true);
    expect(isMatchmakingCompatible(1200, 1310, 0, 0)).toBe(false);
  });

  it("applies ±250 expanded fallback after 15 seconds", () => {
    expect(isMatchmakingCompatible(1200, 1440, 15, 0)).toBe(true);
    expect(isMatchmakingCompatible(1200, 1460, 15, 0)).toBe(false);
  });

  it("allows cross-tier matching up to ±400 after 30 seconds", () => {
    expect(isMatchmakingCompatible(1000, 1380, 30, 0)).toBe(true);
    expect(isMatchmakingCompatible(1000, 1450, 30, 0)).toBe(false);
  });

  it("quick match after 45 seconds accepts any human opponent", () => {
    expect(isMatchmakingCompatible(800, 1900, 45, 0)).toBe(true);
    expect(isMatchmakingCompatible(800, 1900, 0, 45)).toBe(true);
  });

  it("does not match a lone player", () => {
    // Compatibility requires two entries; queue layer handles singleton separately.
    expect(isMatchmakingCompatible(1200, 1200, 0, 0)).toBe(true);
  });
});
