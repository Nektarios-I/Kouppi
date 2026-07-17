/**
 * Join Guards Tests
 * 
 * Sprint 1 - REQ-5: Join-After-Start Guard
 * Verifies that career games properly enforce join restrictions
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createRoomWithCreator,
  joinRoom,
  startRoom,
  getRoom,
  resetAllRoomsForTests,
} from "../../src/rooms.js";
import type { CareerMetadata } from "../../src/types.js";

describe("Career Join Guards", () => {
  beforeEach(() => {
    resetAllRoomsForTests();
  });

  afterEach(() => {
    resetAllRoomsForTests();
  });

  it("should allow players to join before game starts", () => {
    // Create career room
    const room = createRoomWithCreator(
      "career-test-join-1",
      { id: "host", name: "Host", socketId: "socket-host" },
      { ante: 50, maxPlayers: 4 },
      12345,
      undefined,
      undefined,
      { listedInLobby: false },
      { matchType: "career", tierId: "bronze", anteId: "bronze-1" }
    );

    expect(room.started).toBeFalsy();
    expect(room.players).toHaveLength(1);

    // Second player should be able to join
    const joinResult = joinRoom("career-test-join-1", {
      id: "player2",
      name: "Player 2",
      socketId: "socket-p2",
    });

    expect(joinResult).toBeTruthy();
    expect(joinResult.players).toHaveLength(2);
  });

  it("should reject new players after game has started", () => {
    // Create career room with 2 players
    const room = createRoomWithCreator(
      "career-test-started",
      { id: "host", name: "Host", socketId: "socket-host", ready: true },
      { ante: 50, maxPlayers: 4 },
      12345,
      undefined,
      undefined,
      { listedInLobby: false },
      { matchType: "career", tierId: "bronze", anteId: "bronze-1" }
    );

    // Add second player
    joinRoom("career-test-started", {
      id: "player2",
      name: "Player 2",
      socketId: "socket-p2",
      ready: true,
    });

    // Manually set ready states (in real game, this happens via setReady)
    const roomRef = getRoom("career-test-started");
    if (roomRef) {
      roomRef.players.forEach(p => p.ready = true);
    }

    // Start the game
    startRoom("career-test-started", "host");

    const startedRoom = getRoom("career-test-started");
    expect(startedRoom?.started).toBe(true);

    // Third player tries to join after start
    expect(() => {
      joinRoom("career-test-started", {
        id: "lateplayer",
        name: "Late Player",
        socketId: "socket-late",
      });
    }).toThrow("game_in_progress");
  });

  it("should allow existing player to reconnect with valid token", () => {
    // Create career room
    const room = createRoomWithCreator(
      "career-test-reconnect",
      { id: "host", name: "Host", socketId: "socket-host-1", ready: true },
      { ante: 50 },
      12345,
      undefined,
      undefined,
      { listedInLobby: false },
      { matchType: "career", tierId: "silver", anteId: "silver-1" }
    );

    // Add second player and get their token
    joinRoom("career-test-reconnect", {
      id: "player2",
      name: "Player 2",
      socketId: "socket-p2-1",
      ready: true,
    });

    const roomRef = getRoom("career-test-reconnect");
    const player2 = roomRef?.players.find(p => p.id === "player2");
    const player2Token = player2?.joinSessionToken;

    expect(player2Token).toBeTruthy();

    // Set all ready and start game
    if (roomRef) {
      roomRef.players.forEach(p => p.ready = true);
    }
    startRoom("career-test-reconnect", "host");

    // Player 2 disconnects (simulated by changing socket)
    // Then reconnects with valid token - should succeed
    const reconnectResult = joinRoom("career-test-reconnect", {
      id: "player2",
      name: "Player 2",
      socketId: "socket-p2-2", // New socket ID
    }, {
      joinSessionToken: player2Token,
    });

    expect(reconnectResult).toBeTruthy();
    expect(reconnectResult.players.find(p => p.id === "player2")?.socketId).toBe("socket-p2-2");
  });

  it("should reject reconnection with invalid token", () => {
    // Create and start career game
    const room = createRoomWithCreator(
      "career-test-invalid-token",
      { id: "host", name: "Host", socketId: "socket-host", ready: true },
      { ante: 50 },
      12345,
      undefined,
      undefined,
      { listedInLobby: false },
      { matchType: "career", tierId: "gold", anteId: "gold-1" }
    );

    joinRoom("career-test-invalid-token", {
      id: "player2",
      name: "Player 2",
      socketId: "socket-p2",
      ready: true,
    });

    const roomRef = getRoom("career-test-invalid-token");
    if (roomRef) {
      roomRef.players.forEach(p => p.ready = true);
    }
    startRoom("career-test-invalid-token", "host");

    // Try to reconnect with wrong token
    expect(() => {
      joinRoom("career-test-invalid-token", {
        id: "player2",
        name: "Player 2",
        socketId: "socket-p2-reconnect",
      }, {
        joinSessionToken: "invalid-token-xyz",
      });
    }).toThrow("invalid_session_token");
  });

  it("should prevent joining if room is full", () => {
    // Create small career room (max 2 players)
    const room = createRoomWithCreator(
      "career-test-full",
      { id: "host", name: "Host", socketId: "socket-host" },
      { ante: 50, maxPlayers: 2 },
      12345,
      undefined,
      undefined,
      { listedInLobby: false },
      { matchType: "career", tierId: "platinum", anteId: "plat-1" }
    );

    expect(room.players).toHaveLength(1);

    // Second player joins
    joinRoom("career-test-full", {
      id: "player2",
      name: "Player 2",
      socketId: "socket-p2",
    });

    const roomRef = getRoom("career-test-full");
    expect(roomRef?.players).toHaveLength(2);

    // Third player tries to join (should fail - room full)
    expect(() => {
      joinRoom("career-test-full", {
        id: "player3",
        name: "Player 3",
        socketId: "socket-p3",
      });
    }).toThrow("room_full");
  });

  it("should preserve career metadata after join operations", () => {
    const metadata: CareerMetadata = {
      matchType: "career",
      tierId: "diamond",
      anteId: "dia-2",
      careerRoomId: "career-lobby-abc",
    };

    createRoomWithCreator(
      "career-test-metadata",
      { id: "host", name: "Host", socketId: "socket-host" },
      { ante: 250 },
      12345,
      undefined,
      undefined,
      { listedInLobby: false },
      metadata
    );

    // Join as second player
    joinRoom("career-test-metadata", {
      id: "player2",
      name: "Player 2",
      socketId: "socket-p2",
    });

    // Verify metadata preserved
    const room = getRoom("career-test-metadata");
    expect(room?.metadata).toEqual(metadata);
    expect(room?.metadata?.matchType).toBe("career");
    expect(room?.metadata?.tierId).toBe("diamond");
  });
});
