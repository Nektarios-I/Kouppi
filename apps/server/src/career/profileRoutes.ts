/**
 * Profile HTTP Routes
 * 
 * Provides REST API endpoints for:
 * - GET /api/profile - Get current user's profile
 * - GET /api/profile/:id - Get any user's profile by ID
 * - GET /api/profile/username/:username - Get user's profile by username
 * - PATCH /api/profile - Update current user's settings
 * - GET /api/leaderboard - Get top players
 * - GET /api/matches - Get current user's match history
 * - GET /api/matches/:userId - Get any user's match history
 */

import { Router } from "express";
import { z } from "zod";
import { 
  getProfileById,
  getProfileByUsername,
  updateAvatar,
  getLeaderboard,
  getUserRank,
  getPlayerMatches,
  getRecentMatches,
  ARENAS,
} from "@kouppi/database";
import { requireAuth, optionalAuth, AuthenticatedRequest } from "../auth/middleware.js";

const router = Router();

// Update profile schema
const UpdateProfileSchema = z.object({
  avatar: z.object({
    emoji: z.string().optional(),
    color: z.string().optional(),
    border: z.string().optional(),
  }).optional(),
});

/**
 * GET /api/profile
 * Get current authenticated user's profile
 */
router.get("/", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    
    const profile = getProfileById(req.user.userId);
    if (!profile) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }
    
    const rank = getUserRank(req.user.userId);
    
    res.json({
      success: true,
      profile,
      rank,
    });
  } catch (error) {
    console.error("[Profile] Error getting profile:", error);
    res.status(500).json({ success: false, error: "Failed to get profile" });
  }
});

/**
 * GET /api/profile/:id
 * Get any user's profile by ID
 */
router.get("/:id", optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const profile = getProfileById(req.params.id);
    if (!profile) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }
    
    const rank = getUserRank(req.params.id);
    
    res.json({
      success: true,
      profile,
      rank,
      isOwnProfile: req.user?.userId === req.params.id,
    });
  } catch (error) {
    console.error("[Profile] Error getting profile:", error);
    res.status(500).json({ success: false, error: "Failed to get profile" });
  }
});

/**
 * GET /api/profile/username/:username
 * Get user's profile by username
 */
router.get("/username/:username", optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const profile = getProfileByUsername(req.params.username);
    if (!profile) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }
    
    const rank = getUserRank(profile.id);
    
    res.json({
      success: true,
      profile,
      rank,
      isOwnProfile: req.user?.userId === profile.id,
    });
  } catch (error) {
    console.error("[Profile] Error getting profile:", error);
    res.status(500).json({ success: false, error: "Failed to get profile" });
  }
});

/**
 * PATCH /api/profile
 * Update current user's profile settings
 */
router.patch("/", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    
    const data = UpdateProfileSchema.parse(req.body);
    
    if (data.avatar) {
      updateAvatar(req.user.userId, data.avatar);
    }
    
    const profile = getProfileById(req.user.userId);
    
    res.json({
      success: true,
      profile,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ success: false, error: "Invalid input" });
      return;
    }
    console.error("[Profile] Error updating profile:", error);
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

/**
 * GET /api/leaderboard
 * Get top players sorted by trophies
 */
router.get("/", (req, res) => {
  // This won't be reached due to route ordering, use a dedicated router below
});

export const leaderboardRouter = Router();

leaderboardRouter.get("/", (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const players = getLeaderboard(limit, offset);
    
    res.json({
      success: true,
      players,
      arenas: ARENAS,
    });
  } catch (error) {
    console.error("[Leaderboard] Error:", error);
    res.status(500).json({ success: false, error: "Failed to get leaderboard" });
  }
});

/**
 * Matches router
 */
export const matchesRouter = Router();

// GET /api/matches - Get current user's match history
matchesRouter.get("/", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const matches = getPlayerMatches(req.user.userId, limit, offset);
    
    res.json({
      success: true,
      matches,
    });
  } catch (error) {
    console.error("[Matches] Error:", error);
    res.status(500).json({ success: false, error: "Failed to get matches" });
  }
});

// GET /api/matches/recent - Get recent global matches
matchesRouter.get("/recent", (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const matches = getRecentMatches(limit);
    
    res.json({
      success: true,
      matches,
    });
  } catch (error) {
    console.error("[Matches] Error:", error);
    res.status(500).json({ success: false, error: "Failed to get matches" });
  }
});

// GET /api/matches/:userId - Get any user's match history
matchesRouter.get("/:userId", optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const matches = getPlayerMatches(req.params.userId, limit, offset);
    
    res.json({
      success: true,
      matches,
      isOwnMatches: req.user?.userId === req.params.userId,
    });
  } catch (error) {
    console.error("[Matches] Error:", error);
    res.status(500).json({ success: false, error: "Failed to get matches" });
  }
});

export default router;
