/**
 * Parse CORS_ORIGIN for Express and Socket.IO.
 * Supports a single origin, comma-separated origins, or "*" (development only).
 */

export function parseCorsOrigins(
  raw: string | undefined,
  nodeEnv: string = process.env.NODE_ENV || "development"
): string | string[] {
  const trimmed = raw?.trim();

  if (!trimmed) {
    if (nodeEnv === "production") {
      console.warn(
        "[CORS] CORS_ORIGIN is not set in production. Set it to your Vercel URL (e.g. https://kouppi-web-nektarios-is-projects.vercel.app)."
      );
      return [];
    }
    return "*";
  }

  if (trimmed === "*") {
    if (nodeEnv === "production") {
      console.warn("[CORS] CORS_ORIGIN=* is not recommended in production for authenticated traffic.");
    }
    return "*";
  }

  const origins = trimmed
    .split(",")
    .map((part) => part.trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (origins.length === 0) return nodeEnv === "production" ? [] : "*";
  // Always return an array so callers can use a reflecting origin callback.
  return origins;
}

/**
 * cors / Socket.IO `origin` option that reflects the request Origin only when allow-listed.
 * Avoids the single-string cors pitfall of emitting a fixed ACAO that does not match the browser.
 */
export function createCorsOriginOption(
  allowed: string | string[]
):
  | boolean
  | string
  | string[]
  | ((origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void) {
  if (allowed === "*") return true;
  const list = (Array.isArray(allowed) ? allowed : [allowed]).filter(Boolean);
  if (list.length === 0) {
    return (_origin, cb) => cb(null, false);
  }
  return (requestOrigin, cb) => {
    if (!requestOrigin) {
      cb(null, true);
      return;
    }
    cb(null, list.includes(requestOrigin));
  };
}
