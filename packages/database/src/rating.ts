/**
 * Rating Module - Elo rating and trophy calculations
 */

/**
 * Calculate expected score (probability of winning) for player A against player B
 * Using the standard Elo formula
 */
export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Determine K-factor based on games played
 * - New players (< 30 games): K=40 for faster adjustment
 * - Intermediate (30-100 games): K=24 
 * - Established (100+ games): K=16 for stability
 */
export function getKFactor(gamesPlayed: number): number {
  if (gamesPlayed < 30) return 40;
  if (gamesPlayed < 100) return 24;
  return 16;
}

/**
 * Calculate rating change after a match
 */
export function calculateRatingChange(
  playerRating: number,
  opponentRating: number,
  won: boolean,
  playerGamesPlayed: number
): number {
  const expected = calculateExpectedScore(playerRating, opponentRating);
  const actual = won ? 1 : 0;
  const k = getKFactor(playerGamesPlayed);
  
  return Math.round(k * (actual - expected));
}

/**
 * Calculate trophy change after a match
 * Trophy changes are more visible/simple than Elo
 * 
 * Base: +30 for win, -30 for loss
 * Adjustment: ±5 per 100 rating difference
 */
export function calculateTrophyChange(
  playerRating: number,
  opponentRating: number,
  won: boolean
): number {
  const ratingDiff = opponentRating - playerRating;
  const adjustment = Math.floor(ratingDiff / 100) * 5;
  
  if (won) {
    // Win vs higher rated = more trophies (max +45, min +20)
    return Math.min(45, Math.max(20, 30 + adjustment));
  } else {
    // Loss vs lower rated = more trophies lost (max -40, min -10)
    return -Math.min(40, Math.max(10, 30 - adjustment));
  }
}

/**
 * Calculate match results for both players
 */
export interface MatchResult {
  player1RatingChange: number;
  player2RatingChange: number;
  player1TrophyChange: number;
  player2TrophyChange: number;
}

export function calculateMatchResults(
  player1Rating: number,
  player2Rating: number,
  player1GamesPlayed: number,
  player2GamesPlayed: number,
  player1Won: boolean
): MatchResult {
  const player1RatingChange = calculateRatingChange(
    player1Rating,
    player2Rating,
    player1Won,
    player1GamesPlayed
  );
  
  const player2RatingChange = calculateRatingChange(
    player2Rating,
    player1Rating,
    !player1Won,
    player2GamesPlayed
  );
  
  const player1TrophyChange = calculateTrophyChange(
    player1Rating,
    player2Rating,
    player1Won
  );
  
  const player2TrophyChange = calculateTrophyChange(
    player2Rating,
    player1Rating,
    !player1Won
  );
  
  return {
    player1RatingChange,
    player2RatingChange,
    player1TrophyChange,
    player2TrophyChange,
  };
}

/**
 * Get matchmaking rating range based on wait time
 * Range expands as player waits longer
 * 
 * @param waitTimeSeconds How long the player has been waiting
 * @returns Allowed rating difference
 */
export function getMatchmakingRange(waitTimeSeconds: number): number {
  // Start with ±100, expand by 50 every 5 seconds, max ±500
  const base = 100;
  const expansion = Math.floor(waitTimeSeconds / 5) * 50;
  return Math.min(500, base + expansion);
}

/**
 * Check if two players are compatible for matchmaking
 */
export function isMatchmakingCompatible(
  rating1: number,
  rating2: number,
  waitTime1: number,
  waitTime2: number
): boolean {
  const range1 = getMatchmakingRange(waitTime1);
  const range2 = getMatchmakingRange(waitTime2);
  const diff = Math.abs(rating1 - rating2);
  
  // Both players must have expanded their range enough
  return diff <= range1 && diff <= range2;
}

/**
 * Calculate new rating after a match (returns absolute rating, not change)
 */
export function calculateNewRating(
  playerRating: number,
  opponentRating: number,
  score: number, // 1 = win, 0 = loss, 0.5 = draw
  gamesPlayed: number = 50
): number {
  const expected = calculateExpectedScore(playerRating, opponentRating);
  const k = getKFactor(gamesPlayed);
  const change = Math.round(k * (score - expected));
  return playerRating + change;
}

/**
 * Calculate trophy change for multiplayer games
 * Based on placement and performance in a multi-player game
 */
export function calculateMultiplayerTrophyChange(
  playerRating: number,
  performanceScore: number, // 0-1 based on chips won
  placement: number,
  totalPlayers: number
): number {
  // Base trophy change: 1st = +40, 2nd = +20, 3rd = +5, 4th+ = -10 to -30
  let baseTrophies: number;
  
  if (placement === 1) {
    baseTrophies = 40;
  } else if (placement === 2) {
    baseTrophies = 20;
  } else if (placement === 3) {
    baseTrophies = 5;
  } else if (placement === totalPlayers) {
    baseTrophies = -30;
  } else {
    // Middle placements: interpolate between +5 and -30
    const ratio = (placement - 3) / (totalPlayers - 3);
    baseTrophies = Math.round(5 - (35 * ratio));
  }
  
  // Adjust based on performance score (chips won)
  // Good performance can add up to +10, poor can subtract up to -10
  const performanceAdjustment = Math.round((performanceScore - 0.5) * 20);
  
  return baseTrophies + performanceAdjustment;
}

