import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  AUTH_NETWORK_USER_MESSAGE,
  formatAuthNetworkError,
  formatConnectionError,
  mapAuthHttpError,
  resolveAuthApiBase,
  resolveServerUrl,
} from "../lib/serverUrl";

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

  it("uses NEXT_PUBLIC_SERVER_URL when set and strips trailing slash", () => {
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

  it("flags malformed NEXT_PUBLIC_SERVER_URL", () => {
    process.env.NEXT_PUBLIC_SERVER_URL = "not-a-url";
    const resolved = resolveServerUrl();
    expect(resolved.issue).toBe("invalid_url");
  });

  it("formats connect errors with diagnostics", () => {
    process.env.NEXT_PUBLIC_SERVER_URL = "not-a-url";
    const msg = formatConnectionError("websocket error");
    expect(msg).toContain("NEXT_PUBLIC_SERVER_URL");
    expect(msg).toContain("websocket error");
  });
});

describe("resolveAuthApiBase (AUTH-NET-001)", () => {
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

  it("accepts valid production game-server URL", () => {
    process.env.NEXT_PUBLIC_SERVER_URL = "https://kouppi-server.onrender.com";
    vi.stubGlobal("window", {
      location: {
        hostname: "kouppi-web-nektarios-is-projects.vercel.app",
        protocol: "https:",
        origin: "https://kouppi-web-nektarios-is-projects.vercel.app",
      },
    });
    const result = resolveAuthApiBase();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe("https://kouppi-server.onrender.com");
    }
  });

  it("accepts localhost development URL convention", () => {
    process.env.NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_SERVER_URL;
    const result = resolveAuthApiBase();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe("http://localhost:4000");
    }
  });

  it("refuses missing production URL instead of using Vercel frontend origin", () => {
    delete process.env.NEXT_PUBLIC_SERVER_URL;
    vi.stubGlobal("window", {
      location: {
        hostname: "kouppi-web-nektarios-is-projects.vercel.app",
        protocol: "https:",
        origin: "https://kouppi-web-nektarios-is-projects.vercel.app",
      },
    });
    const result = resolveAuthApiBase();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.userMessage).toBe(AUTH_NETWORK_USER_MESSAGE);
      expect(result.diagnostic).toContain("NEXT_PUBLIC_SERVER_URL");
      expect(result.issue).toBe("frontend_origin_fallback");
    }
  });

  it("refuses localhost NEXT_PUBLIC_SERVER_URL in production", () => {
    process.env.NEXT_PUBLIC_SERVER_URL = "http://localhost:4000";
    vi.stubGlobal("window", {
      location: {
        hostname: "kouppi-web.vercel.app",
        protocol: "https:",
        origin: "https://kouppi-web.vercel.app",
      },
    });
    const result = resolveAuthApiBase();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issue).toBe("localhost_in_production");
    }
  });

  it("refuses malformed URL for auth", () => {
    process.env.NEXT_PUBLIC_SERVER_URL = ":::bad";
    const result = resolveAuthApiBase();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issue).toBe("invalid_url");
    }
  });
});

describe("formatAuthNetworkError / mapAuthHttpError", () => {
  it("uses actionable user message", () => {
    expect(formatAuthNetworkError()).toBe(AUTH_NETWORK_USER_MESSAGE);
    expect(formatAuthNetworkError("Connection or CORS failure")).toContain(AUTH_NETWORK_USER_MESSAGE);
    expect(formatAuthNetworkError("Connection or CORS failure")).toContain("CORS");
  });

  it("maps HTTP validation and duplicate errors without treating them as network failures", () => {
    expect(mapAuthHttpError(409, { error: "Username already taken", code: "username_taken" }, "fail")).toBe(
      "Username already taken"
    );
    expect(mapAuthHttpError(400, { error: "Invalid input", code: "validation_error" }, "fail")).toBe("Invalid input");
    expect(mapAuthHttpError(401, { error: "Invalid username or password" }, "fail")).toBe(
      "Invalid username or password"
    );
  });
});
