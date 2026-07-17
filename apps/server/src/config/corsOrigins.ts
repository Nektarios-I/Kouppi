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
    .map((part) => part.trim())
    .filter(Boolean);

  if (origins.length === 0) return nodeEnv === "production" ? [] : "*";
  if (origins.length === 1) return origins[0];
  return origins;
}
