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

vi.mock("@/store/remoteGameStore", () => {
  const rooms = [
    { id: "lobby-1", playerCount: 1, maxPlayers: 2, started: false },
    { id: "lobby-2", playerCount: 2, maxPlayers: 2, started: true },
  ];
  return {
    useRemoteGameStore: () => ({
      connect,
      joinRoom,
      listRooms,
      joinAsSpectator: vi.fn(),
      clearRoomState,
      setIdentity,
      clearError,
      connected: true,
      rooms,
      playerId: "you",
      playerName: "Tester",
      lastError: null,
    }),
  };
});

import LobbyPage from "@/app/lobby/page";

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
    const user = userEvent.setup();
    renderLobby();
    await user.click(await screen.findByRole("button", { name: /Change Name/i }));
    expect(sessionStorage.getItem("kouppi_player_id")).toBeNull();
    expect(sessionStorage.getItem("kouppi_player_name")).toBeNull();
  });
});
