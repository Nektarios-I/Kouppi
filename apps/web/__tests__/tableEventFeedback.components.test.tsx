import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TableResultRibbon from "@/components/tableFeedback/TableResultRibbon";
import TableEventLog from "@/components/tableFeedback/TableEventLog";
import {
  TableFeedbackProvider,
  TableFeedbackOverlays,
  TableFeedbackLogSlot,
} from "@/components/tableFeedback/TableEventFeedbackRoot";
import type { TableFeedbackEvent } from "@/lib/tableEventFeedback";
import { Celebration } from "@/components/Confetti";
import { useTableEffectsStore } from "@/store/tableEffectsStore";

function makeEvent(overrides: Partial<TableFeedbackEvent> = {}): TableFeedbackEvent {
  return {
    id: "e1",
    createdAt: Date.now(),
    priority: "normal",
    tone: "win",
    ribbonText: "You won 20",
    logText: "You won 20",
    ariaLive: "polite",
    physical: [],
    soundCue: "none",
    durationMs: 1000,
    channel: "table",
    ...overrides,
  };
}

describe("TableResultRibbon", () => {
  it("renders copy with live region and no dialog semantics", () => {
    render(<TableResultRibbon event={makeEvent()} />);
    const ribbon = screen.getByTestId("table-result-ribbon");
    expect(ribbon).toHaveTextContent("You won 20");
    expect(ribbon).toHaveAttribute("role", "status");
    expect(ribbon).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows SHISTRI tone label text", () => {
    render(
      <TableResultRibbon
        event={makeEvent({
          tone: "shistri",
          ribbonText: "You won SHISTRI · +40",
        })}
      />
    );
    expect(screen.getByText(/SHISTRI/)).toBeInTheDocument();
    expect(screen.getByTestId("table-result-ribbon")).toHaveAttribute("data-tone", "shistri");
  });

  it("renders nothing when event is null", () => {
    const { container } = render(<TableResultRibbon event={null} />);
    expect(container.querySelector("[data-testid='table-result-ribbon']")).toBeNull();
  });
});

describe("TableEventLog", () => {
  it("renders newest entries and bounds are caller-owned", () => {
    const entries = [
      makeEvent({ id: "a", logText: "Nektarios bet 20" }),
      makeEvent({ id: "b", logText: "Bot 1 called" }),
      makeEvent({ id: "c", logText: "Nektarios won 60" }),
    ];
    render(<TableEventLog entries={entries} viewportWidth={1280} />);
    expect(screen.getByText("Nektarios won 60")).toBeInTheDocument();
    expect(screen.getByText("Bot 1 called")).toBeInTheDocument();
  });

  it("provides accessible mobile FAB (44px target class)", async () => {
    const user = userEvent.setup();
    render(
      <TableEventLog
        entries={[makeEvent({ id: "m1", logText: "Pass" })]}
        viewportWidth={375}
      />
    );
    const fab = screen.getByRole("button", { name: /hand history/i });
    expect(fab.className).toContain("table-event-log-fab");
    await user.click(fab);
    expect(screen.getByRole("dialog", { name: /hand history/i })).toBeInTheDocument();
    expect(screen.getByText("Pass")).toBeInTheDocument();
  });
});

describe("TableFeedbackProvider integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTableEffectsStore.setState({ sound: "off", effects: "reduced" });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows one ribbon for a resolution and dismisses after duration", () => {
    const resolution = {
      kind: "bet" as const,
      playerId: "you",
      amount: 20,
      win: true,
      reveal: { rank: 7, suit: "H" },
    };
    render(
      <TableFeedbackProvider
        lastResolution={resolution}
        players={[{ id: "you", name: "You" }]}
        localPlayerId="you"
        sequenceSalt={1}
      >
        <div className="relative">
          <TableFeedbackOverlays tableSurfaceRef={{ current: null }} />
          <TableFeedbackLogSlot />
        </div>
      </TableFeedbackProvider>
    );

    expect(screen.getByTestId("table-result-ribbon")).toHaveTextContent("You won 20");
    expect(screen.getAllByTestId("table-result-ribbon")).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByTestId("table-result-ribbon")).not.toBeInTheDocument();
  });

  it("does not treat Celebration as part of feedback path (smoke)", () => {
    const { container } = render(
      <Celebration active={false} type="win" />
    );
    expect(container.querySelector(".fixed.inset-0")).toBeNull();
  });
});
