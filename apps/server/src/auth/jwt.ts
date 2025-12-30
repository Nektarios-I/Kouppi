/**
 * JWT Authentication Utilities
 * 
 * Provides JWT token generation and validation for Career Mode
 */

import jwt from "jsonwebtoken";

// Get secret from environment or use a default (for development only!)
const JWT_SECRET = process.env.JWT_SECRET || "kouppi-dev-secret-change-in-production";
const JWT_EXPIRES_IN = "7d"; // Token expires in 7 days

/**
 * JWT Payload structure
 */
export interface JWTPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(userId: string, username: string): string {
  const payload: JWTPayload = {
    userId,
    username,
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token
 * Returns the payload if valid, null if invalid or expired
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return payload;
  } catch (error) {
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
