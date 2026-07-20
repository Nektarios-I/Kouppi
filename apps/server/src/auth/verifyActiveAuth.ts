/**
 * Combined JWT + DB session validation for HTTP and Socket.IO auth.
 */

import { validateSession } from "@kouppi/database";
import { verifyToken, type JWTPayload } from "./jwt.js";

/** Verify JWT signature/claims and that the bound session is still active. */
export function verifyActiveAuthToken(token: string): JWTPayload | null {
  const payload = verifyToken(token);
  if (!payload) return null;
  const sessionUserId = validateSession(payload.sid);
  if (!sessionUserId || sessionUserId !== payload.userId) return null;
  return payload;
}
