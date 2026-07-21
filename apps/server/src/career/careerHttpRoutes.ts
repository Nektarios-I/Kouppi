/**
 * Career HTTP helpers — tiers catalog for lobby UI (works even if socket ack is flaky).
 */

import { Router } from "express";
import { getUserById } from "@kouppi/database";
import { requireAuth, AuthenticatedRequest } from "../auth/middleware.js";
import { CAREER_TIERS } from "./tiers.js";

const careerRouter = Router();

/**
 * GET /api/career/tiers
 * Authenticated tiers + affordability for the Career lobby.
 */
careerRouter.get("/tiers", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated", code: "auth_failed" });
      return;
    }

    const user = getUserById(req.user.userId);
    if (!user) {
      res.status(401).json({ success: false, error: "User not found", code: "auth_failed" });
      return;
    }

    const tiers = CAREER_TIERS.map((tier) => ({
      ...tier,
      accessible: user.rating >= tier.minRating,
      antes: tier.antes.map((ante) => ({
        ...ante,
        canAfford: user.bankroll >= ante.buyIn,
      })),
    }));

    res.json({
      success: true,
      tiers,
      playerRating: user.rating,
      playerBankroll: user.bankroll,
    });
  } catch (error) {
    console.error("[Career] Error getting tiers:", error);
    res.status(500).json({ success: false, error: "Failed to get tiers" });
  }
});

export default careerRouter;
