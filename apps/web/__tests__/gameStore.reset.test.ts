/**
 * SP-CFG-001: Single Player session reset on re-entry.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "@/store/gameStore";

describe("SP-CFG-001 gameStore resetSinglePlayer", () => {
  beforeEach(() => {
    useGameStore.getState().resetSinglePlayer();
  });

  it("configureSinglePlayer sets ready true", () => {
    useGameStore.getState().configureSinglePlayer({
      numberBots: 2,
      ante: 10,
      startingBankroll: 100,
      shistri: true,
      botMode: "deterministic",
      botDifficulty: "normal",
    });
    expect(useGameStore.getState().ready).toBe(true);
    expect(Object.keys(useGameStore.getState().botProfiles).length).toBeGreaterThan(0);
  });

  it("resetSinglePlayer clears ready and botProfiles so config dialog shows again", () => {
    useGameStore.getState().configureSinglePlayer({
      numberBots: 3,
      ante: 25,
      startingBankroll: 200,
      shistri: false,
      botMode: "stochastic",
      botDifficulty: "hard",
    });
    expect(useGameStore.getState().ready).toBe(true);

    useGameStore.getState().resetSinglePlayer();

    expect(useGameStore.getState().ready).toBe(false);
    expect(useGameStore.getState().botProfiles).toEqual({});
    expect(useGameStore.getState().state.config.ante).toBe(10);
  });
});
