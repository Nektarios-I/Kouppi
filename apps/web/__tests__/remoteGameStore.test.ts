import { describe, it, expect, vi, beforeEach } from "vitest";

const socketHandlers: Record<string, (...args: unknown[]) => void> = {};
const ioHandlers: Record<string, (...args: unknown[]) => void> = {};
const emitMock = vi.fn();

const mockSocket = {
  connected: true,
  on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    socketHandlers[event] = cb;
  }),
  io: {
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      ioHandlers[event] = cb;
    }),
  },
  removeAllListeners: vi.fn(),
  disconnect: vi.fn(),
  emit: emitMock,
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

import { useRemoteGameStore } from "@/store/remoteGameStore";

describe("remoteGameStore fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k]);
    Object.keys(ioHandlers).forEach((k) => delete ioHandlers[k]);
    useRemoteGameStore.setState({
      socket: null,
      connected: false,
      roomId: null,
      isSpectator: false,
      playerId: null,
      playerName: null,
      playersInRoom: [],
      state: null,
    });
  });

  it("re-joins room on socket reconnect", async () => {
    useRemoteGameStore.setState({
      roomId: "room-1",
      playerId: "p1",
      playerName: "Alice",
      isSpectator: false,
    });

    const joinRoomSpy = vi
      .spyOn(useRemoteGameStore.getState(), "joinRoom")
      .mockResolvedValue({ success: true });

    useRemoteGameStore.getState().connect();
    ioHandlers.reconnect?.();

    expect(joinRoomSpy).toHaveBeenCalledWith("room-1");
  });

  it("re-joins as spectator on socket reconnect", async () => {
    useRemoteGameStore.setState({
      roomId: "room-1",
      playerId: "s1",
      playerName: "Watcher",
      isSpectator: true,
    });

    const joinAsSpectatorSpy = vi
      .spyOn(useRemoteGameStore.getState(), "joinAsSpectator")
      .mockResolvedValue({ success: true });

    useRemoteGameStore.getState().connect();
    ioHandlers.reconnect?.();

    expect(joinAsSpectatorSpy).toHaveBeenCalledWith("room-1");
  });

  it("clearRoomState emits leaveSpectator for spectators", () => {
    useRemoteGameStore.setState({
      socket: mockSocket as never,
      roomId: "room-1",
      isSpectator: true,
    });

    useRemoteGameStore.getState().clearRoomState();

    expect(emitMock).toHaveBeenCalledWith("leaveSpectator", { roomId: "room-1" });
    expect(useRemoteGameStore.getState().roomId).toBeNull();
  });

  it("preserves avatars when state snapshots arrive", () => {
    useRemoteGameStore.setState({
      playersInRoom: [
        {
          id: "p1",
          name: "Alice",
          avatar: { emoji: "😎", color: "#111", borderColor: "#222" },
        },
      ],
    });

    useRemoteGameStore.getState().connect();
    socketHandlers.state?.({
      phase: "Round",
      players: [{ id: "p1", name: "Alice", bankroll: 100 }],
    });

    const player = useRemoteGameStore.getState().playersInRoom[0];
    expect(player.avatar?.emoji).toBe("😎");
  });

  it("shows no_decision message when kicked for missing round choice", () => {
    useRemoteGameStore.setState({ playerId: "p1", roomId: "room-1" });
    useRemoteGameStore.getState().connect();
    socketHandlers.playerKicked?.({ playerId: "p1", reason: "no_decision" });
    expect(useRemoteGameStore.getState().lastError).toMatch(/not choosing stay or leave/i);
    expect(useRemoteGameStore.getState().roomId).toBeNull();
  });

  it("retries rejoin on slot_taken during reconnect", async () => {
    vi.useFakeTimers();
    useRemoteGameStore.setState({
      roomId: "room-1",
      playerId: "p1",
      playerName: "Alice",
      isSpectator: false,
    });

    const joinRoomSpy = vi
      .spyOn(useRemoteGameStore.getState(), "joinRoom")
      .mockResolvedValueOnce({ success: false, error: "Slot taken", code: "slot_taken" })
      .mockResolvedValueOnce({ success: true });

    useRemoteGameStore.getState().connect();
    ioHandlers.reconnect?.();

    await vi.advanceTimersByTimeAsync(500);

    expect(joinRoomSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
