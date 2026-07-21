/**
 * Normalize Socket.IO acknowledgement callbacks used across Career/Friends.
 * Servers in this repo use Node-style `(err, data)` acks; some transports only
 * deliver a single argument (either the error object or the success payload).
 */

export type AckError = { code?: string; message?: string };

export type ParsedAck<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

function isErrorShape(value: unknown): value is AckError {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.message !== "string" && typeof v.code !== "string") return false;
  // Success payloads also have fields; prefer error if code looks like auth/error
  // and there is no obvious data payload key.
  const dataKeys = ["tiers", "friends", "presence", "rating", "bankroll", "userId", "inQueue", "roomId", "rooms"];
  if (dataKeys.some((k) => k in v)) return false;
  return true;
}

export function parseSocketAck<T = unknown>(
  first: unknown,
  second?: unknown
): ParsedAck<T> {
  // Node-style: (null | err, data)
  if (second !== undefined) {
    if (first) {
      const err = first as AckError;
      return {
        ok: false,
        error: err.message || "Request failed",
        code: typeof err.code === "string" ? err.code : undefined,
      };
    }
    return { ok: true, data: second as T };
  }

  // Single-arg: either error or success payload
  if (first == null) {
    return { ok: false, error: "Empty server response" };
  }
  if (isErrorShape(first)) {
    return {
      ok: false,
      error: first.message || "Request failed",
      code: typeof first.code === "string" ? first.code : undefined,
    };
  }
  return { ok: true, data: first as T };
}

export function isAuthFailureCode(code?: string): boolean {
  return code === "auth_failed" || code === "invalid_auth_token" || code === "unauthorized";
}
