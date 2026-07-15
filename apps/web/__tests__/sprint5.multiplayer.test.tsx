import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConductGate, { hasAcceptedConduct, acceptConduct } from "@/components/game/ConductGate";
import { formatSocketError } from "@/lib/errorMessages";
import { mutePlayer, unmutePlayer, isPlayerMuted } from "@/lib/mutedPlayers";

describe("Sprint 5 social and trust UI", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("ConductGate blocks interaction until guidelines are accepted", async () => {
    const user = userEvent.setup();
    render(
      <ConductGate>
        <button type="button">Play</button>
      </ConductGate>
    );

    expect(screen.getByText(/Community Guidelines/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /I Agree/i }));
    expect(hasAcceptedConduct()).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("formatSocketError maps known server codes to friendly copy", () => {
    expect(formatSocketError("player_banned")).toContain("banned");
    expect(formatSocketError("chat_muted_all")).toContain("muted");
    expect(formatSocketError("unknown_code", "fallback")).toBe("fallback");
  });

  it("local mute hides a player from your session only", () => {
    expect(isPlayerMuted("player-9")).toBe(false);
    mutePlayer("player-9");
    expect(isPlayerMuted("player-9")).toBe(true);
    unmutePlayer("player-9");
    expect(isPlayerMuted("player-9")).toBe(false);
  });

  it("terms page mentions community conduct expectations", async () => {
    const Terms = (await import("@/app/terms/page")).default;
    render(<Terms />);
    expect(screen.getByText(/respectful/i)).toBeInTheDocument();
  });
});
