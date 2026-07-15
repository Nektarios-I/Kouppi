import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WaitingRoom from "@/components/game/WaitingRoom";
import Chat from "@/components/Chat";

let mockStore: Record<string, unknown>;

vi.mock("@/store/remoteGameStore", () => ({
  useRemoteGameStore: () => mockStore,
}));

describe("Sprint 2 UI", () => {
  it("WaitingRoom shows transfer host and close room controls for host", async () => {
    const onTransfer = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <WaitingRoom
        roomCode="HOST01"
        hostId="host-1"
        connected
        isHost
        players={[
          { id: "host-1", name: "Host", ready: true, connected: true },
          { id: "p2", name: "Bob", ready: true, connected: true },
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
        onTransferHost={onTransfer}
        onCloseRoom={onClose}
      />
    );

    await user.click(screen.getByRole("button", { name: /Make Host/i }));
    expect(onTransfer).toHaveBeenCalledWith("p2");

    await user.click(screen.getByRole("button", { name: /Close Room/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("Chat renders system messages centered without player bubble", () => {
    mockStore = {
      chatMessages: [
        {
          id: "1",
          playerId: "system",
          playerName: "System",
          message: "Alice joined the room",
          timestamp: Date.now(),
          isSystem: true,
        },
        {
          id: "2",
          playerId: "p1",
          playerName: "Alice",
          message: "Hi everyone",
          timestamp: Date.now(),
        },
      ],
      sendChatMessage: vi.fn(),
      fetchChatHistory: vi.fn(),
      playerId: "p2",
      roomId: "room-1",
      lastError: null,
      clearError: vi.fn(),
    };

    render(<Chat />);

    expect(screen.getByText("Alice joined the room")).toBeInTheDocument();
    expect(screen.getByText("Hi everyone")).toBeInTheDocument();
    expect(screen.queryByText("System")).not.toBeInTheDocument();
  });

  it("Chat shows rate limit error from store", () => {
    mockStore = {
      chatMessages: [],
      sendChatMessage: vi.fn(),
      fetchChatHistory: vi.fn(),
      playerId: "p1",
      roomId: "room-1",
      lastError: "Slow down — wait 1s before sending another message",
      clearError: vi.fn(),
    };

    render(<Chat />);

    expect(screen.getByRole("alert")).toHaveTextContent(/Slow down/i);
  });
});
