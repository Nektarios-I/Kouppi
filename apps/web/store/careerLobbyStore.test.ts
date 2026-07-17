/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    connected: false,
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

import { useCareerLobbyStore } from "./careerLobbyStore";

describe("careerLobbyStore queue lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useCareerLobbyStore.getState().reset();
  });

  afterEach(() => {
    useCareerLobbyStore.getState().reset();
    vi.useRealTimers();
  });

  it("does not overwrite matchFound state with stale queue polling", () => {
    useCareerLobbyStore.setState({
      socket: { connected: true, emit: vi.fn(), disconnect: vi.fn() } as any,
      queueState: {
        inQueue: true,
        position: 1,
        waitTime: 0,
        searchRange: 100,
        queueSize: 1,
      },
    });

    useCareerLobbyStore.getState().startQueuePolling("token");
    expect(useCareerLobbyStore.getState().queuePollInterval).toBeTruthy();

    useCareerLobbyStore.setState({
      matchFound: {
        roomId: "career-abc",
        opponent: {
          username: "Rival",
          rating: 1200,
          avatarEmoji: "♠",
          avatarColor: "#000",
          avatarBorder: "#fff",
        },
      },
      queueState: null,
    });

    vi.advanceTimersByTime(2000);
    expect(useCareerLobbyStore.getState().matchFound?.roomId).toBe("career-abc");
    expect(useCareerLobbyStore.getState().queuePollInterval).toBeNull();
  });

  it("stopQueuePolling clears interval", () => {
    useCareerLobbyStore.setState({
      socket: { connected: true, emit: vi.fn(), disconnect: vi.fn() } as any,
      queueState: {
        inQueue: true,
        position: 1,
        waitTime: 0,
        searchRange: 100,
        queueSize: 1,
      },
    });

    const store = useCareerLobbyStore.getState();
    store.startQueuePolling("token");
    expect(useCareerLobbyStore.getState().queuePollInterval).toBeTruthy();
    store.stopQueuePolling();
    expect(useCareerLobbyStore.getState().queuePollInterval).toBeNull();
  });
});
