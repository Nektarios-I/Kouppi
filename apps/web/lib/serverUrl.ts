/**
 * Resolve the public game-server origin (REST + Socket.IO) for browser clients.
 * NEXT_PUBLIC_SERVER_URL must be set at build time for production deployments.
 */

const LOCAL_DEV_SERVER = "http://localhost:4000";

export type ServerUrlIssue =
  | "missing_env_production"
  | "localhost_in_production"
  | "invalid_url"
  | "frontend_origin_fallback";

export interface ResolvedServerUrl {
  url: string;
  issue: ServerUrlIssue | null;
  diagnostic: string | null;
}

/** Outcome of resolving a base URL safe for Career auth HTTP calls. */
export type AuthApiBaseResult =
  | { ok: true; url: string }
  | {
      ok: false;
      /** Safe message suitable for the Career UI */
      userMessage: string;
      /** Developer-oriented reason (no secrets); safe to console.warn */
      diagnostic: string;
      issue: ServerUrlIssue | "unreachable_config";
    };

export const AUTH_NETWORK_USER_MESSAGE =
  "Unable to reach the KOUPPI game server. Please try again shortly.";

function isBrowserProduction(): boolean {
  if (typeof window === "undefined") return process.env.NODE_ENV === "production";
  const { hostname, protocol } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  return protocol === "https:" || !hostname.endsWith(".local");
}

function normalizeOrigin(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.origin;
  } catch {
    return null;
  }
}

/** Dev-only helper when web runs on :3000 and server on :4000. */
function devOriginPortFallback(): string | null {
  if (typeof window === "undefined") return null;
  const { origin } = window.location;
  if (!origin.includes(":3000")) return null;
  return origin.replace(":3000", ":4000");
}

export function resolveServerUrl(): ResolvedServerUrl {
  const fromEnv = process.env.NEXT_PUBLIC_SERVER_URL?.trim();
  if (fromEnv) {
    const normalized = normalizeOrigin(fromEnv);
    if (!normalized) {
      return {
        url: LOCAL_DEV_SERVER,
        issue: "invalid_url",
        diagnostic:
          "NEXT_PUBLIC_SERVER_URL is set but is not a valid http(s) origin (example: https://kouppi-api.example.com).",
      };
    }
    if (isBrowserProduction() && /localhost|127\.0\.0\.1/i.test(normalized)) {
      return {
        url: normalized,
        issue: "localhost_in_production",
        diagnostic:
          "NEXT_PUBLIC_SERVER_URL points at localhost in production. Deploy apps/server and set a public HTTPS URL.",
      };
    }
    return { url: normalized, issue: null, diagnostic: null };
  }

  const devFallback = devOriginPortFallback();
  if (devFallback) {
    return { url: devFallback, issue: null, diagnostic: null };
  }

  if (isBrowserProduction()) {
    const originFallback =
      typeof window !== "undefined" ? normalizeOrigin(window.location.origin) : null;
    if (originFallback) {
      return {
        url: originFallback,
        issue: "frontend_origin_fallback",
        diagnostic:
          "NEXT_PUBLIC_SERVER_URL is not set. The frontend cannot reach a Socket.IO server on the Vercel site. Deploy apps/server and set NEXT_PUBLIC_SERVER_URL to its HTTPS origin.",
      };
    }
    return {
      url: LOCAL_DEV_SERVER,
      issue: "missing_env_production",
      diagnostic:
        "NEXT_PUBLIC_SERVER_URL is not set in production. Deploy apps/server and configure NEXT_PUBLIC_SERVER_URL on Vercel.",
    };
  }

  return { url: LOCAL_DEV_SERVER, issue: null, diagnostic: null };
}

export function getServerUrl(): string {
  return resolveServerUrl().url;
}

/**
 * Resolve a game-server origin that is safe to use for Career register/login.
 * Unlike getServerUrl(), this refuses production fallbacks that would silently
 * target the Vercel frontend or localhost.
 */
export function resolveAuthApiBase(): AuthApiBaseResult {
  const resolved = resolveServerUrl();

  if (resolved.issue === "invalid_url") {
    return {
      ok: false,
      userMessage: AUTH_NETWORK_USER_MESSAGE,
      diagnostic: resolved.diagnostic ?? "Invalid NEXT_PUBLIC_SERVER_URL.",
      issue: "invalid_url",
    };
  }

  if (resolved.issue === "localhost_in_production") {
    return {
      ok: false,
      userMessage: AUTH_NETWORK_USER_MESSAGE,
      diagnostic: resolved.diagnostic ?? "NEXT_PUBLIC_SERVER_URL points at localhost in production.",
      issue: "localhost_in_production",
    };
  }

  if (resolved.issue === "frontend_origin_fallback" || resolved.issue === "missing_env_production") {
    return {
      ok: false,
      userMessage: AUTH_NETWORK_USER_MESSAGE,
      diagnostic:
        resolved.diagnostic ??
        "NEXT_PUBLIC_SERVER_URL is missing in production; Career auth will not use the frontend origin.",
      issue: resolved.issue,
    };
  }

  if (!resolved.url || !normalizeOrigin(resolved.url)) {
    return {
      ok: false,
      userMessage: AUTH_NETWORK_USER_MESSAGE,
      diagnostic: "Resolved game server URL is empty or malformed.",
      issue: "unreachable_config",
    };
  }

  return { ok: true, url: resolved.url };
}

/**
 * User-facing auth network failure message + optional safe diagnostic suffix.
 * Never includes secrets, stack traces, or CORS header dumps.
 */
export function formatAuthNetworkError(diagnostic?: string | null): string {
  if (diagnostic && diagnostic.trim()) {
    // Keep diagnostic short and non-sensitive for the UI.
    const short = diagnostic.trim();
    const safe =
      short.length > 160 ? `${short.slice(0, 157)}…` : short;
    return `${AUTH_NETWORK_USER_MESSAGE} (${safe})`;
  }
  return AUTH_NETWORK_USER_MESSAGE;
}

export function formatConnectionError(message: string | undefined, resolved?: ResolvedServerUrl): string {
  const info = resolved ?? resolveServerUrl();
  if (info.diagnostic) {
    const short = message && message !== "Unknown" ? message : "websocket error";
    return `${info.diagnostic} (Socket.IO: ${short})`;
  }
  return `Connection failed: ${message || "Unknown"}`;
}

/**
 * Parse an auth API JSON body safely. Returns null when the body is not JSON.
 */
export async function readAuthJsonResponse(response: Response): Promise<{
  ok: boolean;
  status: number;
  data: any | null;
  parseError: boolean;
}> {
  const status = response.status;
  try {
    const data = await response.json();
    return { ok: response.ok, status, data, parseError: false };
  } catch {
    return { ok: response.ok, status, data: null, parseError: true };
  }
}

/** Map known auth HTTP failures to a clear UI message (non-network). */
export function mapAuthHttpError(
  status: number,
  data: { error?: string; code?: string } | null,
  fallback: string
): string {
  if (data?.error && typeof data.error === "string") {
    return data.error;
  }
  if (status === 409) return "Username already taken";
  if (status === 401) return "Invalid username or password";
  if (status === 400) return "Invalid input";
  if (status >= 500) return fallback;
  return fallback;
}
