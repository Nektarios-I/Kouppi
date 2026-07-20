/**
 * Authentication HTTP Routes
 * 
 * Provides REST API endpoints for:
 * - POST /api/auth/register - Create new account
 * - POST /api/auth/login - Login and get token
 * - POST /api/auth/logout - Invalidate token
 * - GET /api/auth/me - Get current user
 */

import { Router } from "express";
import { z } from "zod";
import { 
  createUser, 
  validateCredentials, 
  getProfileById,
  createSession,
  deleteSession,
  validateSession,
} from "@kouppi/database";
import { generateToken } from "./jwt.js";
import { requireAuth, AuthenticatedRequest } from "./middleware.js";

const router = Router();

// Request validation schemas
const RegisterSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(100),
  avatar: z.object({
    emoji: z.string().optional(),
    color: z.string().optional(),
    border: z.string().optional(),
  }).optional(),
});

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/**
 * POST /api/auth/register
 * Create a new user account
 */
router.post("/register", async (req, res) => {
  try {
    const data = RegisterSchema.parse(req.body);
    
    const profile = await createUser(data.username, data.password, data.avatar);
    const session = createSession(profile.id);
    const token = generateToken(profile.id, profile.username, session.token);
    
    res.status(201).json({
      success: true,
      token,
      user: profile,
    });
  } catch (error: any) {
    // Handle validation errors
    if (error.name === "ZodError") {
      res.status(400).json({
        success: false,
        error: "Invalid input",
        details: error.errors,
        code: "validation_error",
      });
      return;
    }
    
    // Handle known errors
    if (error.message === "Username already taken") {
      res.status(409).json({
        success: false,
        error: error.message,
        code: "username_taken",
      });
      return;
    }
    
    if (error.message.includes("must be")) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: "validation_error",
      });
      return;
    }
    
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "auth_register_failed",
        code: "server_error",
        errorName: error?.name ?? "Error",
        errorMessage: typeof error?.message === "string" ? error.message : "unknown",
      })
    );
    res.status(500).json({
      success: false,
      error: "Failed to create account",
      code: "server_error",
    });
  }
});

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post("/login", async (req, res) => {
  try {
    const data = LoginSchema.parse(req.body);
    
    const user = await validateCredentials(data.username, data.password);
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: "Invalid username or password",
        code: "invalid_credentials",
      });
      return;
    }
    
    const token = generateToken(user.id, user.username, createSession(user.id).token);
    const profile = getProfileById(user.id);
    
    res.json({
      success: true,
      token,
      user: profile,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({
        success: false,
        error: "Invalid input",
        code: "validation_error",
      });
      return;
    }
    
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "auth_login_failed",
        code: "server_error",
        errorName: error?.name ?? "Error",
        errorMessage: typeof error?.message === "string" ? error.message : "unknown",
      })
    );
    res.status(500).json({
      success: false,
      error: "Login failed",
      code: "server_error",
    });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate the current session
 */
router.post("/logout", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.sid) {
      deleteSession(req.user.sid);
    }

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("[Auth] Logout error:", error);
    res.status(500).json({
      success: false,
      error: "Logout failed",
      code: "server_error",
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Not authenticated",
        code: "not_authenticated",
      });
      return;
    }
    
    const profile = getProfileById(req.user.userId);
    
    if (!profile) {
      res.status(404).json({
        success: false,
        error: "User not found",
        code: "user_not_found",
      });
      return;
    }
    
    res.json({
      success: true,
      user: profile,
    });
  } catch (error) {
    console.error("[Auth] Get user error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get user",
      code: "server_error",
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh the JWT token (extends expiration)
 */
router.post("/refresh", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Not authenticated",
        code: "not_authenticated",
      });
      return;
    }
    
    const profile = getProfileById(req.user.userId);
    
    if (!profile) {
      res.status(404).json({
        success: false,
        error: "User not found",
        code: "user_not_found",
      });
      return;
    }
    
    // Rotate session: revoke old, issue new bound JWT
    if (req.user.sid) {
      deleteSession(req.user.sid);
    }
    const session = createSession(req.user.userId);
    const token = generateToken(req.user.userId, req.user.username, session.token);
    
    res.json({
      success: true,
      token,
      user: profile,
    });
  } catch (error) {
    console.error("[Auth] Refresh error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to refresh token",
      code: "server_error",
    });
  }
});

export default router;
