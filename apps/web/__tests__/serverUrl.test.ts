import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { formatConnectionError, resolveServerUrl } from "../lib/serverUrl";

describe("resolveServerUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.stubGlobal("window", undefined);
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_SERVER_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("defaults to localhost in non-browser dev", () => {
    process.env.NODE_ENV = "development";
    expect(resolveServerUrl().url).toBe("http://localhost:4000");
    expect(resolveServerUrl().issue).toBeNull();
  });

  it("uses NEXT_PUBLIC_SERVER_URL when set", () => {
    process.env.NEXT_PUBLIC_SERVER_URL = "https://api.example.com/";
    expect(resolveServerUrl().url).toBe("https://api.example.com");
    expect(resolveServerUrl().issue).toBeNull();
  });

  it("flags missing env on production HTTPS pages", () => {
    vi.stubGlobal("window", {
      location: { hostname: "kouppi-web.vercel.app", protocol: "https:", origin: "https://kouppi-web.vercel.app" },
    });
    const resolved = resolveServerUrl();
    expect(resolved.issue).toBe("frontend_origin_fallback");
    expect(resolved.diagnostic).toContain("NEXT_PUBLIC_SERVER_URL");
  });

  it("formats connect errors with diagnostics", () => {
    process.env.NEXT_PUBLIC_SERVER_URL = "not-a-url";
    const msg = formatConnectionError("websocket error");
    expect(msg).toContain("NEXT_PUBLIC_SERVER_URL");
    expect(msg).toContain("websocket error");
  });
});
