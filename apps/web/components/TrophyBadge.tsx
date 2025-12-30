"use client";

import { useMemo } from "react";

interface TrophyBadgeProps {
  trophies: number;
  arena: number;
  arenaName: string;
  size?: "sm" | "md" | "lg";
  showArena?: boolean;
}

// Arena colors and icons
const ARENA_STYLES: Record<number, { color: string; bgColor: string; icon: string }> = {
  1: { color: "text-orange-400", bgColor: "bg-orange-900/30", icon: "🥉" },
  2: { color: "text-gray-300", bgColor: "bg-gray-700/30", icon: "🥈" },
  3: { color: "text-yellow-400", bgColor: "bg-yellow-900/30", icon: "🥇" },
  4: { color: "text-cyan-300", bgColor: "bg-cyan-900/30", icon: "💎" },
  5: { color: "text-blue-400", bgColor: "bg-blue-900/30", icon: "💠" },
  6: { color: "text-purple-400", bgColor: "bg-purple-900/30", icon: "👑" },
  7: { color: "text-pink-400", bgColor: "bg-pink-900/30", icon: "🏆" },
  8: { color: "text-amber-400", bgColor: "bg-amber-900/30", icon: "⭐" },
};

const SIZE_CLASSES = {
  sm: "text-sm px-2 py-1",
  md: "text-base px-3 py-1.5",
  lg: "text-lg px-4 py-2",
};

export default function TrophyBadge({ 
  trophies, 
  arena, 
  arenaName, 
  size = "md",
  showArena = true 
}: TrophyBadgeProps) {
  const style = ARENA_STYLES[arena] || ARENA_STYLES[1];
  
  return (
    <div className={`inline-flex items-center gap-2 rounded-full ${style.bgColor} ${SIZE_CLASSES[size]} border border-white/10`}>
      <span className={style.color}>{style.icon}</span>
      <span className={`font-bold ${style.color}`}>{trophies.toLocaleString()}</span>
      <span className="text-yellow-500">🏆</span>
      {showArena && (
        <span className={`text-xs ${style.color} opacity-75`}>
          {arenaName}
        </span>
      )}
    </div>
  );
}

interface RatingBadgeProps {
  rating: number;
  size?: "sm" | "md" | "lg";
}

// Get rating tier based on Elo
function getRatingTier(rating: number): { name: string; color: string } {
  if (rating >= 2400) return { name: "Grandmaster", color: "text-red-400" };
  if (rating >= 2000) return { name: "Master", color: "text-purple-400" };
  if (rating >= 1800) return { name: "Expert", color: "text-blue-400" };
  if (rating >= 1600) return { name: "Class A", color: "text-green-400" };
  if (rating >= 1400) return { name: "Class B", color: "text-yellow-400" };
  if (rating >= 1200) return { name: "Class C", color: "text-orange-400" };
  return { name: "Beginner", color: "text-gray-400" };
}

export function RatingBadge({ rating, size = "md" }: RatingBadgeProps) {
  const tier = getRatingTier(rating);
  
  return (
    <div className={`inline-flex items-center gap-2 rounded-full bg-gray-800/50 ${SIZE_CLASSES[size]} border border-white/10`}>
      <span className={`font-bold ${tier.color}`}>{rating}</span>
      <span className={`text-xs ${tier.color} opacity-75`}>
        {tier.name}
      </span>
    </div>
  );
}

interface WinRateBadgeProps {
  gamesPlayed: number;
  gamesWon: number;
  size?: "sm" | "md" | "lg";
}

export function WinRateBadge({ gamesPlayed, gamesWon, size = "md" }: WinRateBadgeProps) {
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
  
  const color = useMemo(() => {
    if (winRate >= 70) return "text-green-400";
    if (winRate >= 50) return "text-yellow-400";
    if (winRate >= 30) return "text-orange-400";
    return "text-red-400";
  }, [winRate]);
  
  return (
    <div className={`inline-flex items-center gap-2 rounded-full bg-gray-800/50 ${SIZE_CLASSES[size]} border border-white/10`}>
      <span className={`font-bold ${color}`}>{winRate}%</span>
      <span className="text-xs text-gray-400">
        Win Rate
      </span>
    </div>
  );
}
