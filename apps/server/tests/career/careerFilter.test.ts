/**
 * Career Room Filtering Tests
 * 
 * Sprint 1 - REQ-2: Career Room Metadata
 * Verifies that career games don't appear in casual lobby listings
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createRoomWithCreator,
  roomsInfo,
  getRoom,
  resetAllRoomsForTests,
} from "../../src/rooms.js";
import type { CareerMetadata } from "../../src/types.js";

describe("Career Room Filtering", () => {
  beforeEach(() => {
    resetAllRoomsForTests();
  });

  afterEach(() => {
    resetAllRoomsForTests();
  });

  it("should not list career games in roomsInfo()", () => {
    // Create a career room with metadata
    const careerRoom = createRoomWithCreator(
      "career-test-1",
      {
        id: "player1",
        name: "Career Player",
        socketId: "socket1",
      },
      { ante: 50 },
      12345,
      undefined, // no password
      undefined, // no custom code
      { listedInLobby: false },
      { matchType: "career", tierId: "gold", anteId: "gold-2" }
    );

    expect(careerRoom).toBeTruthy();
    expect(careerRoom.metadata).toBeTruthy();
    expect(careerRoom.metadata?.matchType).toBe("career");

    // Verify career room exists in store
    const storedRoom = getRoom("career-test-1");
    expect(storedRoom).toBeTruthy();
    expect(storedRoom?.metadata?.matchType).toBe("career");

    // Verify NOT in roomsInfo
    const rooms = roomsInfo();
    expect(rooms).toHaveLength(0);
    expect(rooms.find((r) => r.id === "career-test-1")).toBeUndefined();
  });

  it("should list casual games in roomsInfo()", () => {
    // Create a casual room (no career metadata)
    const casualRoom = createRoomWithCreator(
      "casual-test-1",
      {
        id: "player2",
        name: "Casual Player",
        socketId: "socket2",
      },
      { ante: 25 },
      67890,
      undefined, // no password
      undefined, // no custom code
      { listedInLobby: true }
      // NO metadata = casual game
    );

    expect(casualRoom).toBeTruthy();
    expect(casualRoom.metadata).toBeUndefined();

    // Verify in roomsInfo
    const rooms = roomsInfo();
    expect(rooms).toHaveLength(1);
    expect(rooms[0].id).toBe("casual-test-1");
    expect(rooms[0].listedInLobby).toBe(true);
  });

  it("should list multiple casual games but exclude career games", () => {
    // Create 2 casual rooms
    createRoomWithCreator(
      "casual-1",
      { id: "p1", name: "Player 1", socketId: "s1" },
      { ante: 10 },
      111
    );

    createRoomWithCreator(
      "casual-2",
      { id: "p2", name: "Player 2", socketId: "s2" },
      { ante: 25 },
      222
    );

    // Create 2 career rooms
    createRoomWithCreator(
      "career-1",
      { id: "cp1", name: "Career Player 1", socketId: "cs1" },
      { ante: 50 },
      333,
      undefined,
      undefined,
      { listedInLobby: false },
      { matchType: "career", tierId: "silver", anteId: "silver-1" }
    );

    createRoomWithCreator(
      "career-2",
      { id: "cp2", name: "Career Player 2", socketId: "cs2" },
      { ante: 100 },
      444,
      undefined,
      undefined,
      { listedInLobby: false },
      { matchType: "career", tierId: "gold", anteId: "gold-3" }
    );

    // Verify only casual rooms in listing
    const rooms = roomsInfo();
    expect(rooms).toHaveLength(2);
    
    const roomIds = rooms.map((r) => r.id);
    expect(roomIds).toContain("casual-1");
    expect(roomIds).toContain("casual-2");
    expect(roomIds).not.toContain("career-1");
    expect(roomIds).not.toContain("career-2");
  });

  it("should handle private casual rooms correctly", () => {
    // Create private casual room (with password, no career metadata)
    const privateRoom = createRoomWithCreator(
      "private-casual",
      { id: "p3", name: "Private Player", socketId: "s3" },
      { ante: 50 },
      555,
      "secret123" // password
    );

    expect(privateRoom).toBeTruthy();
    expect(privateRoom.passwordHash).toBeTruthy();
    expect(privateRoom.listedInLobby).toBe(false); // Private rooms not listed by default

    // Should NOT appear in lobby (private, but not because it's career)
    const rooms = roomsInfo();
    expect(rooms.find((r) => r.id === "private-casual")).toBeUndefined();

    // Verify room exists and is NOT career
    const storedRoom = getRoom("private-casual");
    expect(storedRoom).toBeTruthy();
    expect(storedRoom?.metadata).toBeUndefined();
  });

  it("should preserve career metadata on room retrieval", () => {
    const metadata: CareerMetadata = {
      matchType: "career",
      tierId: "platinum",
      anteId: "plat-2",
      careerRoomId: "career-lobby-xyz",
    };

    createRoomWithCreator(
      "career-with-full-metadata",
      { id: "p4", name: "Plat Player", socketId: "s4" },
      { ante: 250 },
      666,
      undefined,
      undefined,
      { listedInLobby: false, presetLabel: "Career - Platinum" },
      metadata
    );

    const room = getRoom("career-with-full-metadata");
    expect(room).toBeTruthy();
    expect(room?.metadata).toEqual(metadata);
    expect(room?.presetLabel).toBe("Career - Platinum");
    expect(room?.listedInLobby).toBe(false);
  });
});
