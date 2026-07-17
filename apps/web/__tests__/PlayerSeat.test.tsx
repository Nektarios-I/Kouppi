import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerSeat, { type SeatPlayerView } from "@/components/game/PlayerSeat";

function basePlayer(overrides: Partial<SeatPlayerView> = {}): SeatPlayerView {
  return {
    id: "p1",
    name: "Alice",
    bankroll: 2480,
    isBot: false,
    isActive: true,
    isBankrupt: false,
    isMe: false,
    isCurrentTurn: false,
    ...overrides,
  };
}

describe("PlayerSeat", () => {
  it("renders human with compact bankroll and name", () => {
    render(
      <PlayerSeat
        player={basePlayer({ name: "Alice", bankroll: 2480 })}
        breakpoint="desktop"
        edge="bottom"
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("2.5K")).toBeInTheDocument();
    expect(screen.queryByText("Your turn")).not.toBeInTheDocument();
  });

  it("renders bot with BOT badge", () => {
    render(
      <PlayerSeat
        player={basePlayer({ id: "bot1", name: "Bot 1", isBot: true })}
        breakpoint="desktop"
        edge="top"
      />
    );
    expect(screen.getByText("Bot 1")).toBeInTheDocument();
    expect(screen.getByText("BOT")).toBeInTheDocument();
  });

  it("shows TURN badge for active turn without personal Your turn text on bots", () => {
    render(
      <PlayerSeat
        player={basePlayer({
          id: "bot1",
          name: "Bot 1",
          isBot: true,
          isCurrentTurn: true,
        })}
        breakpoint="desktop"
        edge="top"
      />
    );
    expect(screen.getByText("TURN")).toBeInTheDocument();
    expect(screen.queryByText(/^Your turn$/)).not.toBeInTheDocument();
    expect(screen.getByText(/Bot 1's turn/i)).toBeInTheDocument();
  });

  it("announces Your turn only for local player via sr-only", () => {
    render(
      <PlayerSeat
        player={basePlayer({
          name: "You",
          isMe: true,
          isCurrentTurn: true,
        })}
        breakpoint="desktop"
        edge="bottom"
        turnRemainingSec={12}
      />
    );
    expect(screen.getByText("TURN")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Your turn")).toBeInTheDocument();
  });

  it("truncates long names on mobile opponent seats", () => {
    render(
      <PlayerSeat
        player={basePlayer({ name: "NektariosTheGreat", isMe: false })}
        breakpoint="mobile"
        edge="top"
      />
    );
    expect(screen.getByTitle("NektariosTheGreat")).toBeInTheDocument();
    expect(screen.getByText(/Nektar/)).toBeInTheDocument();
  });

  it("renders initials fallback when human has no avatar", () => {
    const { container } = render(
      <PlayerSeat
        player={basePlayer({ name: "Charlie", avatar: undefined })}
        breakpoint="desktop"
        edge="left"
      />
    );
    expect(container.querySelector(".player-avatar--initials")).toBeTruthy();
    expect(screen.getByText("CH")).toBeInTheDocument();
  });

  it("dims bankrupt seats", () => {
    const { container } = render(
      <PlayerSeat
        player={basePlayer({ bankroll: 0, isBankrupt: true })}
        breakpoint="desktop"
        edge="bottom"
      />
    );
    expect(container.querySelector(".player-seat--dimmed")).toBeTruthy();
  });

  it("uses compact mobile opponent layout without horizontal pod", () => {
    const { container } = render(
      <PlayerSeat
        player={basePlayer({ name: "Bot 1", isBot: true, isMe: false })}
        breakpoint="mobile"
        edge="top"
      />
    );
    expect(container.querySelector(".player-seat--mobile-opponent")).toBeTruthy();
    expect(container.querySelector(".player-seat__pod")).toBeFalsy();
  });
});
