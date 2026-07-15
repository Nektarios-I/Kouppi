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

    const stats = getCasualStatsForUser(req.user.userId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error("[Casual] Failed to load stats:", error);
    res.status(500).json({ success: false, error: "Failed to load casual stats" });
  }
});

export default router;
