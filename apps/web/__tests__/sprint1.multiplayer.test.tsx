import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WaitingRoom from "@/components/game/WaitingRoom";
import ConnectionStatusBanner from "@/components/game/ConnectionStatusBanner";
import RoomInvitePanel from "@/components/game/RoomInvitePanel";

let mockStore: Record<string, unknown>;

vi.mock("@/store/remoteGameStore", () => ({
  useRemoteGameStore: () => mockStore,
}));

describe("Sprint 1 UI", () => {
  it("WaitingRoom shows ready states and host kick control", async () => {
    const onKick = vi.fn();
    const user = userEvent.setup();

    render(
      <WaitingRoom
        roomCode="ABC123"
        hostId="host-1"
        connected
        isHost
        players={[
          { id: "host-1", name: "Host", ready: true, connected: true },
          { id: "p2", name: "Bob", ready: false, connected: true },
        ]}
        spectators={[]}
        playerId="host-1"
        playerAvatar={null}
        starting={false}
        lastError={null}
        onAvatarChange={vi.fn()}
        onStartGame={vi.fn()}
        onLeave={vi.fn()}
        onCopyLink={vi.fn()}
        onSetReady={vi.fn()}
        onKickPlayer={onKick}
        onTransferHost={vi.fn()}
        onCloseRoom={vi.fn()}
      />
    );

    expect(screen.getAllByText("ABC123").length).toBeGreaterThan(0);
    expect(screen.getByText("1/2 ready")).toBeInTheDocument();
    expect(screen.getByText("Not ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start Game/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Kick/i }));
    expect(onKick).toHaveBeenCalledWith("p2");
  });

  it("WaitingRoom shows reconnect countdown for disconnected player", () => {
    render(
      <WaitingRoom
        roomCode="GRACE1"
        hostId="host-1"
        connected
        isHost={false}
        players={[
          { id: "host-1", name: "Host", ready: true, connected: true },
          { id: "p2", name: "Bob", ready: true, connected: false, reconnectRemainingSec: 38 },
        ]}
        spectators={[]}
        playerId="host-1"
        playerAvatar={null}
        starting={false}
        lastError={null}
        onAvatarChange={vi.fn()}
        onStartGame={vi.fn()}
        onLeave={vi.fn()}
        onCopyLink={vi.fn()}
        onSetReady={vi.fn()}
        onKickPlayer={vi.fn()}
        onTransferHost={vi.fn()}
        onCloseRoom={vi.fn()}
      />
    );

    expect(screen.getByText(/Reconnecting… 38s/i)).toBeInTheDocument();
  });

  it("ConnectionStatusBanner shows reconnecting message", () => {
    mockStore = { connectionStatus: "reconnecting", connected: false };
    render(<ConnectionStatusBanner />);
    expect(screen.getByText(/Reconnecting to server/i)).toBeInTheDocument();
  });

  it("RoomInvitePanel renders join URL with room code", () => {
    render(<RoomInvitePanel roomCode="PLAY99" onCopyLink={vi.fn()} />);
    expect(screen.getByText("PLAY99")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/\/join\?code=PLAY99/i)).toBeInTheDocument();
  });
});
