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

export function formatConnectionError(message: string | undefined, resolved?: ResolvedServerUrl): string {
  const info = resolved ?? resolveServerUrl();
  if (info.diagnostic) {
    const short = message && message !== "Unknown" ? message : "websocket error";
    return `${info.diagnostic} (Socket.IO: ${short})`;
  }
  return `Connection failed: ${message || "Unknown"}`;
}
