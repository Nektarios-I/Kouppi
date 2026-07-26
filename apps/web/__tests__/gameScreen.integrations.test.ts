import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(file: string) {
  return readFileSync(resolve(process.cwd(), "components", file), "utf8").replace(/\r\n/g, "\n");
}

describe("shared game-screen integrations", () => {
  it.each(["TableGraphics.tsx", "MultiplayerTableGraphics.tsx"])(
    "%s composes the shared screen, utility, history, and stable dock",
    (file) => {
      const code = source(file);
      expect(code).toContain("<GameScreen");
      expect(code).toContain("<GameUtilityBar");
      expect(code).toContain("<HistoryDrawer");
      expect(code).toContain("history={");
      expect(code).toContain("<GameActionDock");
      expect(code).not.toContain("<GameHUD");
      expect(code).not.toContain("game-stage-side");
    }
  );

  it("keeps SP action dispatch and next-turn paths", () => {
    const code = source("TableGraphics.tsx");
    for (const action of ['type: "pass"', 'type: "bet"', 'type: "kouppi"', 'type: "shistri"', 'type: "nextPlayer"']) {
      expect(code).toContain(action);
    }
  });

  it("keeps MP intents, confirmation, and career exit routing", () => {
    const code = source("MultiplayerTableGraphics.tsx");
    expect(code).toContain("sendIntent");
    expect(code).toContain("<ConfirmDialog");
    expect(code).toContain("postRoomExitPath(roomId)");
    expect(code).toContain("kickPlayer");
    expect(code).toContain('awaitingNext\n        ? "disabled"');
    expect(code).toContain('"Waiting for the server to advance the turn"');
  });

  it("keeps History as a portaled popover under the toolbar control on all viewports", () => {
    const css = readFileSync(resolve(process.cwd(), "app", "globals.css"), "utf8").replace(/\r\n/g, "\n");
    expect(css).toContain(".history-drawer-panel--anchored");
    expect(css).toContain("writing-mode: horizontal-tb;");
    expect(css).toContain(".history-drawer-trigger--toolbar");
    expect(css).toContain(".history-drawer-layer {\n  pointer-events: auto;\n  z-index: 80;");
    expect(css).not.toContain(".history-drawer-layer {\n    bottom: calc(var(--gs-dock-h) + var(--gs-gutter));");
  });

  it("shrinks mobile table center cards away from the pot", () => {
    const css = readFileSync(resolve(process.cwd(), "app", "globals.css"), "utf8").replace(/\r\n/g, "\n");
    expect(css).toContain(".poker-table-surface .table-pot-anchor {\n    top: 26%;");
    expect(css).toContain(".poker-table-surface .table-center-cards-anchor {\n    top: 58%;");
    expect(css).toContain(".center-cards-row--tight {\n    gap: 1.35rem;");
    expect(css).toContain(".pot-chip-stack {\n    flex-direction: row;");
    expect(css).toContain(".table-pot-amount__value {\n    font-size: 0.65rem;");
    expect(css).toContain(".pot-chip-stack__chips {\n    transform: scale(0.55);");
    expect(css).toContain(".player-chip-stack {\n    transform: scale(0.78);");
  });

  it("wires avatar settings into SP and MP game shells", () => {
    const sp = source("TableGraphics.tsx");
    const mp = source("MultiplayerTableGraphics.tsx");
    expect(sp).toContain("avatar={{ currentAvatar: playerAvatar, onChange: handleAvatarChange }}");
    expect(mp).toContain("onChange: handleAvatarChange");
    expect(mp).toContain("setAvatar(normalized)");
  });

  it("themes utility and turn chrome from the active table style", () => {
    const css = readFileSync(resolve(process.cwd(), "app", "globals.css"), "utf8").replace(/\r\n/g, "\n");
    expect(css).toContain('.casino-room[data-table-theme="classic-green"]');
    expect(css).toContain('.casino-room[data-table-theme="woodland"]');
    expect(css).toContain("--gs-chrome-accent:");
  });

  it("keeps every mobile action visible without scrolling the dock", () => {
    const css = readFileSync(resolve(process.cwd(), "app", "globals.css"), "utf8").replace(/\r\n/g, "\n");
    expect(css).toContain("--gs-dock-h: 9rem;");
    expect(css).toContain(".game-action-panel .game-action-buttons {\n    grid-template-columns: repeat(4, minmax(0, 1fr));");
    expect(css).toContain(".game-action-panel .game-action-bet-main {\n    grid-column: span 1;");
    expect(css).toContain(".game-action-panel .game-action-stats {\n    display: none;");
    expect(css).toContain("height: 48px;");
  });

  it("lays desktop actions out in one row inside the reserved dock", () => {
    const css = readFileSync(resolve(process.cwd(), "app", "globals.css"), "utf8").replace(/\r\n/g, "\n");
    expect(css).toContain("grid-template-columns: auto minmax(12rem, 1fr) minmax(24rem, 2fr);");
    expect(css).toContain(".game-action-panel .game-action-quick-row {\n    display: none;");
    expect(css).toContain(".game-action-panel .game-action-buttons {\n    grid-template-columns: repeat(4, minmax(0, 1fr));");
  });

  it("keeps blocking round-end UI above utility and settings chrome", () => {
    const code = source("game/GamePanels.tsx");
    expect(code).toContain("z-[70]");
  });
});
