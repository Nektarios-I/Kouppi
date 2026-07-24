import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import PokerChip from "@/components/chips/PokerChip";
import ChipStack from "@/components/chips/ChipStack";
import PlayerChipStack from "@/components/chips/PlayerChipStack";
import PotChipStack from "@/components/chips/PotChipStack";
import ChipTransferLayer from "@/components/chips/ChipTransferLayer";
import PokerTable from "@/components/PokerTable";
import { KOUPPI_CHIP_DENOMINATIONS } from "@/lib/chips";
import type { ChipTransfer } from "@/lib/chips";

afterEach(() => cleanup());

describe("PokerChip", () => {
  it("renders denomination token and accessible label when not decorative", () => {
    const denom = KOUPPI_CHIP_DENOMINATIONS.find((d) => d.key === "green")!;
    render(<PokerChip denomination={denom} size="md" decorative={false} />);
    const chip = screen.getByRole("img", { name: /twenty-five chip/i });
    expect(chip).toHaveAttribute("data-chip-key", "green");
    expect(chip).toHaveAttribute("data-chip-value", "25");
    expect(chip.textContent).toContain("25");
  });

  it("hides decorative chips from accessibility tree", () => {
    const denom = KOUPPI_CHIP_DENOMINATIONS.find((d) => d.key === "red")!;
    const { container } = render(
      <PokerChip denomination={denom} size="sm" decorative />
    );
    expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("omits denomination text at xs size", () => {
    const denom = KOUPPI_CHIP_DENOMINATIONS.find((d) => d.key === "blue")!;
    const { container } = render(
      <PokerChip denomination={denom} size="xs" decorative />
    );
    expect(container.textContent).not.toContain("10");
  });
});

describe("ChipStack", () => {
  it("renders denomination groups for a real amount", () => {
    const { container } = render(
      <ChipStack amount={146} context="player-bankroll" showExactLabel />
    );
    expect(container.querySelector('[data-chip-amount="146"]')).toBeTruthy();
    expect(screen.getByText("146")).toBeInTheDocument();
    expect(container.querySelector('[data-chip-key="black"]')).toBeTruthy();
    expect(container.querySelector('[data-chip-key="green"]')).toBeTruthy();
  });

  it("renders nothing for zero", () => {
    const { container } = render(<ChipStack amount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("stays compact for huge amounts with count markers", () => {
    const { container } = render(
      <ChipStack amount={999999} context="player-bankroll" />
    );
    const discs = container.querySelectorAll("[data-chip-key]");
    expect(discs.length).toBeLessThanOrEqual(18);
    expect(container.querySelector(".kouppi-chip-count-marker")).toBeTruthy();
  });
});

describe("PlayerChipStack / PotChipStack", () => {
  it("labels player bankroll accessibly", () => {
    render(
      <PlayerChipStack amount={635} playerId="p1" breakpoint="desktop" />
    );
    expect(
      screen.getByRole("group", { name: /player bankroll: 635 chips/i })
    ).toBeInTheDocument();
  });

  it("shows denomination text on local hero chips (same as bot stacks)", () => {
    const { container } = render(
      <PlayerChipStack amount={5} playerId="you" breakpoint="desktop" isLocal />
    );
    // Ivory "1" and/or red "5" disc labels must be present (sm size, not unlabeled xs)
    expect(container.querySelector('[data-chip-key="red"]')?.textContent).toContain("5");
    expect(container.querySelector(".player-chip-stack--local")).toBeTruthy();
  });

  it("renders pot label and exact amount even at zero", () => {
    render(<PotChipStack amount={0} />);
    expect(screen.getByRole("group", { name: /pot: 0 chips/i })).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders pot stack for positive amounts", () => {
    const { container } = render(<PotChipStack amount={125} />);
    expect(container.querySelector("[data-pot-chip-stack='true']")).toBeTruthy();
    expect(screen.getByText("125")).toBeInTheDocument();
  });
});

describe("ChipTransferLayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const transfer: ChipTransfer = {
    id: "t1",
    kind: "bet-to-pot",
    amount: 25,
    from: { type: "player-bankroll", playerId: "p1" },
    to: { type: "pot" },
    sourcePlayerId: "p1",
    durationMs: 400,
    timestamp: Date.now(),
  };

  it("skips travel safely when anchors are missing", () => {
    const onComplete = vi.fn();
    render(
      <ChipTransferLayer
        transfers={[transfer]}
        tableSurfaceRef={{ current: null }}
        visualLevel="full"
        onTransferComplete={onComplete}
      />
    );
    act(() => {
      vi.runAllTimers();
    });
    expect(onComplete).toHaveBeenCalledWith("t1");
    expect(screen.queryByTestId("chip-transfer-layer")).toBeNull();
  });

  it("reduced motion does not render travel layer", () => {
    const onComplete = vi.fn();
    render(
      <ChipTransferLayer
        transfers={[transfer]}
        tableSurfaceRef={{ current: null }}
        visualLevel="reduced"
        onTransferComplete={onComplete}
      />
    );
    expect(screen.queryByTestId("chip-transfer-layer")).toBeNull();
    act(() => {
      vi.runAllTimers();
    });
    expect(onComplete).toHaveBeenCalledWith("t1");
  });

  it("dedupes the same transfer id across updates", () => {
    const onComplete = vi.fn();
    const { rerender } = render(
      <ChipTransferLayer
        transfers={[transfer]}
        tableSurfaceRef={{ current: null }}
        visualLevel="full"
        onTransferComplete={onComplete}
      />
    );
    rerender(
      <ChipTransferLayer
        transfers={[transfer, { ...transfer }]}
        tableSurfaceRef={{ current: null }}
        visualLevel="full"
        onTransferComplete={onComplete}
      />
    );
    act(() => {
      vi.runAllTimers();
    });
    // Completes once per unique handled id
    expect(onComplete.mock.calls.filter((c) => c[0] === "t1").length).toBe(1);
  });
});

describe("PokerTable chip integration", () => {
  it("renders pot chip stack and player bankroll stacks", () => {
    const { container } = render(
      <PokerTable
        pot={125}
        players={[
          { id: "you", name: "You", bankroll: 635 },
          { id: "bot", name: "Bot", bankroll: 100, isBot: true },
        ]}
        currentIndex={0}
        playerId="you"
      />
    );
    expect(container.querySelector("[data-pot-anchor='true']")).toBeTruthy();
    expect(container.querySelector("[data-pot-chip-stack='true']")).toBeTruthy();
    expect(container.querySelector("[data-bankroll-anchor='you']")).toBeTruthy();
    expect(container.querySelector("[data-bankroll-anchor='bot']")).toBeTruthy();
    expect(screen.getByRole("group", { name: /pot: 125 chips/i })).toBeInTheDocument();
    expect(screen.getByText("Dealer")).toBeInTheDocument();
  });

  it("does not render legacy red/gray ornamental tray chips", () => {
    const { container } = render(
      <PokerTable
        pot={10}
        players={[{ id: "you", name: "You", bankroll: 50 }]}
        currentIndex={0}
        playerId="you"
      />
    );
    const redGray = Array.from(container.querySelectorAll("div")).filter((el) => {
      const bg = (el as HTMLElement).style?.background || "";
      return bg.includes("#c03030") || bg.includes("#f5f5f5");
    });
    expect(redGray).toHaveLength(0);
  });

  it("does not invent wager markers without currentBetByPlayerId", () => {
    const { container } = render(
      <PokerTable
        pot={50}
        players={[{ id: "you", name: "You", bankroll: 80 }]}
        currentIndex={0}
        playerId="you"
      />
    );
    expect(container.querySelector(".player-bet-marker")).toBeNull();
  });

  it("shows wager marker when authoritative bet is provided", () => {
    const { container } = render(
      <PokerTable
        pot={50}
        players={[{ id: "you", name: "You", bankroll: 80 }]}
        currentIndex={0}
        playerId="you"
        currentBetByPlayerId={{ you: 10 }}
      />
    );
    expect(container.querySelector(".player-bet-marker")).toBeTruthy();
  });
});
