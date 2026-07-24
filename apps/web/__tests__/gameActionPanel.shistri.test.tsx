/**
 * SHI-STAKE-UI-001 — SHISTRI stake labels on the action dock.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import GameActionPanel from "@/components/game/GameActionPanel";

const baseProps = {
  bet: 10,
  onBetChange: () => {},
  minBet: 10,
  maxBet: 50,
  bankroll: 100,
  pot: 100,
  canKouppi: true,
  onPass: () => {},
  onBet: () => {},
  onKouppi: () => {},
  onShistri: () => {},
};

describe("GameActionPanel SHISTRI stake display", () => {
  it("renders compact controls without legacy YOUR MOVE window chrome", () => {
    render(
      <GameActionPanel
        {...baseProps}
        shistriEligible={false}
        shistriAmount={0}
      />
    );
    expect(screen.queryByText("YOUR MOVE")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /your move controls/i })).not.toBeInTheDocument();
  });

  it("shows stake amount on Bet, KOUPPI, and SHISTRI without Risk copy", () => {
    render(
      <GameActionPanel
        {...baseProps}
        shistriEligible
        shistriAmount={7}
        shistriPercent={7}
      />
    );
    expect(screen.getByRole("button", { name: "Bet 10" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /KOUPPI all-in 100/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /SHISTRI 7 chips \(7% of pot\)/i })).toBeEnabled();
    expect(screen.queryByText(/Risk:/i)).not.toBeInTheDocument();
    expect(screen.getByTitle("SHISTRI 7 (7% of pot)")).toBeInTheDocument();
    const shistri = screen.getByRole("button", { name: /SHISTRI 7 chips/i });
    expect(shistri).toHaveTextContent("SHISTRI");
    expect(shistri).toHaveTextContent("7");
  });

  it("does not show a playable stake when ineligible", () => {
    render(
      <GameActionPanel
        {...baseProps}
        shistriEligible={false}
        shistriAmount={7}
        shistriPercent={7}
      />
    );
    const btn = screen.getByRole("button", { name: /SHISTRI not available/i });
    expect(btn).toBeDisabled();
    expect(screen.queryByText(/Risk:/i)).toBeNull();
  });

  it("uses custom table percent in accessible label", () => {
    render(
      <GameActionPanel
        {...baseProps}
        shistriEligible
        shistriAmount={10}
        shistriPercent={10}
      />
    );
    expect(screen.getByRole("button", { name: /10% of pot/i })).toBeInTheDocument();
  });
});
