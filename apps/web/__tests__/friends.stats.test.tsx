import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  FriendsStatsSummary,
  FriendsSessionRow,
  FriendsStatsEmpty,
} from "@/components/FriendsStatsView";

describe("FriendsStatsView", () => {
  it("renders summary metrics", () => {
    render(
      <FriendsStatsSummary
        stats={{
          gamesPlayed: 12,
          mvpCount: 3,
          recentSessions: [{ id: "1" }, { id: "2" }] as never,
        }}
      />
    );

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("Games played")).toBeInTheDocument();
  });

  it("renders session row with MVP badge", () => {
    render(
      <FriendsSessionRow
        session={{
          id: "sess-1",
          roomCode: "PLAY42",
          endedAt: Date.now(),
          handsPlayed: 8,
          biggestPot: 120,
          playerCount: 4,
          wasMvp: true,
          finalBankroll: 340,
        }}
      />
    );

    expect(screen.getByText("PLAY42")).toBeInTheDocument();
    expect(screen.getByText("MVP")).toBeInTheDocument();
    expect(screen.getByText(/8/)).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();
  });

  it("shows empty state copy", () => {
    render(<FriendsStatsEmpty />);
    expect(screen.getByText(/No friends games recorded yet/i)).toBeInTheDocument();
  });
});
