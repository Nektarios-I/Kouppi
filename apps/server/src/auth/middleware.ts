/**
 * Authentication Middleware
 * 
 * Express middleware for protecting routes and extracting user info
 */

import { Request, Response, NextFunction } from "express";
import { verifyToken, extractBearerToken, JWTPayload } from "./jwt.js";
import { getUserById, UserProfile, getProfileById } from "@kouppi/database";

/**
 * Extended Request type with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  userProfile?: UserProfile;
}

/**
 * Middleware that requires authentication
 * Rejects requests without valid token
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req.headers.authorization);
  
  if (!token) {
    res.status(401).json({ error: "Authentication required", code: "no_token" });
    return;
  }
  
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token", code: "invalid_token" });
    return;
  }
  
  req.user = payload;
  next();
}

/**
 * Middleware that optionally extracts user info
 * Does not reject unauthenticated requests
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req.headers.authorization);
  
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  
  next();
}

/**
 * Middleware that loads full user profile
 * Must be used after requireAuth
 */
export async function loadUserProfile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", code: "no_user" });
    return;
  }
  
  const profile = getProfileById(req.user.userId);
  if (!profile) {
    res.status(404).json({ error: "User not found", code: "user_not_found" });
    return;
  }
  
  req.userProfile = profile;
  next();
}
