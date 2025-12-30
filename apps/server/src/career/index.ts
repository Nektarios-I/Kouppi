/**
 * Career Mode Module Exports
 */

// Tier configuration
export * from "./tiers.js";

// Room management
export * from "./careerRoomManager.js";

// Socket handlers
export { registerCareerHandlers } from "./careerSocketHandlers.js";

// Legacy queue (may be deprecated)
export * from "./queue.js";

// HTTP routes
export { default as profileRoutes, leaderboardRouter, matchesRouter } from "./profileRoutes.js";
