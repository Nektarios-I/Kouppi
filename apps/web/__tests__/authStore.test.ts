/**
 * AUTH-NET-001: authStore network vs HTTP error classification.
 */
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { AUTH_NETWORK_USER_MESSAGE } from "@/lib/serverUrl";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

describe("authStore AUTH-NET-001 client errors", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.NEXT_PUBLIC_SERVER_URL = "http://localhost:4000";
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("network failure produces actionable message (not raw Failed to fetch)", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { useAuthStore } = await import("@/store/authStore");
    useAuthStore.setState({ token: null, user: null, error: null, isLoading: false });

    const ok = await useAuthStore.getState().register("player_one", "password123");
    expect(ok).toBe(false);
    const error = useAuthStore.getState().error;
    expect(error).toContain(AUTH_NETWORK_USER_MESSAGE);
    expect(error).not.toBe("Failed to fetch");
  });

  it("HTTP 400 validation error remains distinguishable from network failure", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: "Invalid input", code: "validation_error" }),
    });
    const { useAuthStore } = await import("@/store/authStore");
    useAuthStore.setState({ token: null, user: null, error: null, isLoading: false });

    const ok = await useAuthStore.getState().register("ab", "12");
    expect(ok).toBe(false);
    expect(useAuthStore.getState().error).toBe("Invalid input");
    expect(useAuthStore.getState().error).not.toContain(AUTH_NETWORK_USER_MESSAGE);
  });

  it("HTTP 409 duplicate username remains distinguishable", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ success: false, error: "Username already taken", code: "username_taken" }),
    });
    const { useAuthStore } = await import("@/store/authStore");
    useAuthStore.setState({ token: null, user: null, error: null, isLoading: false });

    const ok = await useAuthStore.getState().register("taken_user", "password123");
    expect(ok).toBe(false);
    expect(useAuthStore.getState().error).toBe("Username already taken");
  });

  it("non-JSON server failure is handled safely", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    const { useAuthStore } = await import("@/store/authStore");
    useAuthStore.setState({ token: null, user: null, error: null, isLoading: false });

    const ok = await useAuthStore.getState().login("player_one", "password123");
    expect(ok).toBe(false);
    expect(useAuthStore.getState().error).toContain(AUTH_NETWORK_USER_MESSAGE);
    expect(useAuthStore.getState().error).toContain("unexpected response");
  });

  it("refuses production auth when NEXT_PUBLIC_SERVER_URL is missing (no Vercel fallback fetch)", async () => {
    delete process.env.NEXT_PUBLIC_SERVER_URL;
    vi.stubGlobal("window", {
      location: {
        hostname: "kouppi-web.vercel.app",
        protocol: "https:",
        origin: "https://kouppi-web.vercel.app",
      },
    });
    vi.resetModules();
    const { useAuthStore } = await import("@/store/authStore");
    useAuthStore.setState({ token: null, user: null, error: null, isLoading: false });

    const ok = await useAuthStore.getState().register("player_one", "password123");
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().error).toContain(AUTH_NETWORK_USER_MESSAGE);
  });
});
