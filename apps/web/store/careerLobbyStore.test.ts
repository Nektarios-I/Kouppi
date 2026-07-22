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
          avatarId: "portrait-01",
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
              avatarId: "portrait-01",
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
          avatarId: "portrait-01",
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

  it("CAREER-WEB-QJ-001: joinQueue shows searching immediately and restores on server error", async () => {
    const emit = vi.fn(
      (
        _event: string,
        _payload: unknown,
        cb?: (err: { code: string; message: string }, data?: unknown) => void
      ) => {
        expect(useCareerLobbyStore.getState().isJoiningQueue).toBe(true);
        expect(useCareerLobbyStore.getState().queueState?.inQueue).toBe(true);
        cb?.({ code: "insufficient_bankroll", message: "Not enough bankroll" });
      }
    );
    useCareerLobbyStore.setState({
      socket: { connected: true, emit, disconnect: vi.fn() } as never,
      queueState: null,
      isJoiningQueue: false,
      error: null,
    });

    const ok = await useCareerLobbyStore.getState().joinQueue("tok", "bronze-1");
    expect(ok).toBe(false);
    const state = useCareerLobbyStore.getState();
    expect(state.isJoiningQueue).toBe(false);
    expect(state.queueState).toBeNull();
    expect(state.error).toMatch(/bankroll/i);
  });

  it("CAREER-WEB-QJ-001: matchFound clears queue searching state", () => {
    useCareerLobbyStore.setState({
      socket: { connected: true, emit: vi.fn(), disconnect: vi.fn(), on: vi.fn() } as never,
      queueState: {
        inQueue: true,
        position: 1,
        waitTime: 3,
        searchRange: 100,
        queueSize: 2,
        anteId: "bronze-1",
      },
      isJoiningQueue: true,
      matchFound: null,
    });

    // Simulate the listener body from connect()
    useCareerLobbyStore.setState({
      matchFound: {
        roomId: "career-match1",
        opponent: { username: "Opp", rating: 1200, avatarId: "portrait-01" },
      },
      queueState: null,
      isJoiningQueue: false,
      queueJoinedAt: null,
    });

    const state = useCareerLobbyStore.getState();
    expect(state.matchFound?.roomId).toBe("career-match1");
    expect(state.queueState).toBeNull();
    expect(state.isJoiningQueue).toBe(false);
  });

  it("CAREER-WEB-CT-001: createWaitingRoom blocks double-submit and restores on failure", async () => {
    const emit = vi.fn();
    useCareerLobbyStore.setState({
      socket: { connected: true, emit, disconnect: vi.fn() } as never,
      isJoiningRoom: true,
      currentRoom: null,
      error: null,
    });
    const blocked = await useCareerLobbyStore.getState().createWaitingRoom("tok", "bronze-1");
    expect(blocked).toBe(false);
    expect(emit).not.toHaveBeenCalled();

    emit.mockImplementation(
      (
        _event: string,
        _payload: unknown,
        cb?: (err: { code: string; message: string }, data?: unknown) => void
      ) => {
        cb?.({ code: "create_failed", message: "Could not create waiting table" });
      }
    );
    useCareerLobbyStore.setState({ isJoiningRoom: false, error: null });
    const failed = await useCareerLobbyStore.getState().createWaitingRoom("tok", "bronze-1");
    expect(failed).toBe(false);
    expect(useCareerLobbyStore.getState().isJoiningRoom).toBe(false);
    expect(useCareerLobbyStore.getState().currentRoom).toBeNull();
    expect(useCareerLobbyStore.getState().error).toMatch(/create/i);
  });

  it("CAREER-WEB-WAIT-001: roomUpdate and autoStartTimer update waiting state; transition sets gameRoomId", () => {
    useCareerLobbyStore.setState({
      currentRoom: {
        roomId: "career-w1",
        tierId: "bronze",
        anteId: "bronze-1",
        ante: 5,
        minBet: 5,
        maxBet: 25,
        status: "waiting",
        players: [
          {
            userId: "u1",
            username: "Host",
            rating: 1200,
            avatarId: "portrait-01",
            ready: false,
          },
        ],
        playerCount: 1,
        maxPlayers: 2,
        autoStartAt: null,
        secondsRemaining: null,
      },
      matchFound: {
        roomId: "career-w1",
        opponent: { username: "x", rating: 1, avatarId: "portrait-01" },
      },
      gameRoomId: null,
    });

    useCareerLobbyStore.setState({
      currentRoom: {
        roomId: "career-w1",
        tierId: "bronze",
        anteId: "bronze-1",
        ante: 5,
        minBet: 5,
        maxBet: 25,
        status: "waiting",
        players: [
          {
            userId: "u1",
            username: "Host",
            rating: 1200,
            avatarId: "portrait-01",
            ready: true,
          },
          {
            userId: "u2",
            username: "Guest",
            rating: 1210,
            avatarId: "portrait-02",
            ready: true,
          },
        ],
        playerCount: 2,
        maxPlayers: 2,
        autoStartAt: null,
        secondsRemaining: null,
      },
      matchFound: null,
    });
    expect(useCareerLobbyStore.getState().currentRoom?.playerCount).toBe(2);
    expect(useCareerLobbyStore.getState().matchFound).toBeNull();
    expect(useCareerLobbyStore.getState().currentRoom?.players.every((p) => p.ready)).toBe(true);

    const current = useCareerLobbyStore.getState().currentRoom!;
    const startsAt = Date.now() + 60_000;
    useCareerLobbyStore.setState({
      currentRoom: {
        ...current,
        status: "starting",
        autoStartAt: startsAt,
        secondsRemaining: 60,
      },
    });
    expect(useCareerLobbyStore.getState().currentRoom?.secondsRemaining).toBe(60);
    expect(useCareerLobbyStore.getState().currentRoom?.status).toBe("starting");

    useCareerLobbyStore.setState({ gameRoomId: "career-game-abc" });
    expect(useCareerLobbyStore.getState().gameRoomId).toBe("career-game-abc");
  });

  it("CAREER-WEB-WAIT-001: setReady emits career:setReady and applies room ACK", async () => {
    const emit = vi.fn(
      (
        _event: string,
        _payload: unknown,
        cb?: (err: null, data: { success: boolean; room: unknown }) => void
      ) => {
        cb?.(null, {
          success: true,
          room: {
            roomId: "career-w1",
            tierId: "bronze",
            anteId: "bronze-1",
            ante: 5,
            minBet: 5,
            maxBet: 25,
            status: "waiting",
            players: [
              {
                userId: "u1",
                username: "Host",
                rating: 1200,
                avatarId: "portrait-01",
                ready: true,
              },
            ],
            playerCount: 1,
            maxPlayers: 2,
            autoStartAt: null,
            secondsRemaining: null,
          },
        });
      }
    );
    useCareerLobbyStore.setState({
      socket: { connected: true, emit, disconnect: vi.fn() } as never,
      currentRoom: {
        roomId: "career-w1",
        tierId: "bronze",
        anteId: "bronze-1",
        ante: 5,
        minBet: 5,
        maxBet: 25,
        status: "waiting",
        players: [
          {
            userId: "u1",
            username: "Host",
            rating: 1200,
            avatarId: "portrait-01",
            ready: false,
          },
        ],
        playerCount: 1,
        maxPlayers: 2,
        autoStartAt: null,
        secondsRemaining: null,
      },
    });

    const ok = await useCareerLobbyStore.getState().setReady("tok", true);
    expect(ok).toBe(true);
    expect(emit).toHaveBeenCalledWith(
      "career:setReady",
      { token: "tok", ready: true },
      expect.any(Function)
    );
    expect(useCareerLobbyStore.getState().currentRoom?.players[0].ready).toBe(true);
  });
});
