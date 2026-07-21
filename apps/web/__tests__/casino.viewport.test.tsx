import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import CasinoBackground from "../components/game/CasinoBackground";
import { DEFAULT_TABLE_THEME_ID, getTableThemeById } from "../lib/tableThemes";

vi.mock("../components/game/CasinoFloor", () => ({
  default: () => <div data-testid="floor" />,
}));
vi.mock("../components/game/BackgroundProps", () => ({
  default: () => <div data-testid="props" />,
}));

describe("CasinoBackground viewport lock", () => {
  const theme = getTableThemeById(DEFAULT_TABLE_THEME_ID);

  it("allows scrolling on lobby/mode pages by default", () => {
    const { container } = render(
      <CasinoBackground theme={theme}>
        <div>lobby</div>
      </CasinoBackground>
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain("lobby-viewport-shell");
    expect(shell.className).not.toContain("game-viewport-shell");
  });

  it("locks viewport only when lockViewport is set (in-game)", () => {
    const { container } = render(
      <CasinoBackground theme={theme} lockViewport>
        <div>table</div>
      </CasinoBackground>
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain("game-viewport-shell");
    expect(shell.className).not.toContain("lobby-viewport-shell");
  });
});
