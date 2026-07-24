import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameScreen from "@/components/game/GameScreen";
import GameActionDock from "@/components/game/GameActionDock";
import GameUtilityBar from "@/components/game/GameUtilityBar";
import GameSettingsMenu from "@/components/game/GameSettingsMenu";
import HistoryDrawer from "@/components/game/HistoryDrawer";
import type { TableFeedbackEvent } from "@/lib/tableEventFeedback";

const toggleMute = vi.fn();

vi.mock("@/hooks/useSounds", () => ({
  useSounds: () => ({
    masterVolume: 0.8,
    sfxVolume: 0.7,
    musicVolume: 0.6,
    isMuted: false,
    isMusicMuted: false,
    isMusicPlaying: false,
    setMasterVolume: vi.fn(),
    setSfxVolume: vi.fn(),
    setMusicVolume: vi.fn(),
    toggleMute,
    toggleMusicMute: vi.fn(),
    playBackgroundMusic: vi.fn(),
    stopBackgroundMusic: vi.fn(),
    sounds: { click: vi.fn() },
  }),
}));

vi.mock("@/components/game/TableThemeSelector", () => ({
  default: () => <label>Table style<select aria-label="Select table visual theme" /></label>,
}));

function event(logText: string): TableFeedbackEvent {
  return {
    id: logText,
    createdAt: 1,
    priority: "normal",
    tone: "action",
    ribbonText: logText,
    logText,
    ariaLive: "polite",
    physical: [],
    soundCue: "none",
    durationMs: 1000,
    channel: "table",
  };
}

describe("GameScreen", () => {
  it("always renders utility, protected table, history, and reserved dock zones", () => {
    render(
      <GameScreen
        utility={<div>Utility</div>}
        history={<div>History</div>}
        table={<div>Table</div>}
        dock={<div>Dock</div>}
      />
    );

    expect(screen.getByTestId("game-screen")).toHaveClass("game-screen");
    expect(screen.getByTestId("game-screen-main")).toContainElement(screen.getByText("Table"));
    expect(screen.getByTestId("game-screen-dock")).toContainElement(screen.getByText("Dock"));
  });
});

describe("GameActionDock", () => {
  it.each([
    ["waiting", "Waiting for Bot 1…"],
    ["spectator", "Spectating — read-only"],
    ["disabled", "Actions unavailable"],
  ] as const)("renders the %s state without dialog semantics", (state, message) => {
    render(<GameActionDock state={state} waitingFor="Bot 1" />);
    expect(screen.getByRole("region", { name: /game actions/i })).toHaveAttribute("data-state", state);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders active and next controls in the same stable region", () => {
    const { rerender } = render(
      <GameActionDock state="active"><button>Pass</button></GameActionDock>
    );
    expect(screen.getByText("Your turn — choose an action")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pass" })).toBeInTheDocument();

    rerender(<GameActionDock state="next"><button>Next turn</button></GameActionDock>);
    expect(screen.getByRole("button", { name: "Next turn" })).toBeInTheDocument();
  });
});

describe("GameUtilityBar and settings", () => {
  it("shows compact identity, one-tap mute, history, and settings", async () => {
    const user = userEvent.setup();
    render(
      <GameUtilityBar
        modeLabel="Single Player"
        history={
          <HistoryDrawer
            entries={[]}
            round={{ phase: "Round", awaitingNext: false }}
            table={{ mode: "Single Player" }}
          />
        }
        settings={<GameSettingsMenu onRequestLeave={vi.fn()} />}
      />
    );
    expect(screen.getByText("KOUPPI")).toBeInTheDocument();
    expect(screen.getByText("Single Player")).toBeInTheDocument();
    const history = screen.getByRole("button", { name: /open history/i });
    expect(history).toHaveClass("history-drawer-trigger--toolbar");
    expect(history.compareDocumentPosition(screen.getByRole("button", { name: "Mute" }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(toggleMute).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /open game settings/i })).toBeInTheDocument();
  });

  it("closes settings on Escape, restores focus, and requests confirmed leave", async () => {
    const user = userEvent.setup();
    const onRequestLeave = vi.fn();
    render(<GameSettingsMenu onRequestLeave={onRequestLeave} />);
    const trigger = screen.getByRole("button", { name: /open game settings/i });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: /game settings/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/select table visual theme/i)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /game settings/i })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(screen.getByRole("tab", { name: "Session" }));
    expect(screen.getByRole("link", { name: /how to play/i })).toHaveAttribute("target", "_blank");
    await user.click(screen.getByRole("button", { name: /leave game/i }));
    expect(onRequestLeave).toHaveBeenCalledOnce();
  });
});

describe("HistoryDrawer", () => {
  it("opens closed-by-default overlay, switches tabs, and restores focus on Escape", async () => {
    const user = userEvent.setup();
    render(
      <HistoryDrawer
        entries={[event("You passed"), event("Bot 1 won 20")]}
        round={{ phase: "Round", summary: "Bot 1 is thinking", awaitingNext: false }}
        table={{ mode: "Single Player", details: ["Ante 10", "2 bots"] }}
      />
    );
    const trigger = screen.getByRole("button", { name: /open history/i });
    expect(trigger).toHaveClass("history-drawer-trigger--toolbar");
    expect(screen.queryByRole("dialog", { name: /game history/i })).not.toBeInTheDocument();
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: /game history/i });
    expect(dialog).toHaveClass("history-drawer-panel");
    expect(dialog).toHaveClass("history-drawer-panel--anchored");
    expect(screen.getByText("You passed")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Actions" })).toHaveAttribute(
      "aria-controls",
      "history-panel"
    );
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "history-tab-actions");
    await user.click(screen.getByRole("tab", { name: /hand.*round/i }));
    expect(screen.getByText("Bot 1 is thinking")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Table" }));
    expect(screen.getByText("Ante 10")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /game history/i })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe("GameSettingsMenu avatar tab", () => {
  it("exposes an Avatar tab and saves a portrait selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GameSettingsMenu
        onRequestLeave={vi.fn()}
        avatar={{ currentAvatar: { id: "portrait-01" }, onChange }}
      />
    );
    await user.click(screen.getByRole("button", { name: /open game settings/i }));
    await user.click(screen.getByRole("tab", { name: "Avatar" }));
    expect(screen.getByRole("tabpanel", { name: "Avatar" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "portrait-02" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onChange).toHaveBeenCalledWith({ id: "portrait-02" });
  });
});
