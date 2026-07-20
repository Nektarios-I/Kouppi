/**
 * SP-CFG-001 — remount lifecycle shows SettingsDialog again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useGameStore } from "@/store/gameStore";
import { useRemoteGameStore } from "@/store/remoteGameStore";

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    function DynamicStub() {
      return <div data-testid="table-stub" />;
    }
    return DynamicStub;
  },
}));

vi.mock("@/components/SoundControl", () => ({
  __esModule: true,
  default: () => null,
}));

import Page from "@/app/play/single/page";

describe("SP-CFG-001 /play/single remount", () => {
  beforeEach(() => {
    useGameStore.getState().resetSinglePlayer();
  });

  afterEach(() => {
    cleanup();
    useGameStore.getState().resetSinglePlayer();
  });

  it("shows Table Settings dialog on entry even after a prior configured session", () => {
    const roomBefore = useRemoteGameStore.getState().roomId;

    useGameStore.getState().configureSinglePlayer({
      numberBots: 2,
      ante: 25,
      startingBankroll: 200,
      shistri: true,
      botMode: "deterministic",
      botDifficulty: "normal",
    });
    expect(useGameStore.getState().ready).toBe(true);

    const { unmount } = render(<Page />);
    // Mount effect resets SP session before paint.
    expect(useGameStore.getState().ready).toBe(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Table Settings/i)).toBeInTheDocument();

    unmount();

    useGameStore.getState().configureSinglePlayer({
      numberBots: 1,
      ante: 10,
      startingBankroll: 100,
      shistri: true,
      botMode: "deterministic",
      botDifficulty: "easy",
    });
    expect(useGameStore.getState().ready).toBe(true);

    render(<Page />);
    expect(useGameStore.getState().ready).toBe(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(useRemoteGameStore.getState().roomId).toBe(roomBefore);
  });
});
