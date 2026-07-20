/**
 * JWT Authentication Utilities
 *
 * Provides JWT token generation and validation for Career Mode.
 * Tokens carry a session id (`sid`) that must exist in the `sessions` table.
 */

import jwt from "jsonwebtoken";

const JWT_EXPIRES_IN = "7d";

function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is required in production. Set a long random secret in the server environment."
    );
  }

  // Development / test only
  return "kouppi-dev-secret-change-in-production";
}

/**
 * JWT Payload structure
 */
export interface JWTPayload {
  userId: string;
  username: string;
  /** Database session token — required for authz + logout revocation */
  sid: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for a user bound to a DB session id.
 */
export function generateToken(userId: string, username: string, sessionId: string): string {
  if (!sessionId) {
    throw new Error("sessionId is required to generate a token");
  }
  const payload: JWTPayload = {
    userId,
    username,
    sid: sessionId,
  };

  return jwt.sign(payload, resolveJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token
 * Returns the payload if valid, null if invalid or expired
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, resolveJwtSecret()) as JWTPayload;
    if (!payload?.userId || !payload?.username || !payload?.sid) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * Expects format: "Bearer <token>"
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  return parts[1];
}

/**
 * Decode a token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}
