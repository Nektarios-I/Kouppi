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

  it("joinQueue ACK does not wipe an already-found match", async () => {
    const emit = vi.fn(
      (
        _event: string,
        _payload: unknown,
        cb?: (err: null, data: { inQueue: boolean; matched?: boolean }) => void
      ) => {
        // Simulate late ACK after matchFound event already applied
        useCareerLobbyStore.setState({
          matchFound: {
            roomId: "career-xyz",
            opponent: {
              username: "Opp",
              rating: 1200,
              avatarEmoji: "♠",
              avatarColor: "#000",
              avatarBorder: "#fff",
            },
          },
          queueState: null,
        });
        cb?.(null, { inQueue: true, matched: false });
      }
    );
    useCareerLobbyStore.setState({
      socket: { connected: true, emit, disconnect: vi.fn() } as never,
      queueState: null,
      isJoiningQueue: false,
      matchFound: null,
    });

    await useCareerLobbyStore.getState().joinQueue("tok", "bronze-1");
    const state = useCareerLobbyStore.getState();
    expect(state.matchFound?.roomId).toBe("career-xyz");
    expect(state.queueState).toBeNull();
  });

  it("createWaitingRoom applies room payload from ACK", async () => {
    const room = {
      roomId: "career-wait1",
      tierId: "bronze",
      anteId: "bronze-1",
      ante: 5,
      minBet: 5,
      maxBet: 25,
      status: "waiting" as const,
      players: [
        {
          userId: "u1",
          username: "Host",
          rating: 1200,
          avatarEmoji: "♠",
          avatarColor: "#111",
          avatarBorder: "#222",
        },
      ],
      playerCount: 1,
      maxPlayers: 8,
      autoStartAt: null,
      secondsRemaining: null,
    };
    const emit = vi.fn(
      (_event: string, _payload: unknown, cb?: (err: null, data: unknown) => void) => {
        cb?.(null, { success: true, roomId: room.roomId, room });
      }
    );
    useCareerLobbyStore.setState({
      socket: { connected: true, emit, disconnect: vi.fn() } as never,
      isJoiningRoom: false,
      currentRoom: null,
      selectedTierId: "bronze",
    });

    const ok = await useCareerLobbyStore.getState().createWaitingRoom("tok", "bronze-1");
    expect(ok).toBe(true);
    expect(useCareerLobbyStore.getState().currentRoom?.roomId).toBe("career-wait1");
    expect(useCareerLobbyStore.getState().isJoiningRoom).toBe(false);
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
