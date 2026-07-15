import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ROOM_PRESETS, getRoomPreset } from "@/lib/roomPresets";
import { RoundEndPanel } from "@/components/game/GamePanels";

describe("Sprint 6 discovery and retention UI", () => {
  it("room presets include quick, classic, and high stakes", () => {
    expect(ROOM_PRESETS).toHaveLength(3);
    expect(getRoomPreset("classic").config.startingBankroll).toBe(100);
    expect(getRoomPreset("quick").config.maxPlayers).toBe(4);
    expect(getRoomPreset("highStakes").config.ante).toBe(25);
  });

  it("RoundEndPanel shows session summary stats", () => {
    render(
      <RoundEndPanel
        standings={[{ id: "p1", name: "Alice", bankroll: 150, isMe: true }]}
        sessionStats={{ handsPlayed: 3, biggestPot: 40, mvpName: "Alice" }}
      >
        <button type="button">Play Again</button>
      </RoundEndPanel>
    );
    expect(screen.getByText("Hands")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Biggest pot")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("MVP")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play Again" })).toBeInTheDocument();
  });

  it("exports a web app manifest", async () => {
    const manifest = (await import("@/app/manifest")).default;
    const data = manifest();
    expect(data.name).toBe("KOUPPI");
    expect(data.display).toBe("standalone");
    expect(data.icons?.length).toBeGreaterThan(0);
  });
});
