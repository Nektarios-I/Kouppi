import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/game/Toast";

const joinRoom = vi.fn();
const joinAsSpectator = vi.fn();
const connect = vi.fn();
const clearRoomState = vi.fn();
const setIdentity = vi.fn();
const clearError = vi.fn();

let mockStore: Record<string, unknown>;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "test-room" }),
}));

vi.mock("@/store/authStore", () => ({
  useAuthStore: () => ({ user: null, isLoggedIn: () => false }),
}));

vi.mock("@/components/game/LobbyUI", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/game/LobbyUI")>();
  return {
    ...actual,
    LobbyShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PreGameShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

vi.mock("@/store/remoteGameStore", () => ({
  useRemoteGameStore: () => mockStore,
}));

vi.mock("../components/MultiplayerTableGraphics", () => ({
  default: () => <div data-testid="game-table">Table</div>,
}));

vi.mock("../components/Chat", () => ({ default: () => null }));
vi.mock("../components/SoundControl", () => ({ default: () => null }));
vi.mock("../components/EmotePanel", () => ({ default: () => null }));

import RoomPage from "@/app/room/[id]/page";
function baseStore(overrides: Record<string, unknown> = {}) {
  return {
    connect,
    connected: true,
    roomId: null,
    isHost: false,
    hostId: "host-1",
    isSpectator: false,
    playersInRoom: [],
    spectatorsInRoom: [],
    gameStarted: false,
    state: null,
    playerId: "you",
    playerName: "Tester",
    playerAvatar: null,
    setIdentity,
    setAvatar: vi.fn(),
    joinRoom,
    subscribeToCareerRoom: vi.fn(),
    joinAsSpectator,
    leaveRoom: vi.fn(),
    leaveSpectator: vi.fn(),
    startGame: vi.fn(),
    listRooms: vi.fn(),
    lastError: null,
    clearError,
    ...overrides,
  };
}

describe("room page join flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = baseStore();
  });

  it("shows spectator option on game_in_progress", async () => {
    joinRoom.mockResolvedValue({
      success: false,
      error: "Game in progress",
      code: "game_in_progress",
    });

    render(
      <ToastProvider>
        <RoomPage />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(joinRoom).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/Watch as Spectator/i)).toBeInTheDocument();
    });
  });

  it("shows password modal on wrong_password", async () => {
    joinRoom.mockResolvedValue({
      success: false,
      error: "Incorrect password",
      code: "wrong_password",
    });

    render(
      <ToastProvider>
        <RoomPage />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(joinRoom).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/Private Room/i)).toBeInTheDocument();
    });
  });
});

describe("waiting room host label", () => {
  it("marks host by hostId not list index", async () => {
    const WaitingRoom = (await import("@/components/game/WaitingRoom")).default;
    render(
      <WaitingRoom
        roomId="test-room"
        hostId="p2"
        connected
        isHost={false}
        players={[
          { id: "p1", name: "First" },
          { id: "p2", name: "HostPlayer" },
        ]}
        spectators={[]}
        playerId="p1"
        playerAvatar={null}
        starting={false}
        lastError={null}
        onAvatarChange={vi.fn()}
        onStartGame={vi.fn()}
        onLeave={vi.fn()}
        onCopyLink={vi.fn()}
      />
    );

    expect(screen.getByText("HostPlayer")).toBeInTheDocument();
    expect(screen.getAllByText("Host")).toHaveLength(1);
  });
});
