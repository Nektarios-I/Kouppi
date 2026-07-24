/**
 * Reward HTTP routes — /api/rewards/*
 */

import { Router } from "express";
import { z } from "zod";
import {
  claimDaily,
  claimMission,
  claimTrack,
  getRewardPublicState,
  rerollMission,
  spinRewardWheel,
  equipRewardCosmetic,
  RewardActionError,
} from "@kouppi/database";
import { requireAuth, type AuthenticatedRequest } from "../auth/middleware.js";

const router = Router();

function sendRewardError(res: import("express").Response, error: unknown) {
  if (error instanceof RewardActionError) {
    res.status(409).json({ success: false, error: error.message, code: error.code });
    return;
  }
  console.error("[Rewards]", error);
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : "Reward operation failed",
  });
}

router.get("/state", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const state = getRewardPublicState(req.user.userId);
    res.json({ success: true, state });
  } catch (error) {
    sendRewardError(res, error);
  }
});

router.post("/daily/claim", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const result = claimDaily(req.user.userId);
    res.json({
      success: true,
      streak: result.streak,
      dayIndex: result.dayIndex,
      grant: result.grant.grant,
      state: result.state,
    });
  } catch (error) {
    sendRewardError(res, error);
  }
});

const SlotParams = z.object({ slotId: z.string().uuid() });

router.post("/missions/:slotId/claim", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const parsed = SlotParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid slot id" });
      return;
    }
    const result = claimMission(req.user.userId, parsed.data.slotId);
    res.json({ success: true, grant: result.grant.grant, state: result.state });
  } catch (error) {
    sendRewardError(res, error);
  }
});

router.post("/missions/:slotId/reroll", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const parsed = SlotParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid slot id" });
      return;
    }
    const result = rerollMission(req.user.userId, parsed.data.slotId);
    res.json({ success: true, state: result.state });
  } catch (error) {
    sendRewardError(res, error);
  }
});

const LevelParams = z.object({ level: z.coerce.number().int().positive() });

router.post("/track/:level/claim", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const parsed = LevelParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid level" });
      return;
    }
    const result = claimTrack(req.user.userId, parsed.data.level);
    res.json({ success: true, grant: result.grant.grant, state: result.state });
  } catch (error) {
    sendRewardError(res, error);
  }
});

router.post("/wheel/spin", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const result = spinRewardWheel(req.user.userId);
    res.json({
      success: true,
      spinId: result.spinId,
      rewardId: result.rewardId,
      label: result.label,
      grant: result.grant.grant,
      tokensRemaining: result.tokensRemaining,
      state: result.state,
    });
  } catch (error) {
    sendRewardError(res, error);
  }
});

const EquipBody = z.object({
  slot: z.enum(["title", "badge", "frame", "card_back", "table_theme", "seat_ring", "chip_skin"]),
  cosmeticId: z.string().nullable(),
});

router.post("/cosmetics/equip", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const parsed = EquipBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid equip payload" });
      return;
    }
    const result = equipRewardCosmetic(req.user.userId, parsed.data.slot, parsed.data.cosmeticId);
    res.json({ success: true, equipped: result.equipped, state: result.state });
  } catch (error) {
    sendRewardError(res, error);
  }
});

export default router;
