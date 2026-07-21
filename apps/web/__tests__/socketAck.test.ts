import { describe, it, expect } from "vitest";
import { isAuthFailureCode, parseSocketAck } from "../lib/socketAck";

describe("parseSocketAck", () => {
  it("handles Node-style success (null, data)", () => {
    const parsed = parseSocketAck<{ tiers: string[] }>(null, { tiers: ["bronze"] });
    expect(parsed).toEqual({ ok: true, data: { tiers: ["bronze"] } });
  });

  it("handles empty single-arg response", () => {
    const parsed = parseSocketAck(null);
    expect(parsed.ok).toBe(false);
  });

  it("handles Node-style error object as first arg", () => {
    const parsed = parseSocketAck({ code: "auth_failed", message: "Invalid token" });
    expect(parsed).toEqual({
      ok: false,
      error: "Invalid token",
      code: "auth_failed",
    });
  });

  it("handles single-arg success payload", () => {
    const parsed = parseSocketAck<{ rating: number }>({ rating: 1000, bankroll: 500 });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.rating).toBe(1000);
  });

  it("does not treat tier payloads as errors", () => {
    const parsed = parseSocketAck({
      code: "unused",
      message: "hi",
      tiers: [{ id: "bronze" }],
    });
    expect(parsed.ok).toBe(true);
  });
});

describe("isAuthFailureCode", () => {
  it("detects auth failure codes", () => {
    expect(isAuthFailureCode("auth_failed")).toBe(true);
    expect(isAuthFailureCode("invalid_auth_token")).toBe(true);
    expect(isAuthFailureCode("other")).toBe(false);
  });
});
