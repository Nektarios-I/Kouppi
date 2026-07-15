import { Router } from "express";
import { z } from "zod";
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  listFriends,
  listPendingRequests,
  searchUsersByUsername,
} from "@kouppi/database";
import { requireAuth, AuthenticatedRequest } from "../auth/middleware.js";

const router = Router();

const SendRequestBody = z.object({
  username: z.string().min(2).max(32).optional(),
  userId: z.string().uuid().optional(),
}).refine((d) => d.username || d.userId, { message: "username or userId required" });

const RequestIdBody = z.object({
  requestId: z.string().uuid(),
});

/** GET /api/friends — list friends */
router.get("/", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const friends = listFriends(req.user.userId);
    res.json({ success: true, friends });
  } catch (error) {
    console.error("[Friends] Failed to list friends:", error);
    res.status(500).json({ success: false, error: "Failed to load friends" });
  }
});

/** GET /api/friends/requests — pending incoming/outgoing */
router.get("/requests", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const requests = listPendingRequests(req.user.userId);
    res.json({ success: true, requests });
  } catch (error) {
    console.error("[Friends] Failed to list requests:", error);
    res.status(500).json({ success: false, error: "Failed to load requests" });
  }
});

/** GET /api/friends/search?q= — username prefix search */
router.get("/search", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const results = searchUsersByUsername(q, req.user.userId);
    res.json({ success: true, results });
  } catch (error) {
    console.error("[Friends] Search failed:", error);
    res.status(500).json({ success: false, error: "Search failed" });
  }
});

/** POST /api/friends/request */
router.post("/request", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const parsed = SendRequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid request", code: "bad_request" });
      return;
    }
    const result = sendFriendRequest(req.user.userId, parsed.data);
    if ("error" in result) {
      res.status(400).json({ success: false, error: result.error, code: result.error });
      return;
    }
    res.json({ success: true, request: result.request });
  } catch (error) {
    console.error("[Friends] Send request failed:", error);
    res.status(500).json({ success: false, error: "Failed to send request" });
  }
});

/** POST /api/friends/accept */
router.post("/accept", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const parsed = RequestIdBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid request", code: "bad_request" });
      return;
    }
    const result = acceptFriendRequest(parsed.data.requestId, req.user.userId);
    if ("error" in result) {
      res.status(400).json({ success: false, error: result.error, code: result.error });
      return;
    }
    res.json({ success: true, request: result.request });
  } catch (error) {
    console.error("[Friends] Accept failed:", error);
    res.status(500).json({ success: false, error: "Failed to accept request" });
  }
});

/** POST /api/friends/decline */
router.post("/decline", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const parsed = RequestIdBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid request", code: "bad_request" });
      return;
    }
    const result = declineFriendRequest(parsed.data.requestId, req.user.userId);
    if ("error" in result) {
      res.status(400).json({ success: false, error: result.error, code: result.error });
      return;
    }
    res.json({ success: true, request: result.request });
  } catch (error) {
    console.error("[Friends] Decline failed:", error);
    res.status(500).json({ success: false, error: "Failed to decline request" });
  }
});

/** POST /api/friends/cancel */
router.post("/cancel", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const parsed = RequestIdBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid request", code: "bad_request" });
      return;
    }
    const result = cancelFriendRequest(parsed.data.requestId, req.user.userId);
    if ("error" in result) {
      res.status(400).json({ success: false, error: result.error, code: result.error });
      return;
    }
    res.json({ success: true, request: result.request });
  } catch (error) {
    console.error("[Friends] Cancel failed:", error);
    res.status(500).json({ success: false, error: "Failed to cancel request" });
  }
});

/** DELETE /api/friends/:friendId */
router.delete("/:friendId", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const friendId = req.params.friendId;
    const result = removeFriend(req.user.userId, friendId);
    if ("error" in result) {
      res.status(400).json({ success: false, error: result.error, code: result.error });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error("[Friends] Remove failed:", error);
    res.status(500).json({ success: false, error: "Failed to remove friend" });
  }
});

export default router;
