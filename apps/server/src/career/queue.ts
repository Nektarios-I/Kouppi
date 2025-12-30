/**
 * Matchmaking Queue System
 * 
 * Manages the career mode matchmaking queue with:
 * - Rating-based matching with expanding search
 * - Queue timeouts
 * - Match creation
 */

import { getMatchmakingRange, isMatchmakingCompatible } from "@kouppi/database";
import { v4 as uuidv4 } from "uuid";

/**
 * Queue entry for a player waiting for a match
 */
export interface QueueEntry {
  playerId: string;
  playerName: string;
  rating: number;
  trophies: number;
  socketId: string;
  queuedAt: number;
}

/**
 * Match found result
 */
export interface MatchFound {
  roomId: string;
  player1: QueueEntry;
  player2: QueueEntry;
}

// In-memory queue
const queue = new Map<string, QueueEntry>();

// Callbacks for match events
let onMatchFoundCallback: ((match: MatchFound) => void) | null = null;

/**
 * Set the callback for when a match is found
 */
export function setOnMatchFound(callback: (match: MatchFound) => void): void {
  onMatchFoundCallback = callback;
}

/**
 * Add a player to the matchmaking queue
 */
export function joinQueue(entry: QueueEntry): { success: boolean; position: number } {
  // Check if already in queue
  if (queue.has(entry.playerId)) {
    const existing = queue.get(entry.playerId)!;
    // Update socket ID if reconnecting
    existing.socketId = entry.socketId;
    return { success: true, position: getQueuePosition(entry.playerId) };
  }
  
  // Add to queue
  queue.set(entry.playerId, {
    ...entry,
    queuedAt: Date.now(),
  });
  
  // Try to find a match immediately
  tryFindMatch(entry.playerId);
  
  return { success: true, position: getQueuePosition(entry.playerId) };
}

/**
 * Remove a player from the queue
 */
export function leaveQueue(playerId: string): boolean {
  return queue.delete(playerId);
}

/**
 * Get a player's queue entry
 */
export function getQueueEntry(playerId: string): QueueEntry | undefined {
  return queue.get(playerId);
}

/**
 * Check if a player is in the queue
 */
export function isInQueue(playerId: string): boolean {
  return queue.has(playerId);
}

/**
 * Get queue position for a player
 */
export function getQueuePosition(playerId: string): number {
  let position = 1;
  for (const [id] of queue) {
    if (id === playerId) return position;
    position++;
  }
  return 0;
}

/**
 * Get queue size
 */
export function getQueueSize(): number {
  return queue.size;
}

/**
 * Get wait time for a player in seconds
 */
export function getWaitTime(playerId: string): number {
  const entry = queue.get(playerId);
  if (!entry) return 0;
  return Math.floor((Date.now() - entry.queuedAt) / 1000);
}

/**
 * Try to find a match for a player
 */
export function tryFindMatch(playerId: string): MatchFound | null {
  const player = queue.get(playerId);
  if (!player) return null;
  
  const playerWaitTime = getWaitTime(playerId);
  
  // Find best match
  let bestMatch: QueueEntry | null = null;
  let bestScore = Infinity;
  
  for (const [otherId, other] of queue) {
    if (otherId === playerId) continue;
    
    const otherWaitTime = getWaitTime(otherId);
    
    // Check if compatible based on wait time and rating
    if (isMatchmakingCompatible(player.rating, other.rating, playerWaitTime, otherWaitTime)) {
      // Score based on rating difference (lower is better)
      const score = Math.abs(player.rating - other.rating);
      if (score < bestScore) {
        bestScore = score;
        bestMatch = other;
      }
    }
  }
  
  if (bestMatch) {
    // Create match
    const match: MatchFound = {
      roomId: `career_${uuidv4().slice(0, 8)}`,
      player1: player,
      player2: bestMatch,
    };
    
    // Remove both players from queue
    queue.delete(playerId);
    queue.delete(bestMatch.playerId);
    
    // Notify via callback
    if (onMatchFoundCallback) {
      onMatchFoundCallback(match);
    }
    
    return match;
  }
  
  return null;
}

/**
 * Run matchmaking for all players in queue
 * Should be called periodically
 */
export function runMatchmaking(): MatchFound[] {
  const matches: MatchFound[] = [];
  const processed = new Set<string>();
  
  for (const [playerId] of queue) {
    if (processed.has(playerId)) continue;
    
    const match = tryFindMatch(playerId);
    if (match) {
      matches.push(match);
      processed.add(match.player1.playerId);
      processed.add(match.player2.playerId);
    }
  }
  
  return matches;
}

/**
 * Get queue status for a player
 */
export function getQueueStatus(playerId: string): {
  inQueue: boolean;
  position: number;
  waitTime: number;
  searchRange: number;
  queueSize: number;
} {
  const inQueue = isInQueue(playerId);
  const waitTime = getWaitTime(playerId);
  
  return {
    inQueue,
    position: inQueue ? getQueuePosition(playerId) : 0,
    waitTime,
    searchRange: getMatchmakingRange(waitTime),
    queueSize: getQueueSize(),
  };
}

/**
 * Clear the queue (for testing/reset)
 */
export function clearQueue(): void {
  queue.clear();
}
