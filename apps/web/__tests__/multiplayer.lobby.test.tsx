import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/game/Toast";

const joinRoom = vi.fn().mockResolvedValue({ success: true });
const listRooms = vi.fn();
const connect = vi.fn();
const clearRoomState = vi.fn();
const setIdentity = vi.fn();
const clearError = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/components/game/LobbyUI", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/game/LobbyUI")>();
  return {
    ...actual,
    LobbyShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

const joinAsSpectator = vi.fn().mockResolvedValue({ success: true });

let mockStore: Record<string, unknown>;

vi.mock("@/store/remoteGameStore", () => ({
  useRemoteGameStore: () => mockStore,
}));

import LobbyPage from "@/app/lobby/page";

function defaultRooms() {
  return [
    { id: "lobby-1", playerCount: 1, maxPlayers: 2, started: false },
    { id: "lobby-2", playerCount: 2, maxPlayers: 2, started: true, spectatorsAllowed: true },
  ];
}

function baseStore(overrides: Record<string, unknown> = {}) {
  return {
    connect,
    joinRoom,
    listRooms,
    joinAsSpectator,
    clearRoomState,
    setIdentity,
    clearError,
    connected: true,
    rooms: defaultRooms(),
    playerId: "you",
    playerName: "Tester",
    lastError: null,
    ...overrides,
  };
}

function renderLobby() {
  return render(
    <ToastProvider>
      <LobbyPage />
    </ToastProvider>
  );
}

describe("Multiplayer lobby UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockStore = baseStore();
  });

  it("shows connection status", async () => {
    renderLobby();
    expect(await screen.findByText(/Connected/i)).toBeInTheDocument();
  });

  it("renders lobby list and join buttons", async () => {
    renderLobby();
    expect(await screen.findByText("lobby-1")).toBeInTheDocument();
    const joinButtons = await screen.findAllByRole("button", { name: /Join/i });
    expect(joinButtons.length).toBeGreaterThan(0);
  });

  it("calls joinRoom when clicking Join", async () => {
    const user = userEvent.setup();
    renderLobby();
    const row = await screen.findByText("lobby-1");
    const card = row.closest(".lobby-room-row");
    const joinBtn = card?.querySelector("button");
    expect(joinBtn).toBeTruthy();
    await user.click(joinBtn!);
    expect(joinRoom).toHaveBeenCalledWith("lobby-1", undefined);
  });

  it("clears sessionStorage when changing name", async () => {
    sessionStorage.setItem("kouppi_player_id", "old-id");
    sessionStorage.setItem("kouppi_player_name", "OldName");
    sessionStorage.setItem("kouppi_player_avatar", '{"emoji":"🎮","color":"#000","borderColor":"#111"}');
    const user = userEvent.setup();
    renderLobby();
    await user.click(await screen.findByRole("button", { name: /Change Name/i }));
    expect(sessionStorage.getItem("kouppi_player_id")).toBeNull();
    expect(sessionStorage.getItem("kouppi_player_name")).toBeNull();
    expect(sessionStorage.getItem("kouppi_player_avatar")).toBeNull();
  });

  it("opens password modal when spectating a private room", async () => {
    mockStore = baseStore({
      rooms: [
        {
          id: "private-live",
          playerCount: 2,
          maxPlayers: 4,
          started: true,
          spectatorsAllowed: true,
          isPrivate: true,
        },
      ],
    });

    const user = userEvent.setup();
    renderLobby();
    await user.click(await screen.findByRole("button", { name: /^Watch$/i }));
    expect(await screen.findByText(/Enter the password to watch/i)).toBeInTheDocument();
    expect(joinAsSpectator).not.toHaveBeenCalled();
  });
});
