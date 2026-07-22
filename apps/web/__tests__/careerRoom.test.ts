import { describe, expect, it } from "vitest";
import { isCareerGameRoomId, postRoomExitPath } from "@/lib/careerRoom";

describe("careerRoom helpers", () => {
  it("detects career game room ids", () => {
    expect(isCareerGameRoomId("career-game-abc123")).toBe(true);
    expect(isCareerGameRoomId("ABCD")).toBe(false);
    expect(isCareerGameRoomId(null)).toBe(false);
  });

  it("routes leave/exit to Career for career games", () => {
    expect(postRoomExitPath("career-game-xyz")).toBe("/career");
    expect(postRoomExitPath("LOBBY1")).toBe("/lobby");
  });
});
