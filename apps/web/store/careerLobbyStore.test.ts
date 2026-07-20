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
      socket: { connected: true, emit: vi.fn(), disconnect: vi.fn() } as never,
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

  it("joinQueue applies ACK payload immediately (CAREER-UX-001)", async () => {
    const emit = vi.fn(
      (
        _event: string,
        _payload: unknown,
        cb?: (err: null, data: {
          inQueue: boolean;
          position: number;
          anteId: string;
          tierId: string;
          waitTime: number;
          searchRange: number;
          queueSize: number;
        }) => void
      ) => {
        cb?.(null, {
          inQueue: true,
          position: 2,
          anteId: "bronze-1",
          tierId: "bronze",
          waitTime: 0,
          searchRange: 100,
          queueSize: 1,
        });
      }
    );
    useCareerLobbyStore.setState({
      socket: { connected: true, emit, disconnect: vi.fn() } as never,
      selectedTierId: "bronze",
      authToken: null,
      queueState: null,
      isJoiningQueue: false,
    });

    const ok = await useCareerLobbyStore.getState().joinQueue("tok", "bronze-1");
    expect(ok).toBe(true);
    expect(emit).toHaveBeenCalledWith("career:joinAnte", { token: "tok", anteId: "bronze-1" }, expect.any(Function));
    const state = useCareerLobbyStore.getState();
    expect(state.isJoiningQueue).toBe(false);
    expect(state.queueState?.inQueue).toBe(true);
    expect(state.queueState?.position).toBe(2);
    expect(state.queueState?.anteId).toBe("bronze-1");
    expect(state.queueJoinedAt).toBeTruthy();
  });

  it("joinQueue rejects duplicate while already searching", async () => {
    const emit = vi.fn();
    useCareerLobbyStore.setState({
      socket: { connected: true, emit, disconnect: vi.fn() } as never,
      queueState: {
        inQueue: true,
        position: 1,
        waitTime: 0,
        searchRange: 100,
        queueSize: 1,
        anteId: "bronze-1",
      },
      isJoiningQueue: false,
    });
    const ok = await useCareerLobbyStore.getState().joinQueue("tok", "bronze-1");
    expect(ok).toBe(false);
    expect(emit).not.toHaveBeenCalled();
  });
});
