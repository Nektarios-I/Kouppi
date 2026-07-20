/** Shared helper: issue JWT bound to a DB session for tests. */
import { createSession } from "@kouppi/database";
import { generateToken } from "../../src/auth/jwt.js";

export function issueTestAuthToken(userId: string, username: string): string {
  const session = createSession(userId);
  return generateToken(userId, username, session.token);
}
