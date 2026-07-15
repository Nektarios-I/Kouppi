import { randomBytes } from "node:crypto";

/** Opaque per-seat secret issued on join; required to reclaim a seat during reconnect grace. */
export function generateJoinSessionToken(): string {
  return randomBytes(24).toString("base64url");
}

export function isValidJoinSessionToken(token: string | undefined): token is string {
  return typeof token === "string" && token.length >= 16 && token.length <= 64;
}
