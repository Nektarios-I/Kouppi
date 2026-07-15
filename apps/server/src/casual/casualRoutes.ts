import { Router } from "express";
import { getCasualStatsForUser } from "@kouppi/database";
import { requireAuth, AuthenticatedRequest } from "../auth/middleware.js";

const router = Router();

/** GET /api/casual/stats — logged-in user's friends multiplayer history */
router.get("/stats", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 10;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 10;

    const stats = getCasualStatsForUser(req.user.userId, limit);
    res.json({ success: true, stats });
  } catch (error) {
    console.error("[Casual] Failed to load stats:", error);
    res.status(500).json({ success: false, error: "Failed to load casual stats" });
  }
});

export default router;
