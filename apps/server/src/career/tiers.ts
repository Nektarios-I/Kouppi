/**
 * Career Mode Tier Configuration
 * 
 * Defines rating-based tiers with available ante options.
 * Each tier has a rating requirement and multiple ante choices.
 */

export interface AnteTier {
  id: string;
  name: string;
  emoji: string;
  minRating: number;
  maxRating: number | null; // null = no upper limit
  description: string;
  color: string;
  antes: AnteOption[];
}

export interface AnteOption {
  id: string;
  ante: number;
  minBet: number;
  maxBet: number;
  buyIn: number; // Minimum bankroll needed
  label: string;
}

/**
 * Career Mode Tiers
 * Players can only access tiers where their rating meets minRating
 */
export const CAREER_TIERS: AnteTier[] = [
  {
    id: "bronze",
    name: "Bronze League",
    emoji: "🥉",
    minRating: 0,
    maxRating: 1099,
    description: "Beginner tables for new players",
    color: "#CD7F32",
    antes: [
      { id: "bronze-1", ante: 5, minBet: 5, maxBet: 25, buyIn: 100, label: "Micro (5/5-25)" },
      { id: "bronze-2", ante: 10, minBet: 10, maxBet: 50, buyIn: 200, label: "Low (10/10-50)" },
      { id: "bronze-3", ante: 25, minBet: 25, maxBet: 100, buyIn: 500, label: "Standard (25/25-100)" },
    ],
  },
  {
    id: "silver",
    name: "Silver League",
    emoji: "🥈",
    minRating: 1100,
    maxRating: 1299,
    description: "Intermediate tables for improving players",
    color: "#C0C0C0",
    antes: [
      { id: "silver-1", ante: 25, minBet: 25, maxBet: 100, buyIn: 500, label: "Low (25/25-100)" },
      { id: "silver-2", ante: 50, minBet: 50, maxBet: 200, buyIn: 1000, label: "Standard (50/50-200)" },
      { id: "silver-3", ante: 100, minBet: 100, maxBet: 400, buyIn: 2000, label: "High (100/100-400)" },
    ],
  },
  {
    id: "gold",
    name: "Gold League",
    emoji: "🥇",
    minRating: 1300,
    maxRating: 1499,
    description: "Skilled tables for experienced players",
    color: "#FFD700",
    antes: [
      { id: "gold-1", ante: 50, minBet: 50, maxBet: 200, buyIn: 1000, label: "Low (50/50-200)" },
      { id: "gold-2", ante: 100, minBet: 100, maxBet: 500, buyIn: 2500, label: "Standard (100/100-500)" },
      { id: "gold-3", ante: 250, minBet: 250, maxBet: 1000, buyIn: 5000, label: "High (250/250-1000)" },
    ],
  },
  {
    id: "platinum",
    name: "Platinum League",
    emoji: "💎",
    minRating: 1500,
    maxRating: 1699,
    description: "Advanced tables for competitive players",
    color: "#E5E4E2",
    antes: [
      { id: "plat-1", ante: 100, minBet: 100, maxBet: 500, buyIn: 2500, label: "Low (100/100-500)" },
      { id: "plat-2", ante: 250, minBet: 250, maxBet: 1000, buyIn: 5000, label: "Standard (250/250-1K)" },
      { id: "plat-3", ante: 500, minBet: 500, maxBet: 2000, buyIn: 10000, label: "High (500/500-2K)" },
    ],
  },
  {
    id: "diamond",
    name: "Diamond League",
    emoji: "💠",
    minRating: 1700,
    maxRating: 1899,
    description: "Elite tables for top players",
    color: "#B9F2FF",
    antes: [
      { id: "dia-1", ante: 250, minBet: 250, maxBet: 1000, buyIn: 5000, label: "Low (250/250-1K)" },
      { id: "dia-2", ante: 500, minBet: 500, maxBet: 2500, buyIn: 12500, label: "Standard (500/500-2.5K)" },
      { id: "dia-3", ante: 1000, minBet: 1000, maxBet: 5000, buyIn: 25000, label: "High (1K/1K-5K)" },
    ],
  },
  {
    id: "master",
    name: "Master League",
    emoji: "👑",
    minRating: 1900,
    maxRating: null,
    description: "The highest stakes for champions",
    color: "#9B59B6",
    antes: [
      { id: "master-1", ante: 500, minBet: 500, maxBet: 2500, buyIn: 12500, label: "Low (500/500-2.5K)" },
      { id: "master-2", ante: 1000, minBet: 1000, maxBet: 5000, buyIn: 25000, label: "Standard (1K/1K-5K)" },
      { id: "master-3", ante: 2500, minBet: 2500, maxBet: 10000, buyIn: 50000, label: "High (2.5K/2.5K-10K)" },
    ],
  },
];

/**
 * Get all tiers available to a player based on their rating
 */
export function getAvailableTiers(rating: number): AnteTier[] {
  return CAREER_TIERS.filter((tier) => rating >= tier.minRating);
}

/**
 * Get a specific tier by ID
 */
export function getTierById(tierId: string): AnteTier | undefined {
  return CAREER_TIERS.find((tier) => tier.id === tierId);
}

/**
 * Get an ante option by ID
 */
export function getAnteOptionById(anteId: string): { tier: AnteTier; ante: AnteOption } | undefined {
  for (const tier of CAREER_TIERS) {
    const ante = tier.antes.find((a) => a.id === anteId);
    if (ante) {
      return { tier, ante };
    }
  }
  return undefined;
}

/**
 * Check if a player can access a specific tier
 */
export function canAccessTier(rating: number, tierId: string): boolean {
  const tier = getTierById(tierId);
  if (!tier) return false;
  return rating >= tier.minRating;
}

/**
 * Check if a player can afford an ante option
 */
export function canAffordAnte(bankroll: number, anteId: string): boolean {
  const option = getAnteOptionById(anteId);
  if (!option) return false;
  return bankroll >= option.ante.buyIn;
}
