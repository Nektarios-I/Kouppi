/**
 * Career Store - Manages Career Mode state (queue, matches, etc.)
 */

import { create } from "zustand";
import { useAuthStore, UserProfile } from "./authStore";

const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry extends UserProfile {
  rank: number;
}

/**
 * Match record
 */
export interface MatchRecord {
  id: string;
  createdAt: number;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  player1Username: string;
  player2Username: string;
  winnerUsername: string | null;
  player1RatingChange: number;
  player2RatingChange: number;
  player1TrophyChange: number;
  player2TrophyChange: number;
  roundsPlayed: number;
  durationSeconds: number;
}

/**
 * Arena definition
 */
export interface Arena {
  level: number;
  name: string;
  minTrophies: number;
  reward: number;
}

/**
 * Career store state
 */
interface CareerState {
  // Queue state
  inQueue: boolean;
  queuePosition: number;
  queueWaitTime: number;
  searchRange: number;
  queueSize: number;
  
  // Match state
  matchFound: boolean;
  matchRoomId: string | null;
  opponent: UserProfile | null;
  
  // Data
  leaderboard: LeaderboardEntry[];
  matchHistory: MatchRecord[];
  arenas: Arena[];
  
  // Loading states
  isLoadingLeaderboard: boolean;
  isLoadingMatches: boolean;
  
  // Actions
  fetchLeaderboard: () => Promise<void>;
  fetchMatchHistory: (userId?: string) => Promise<void>;
  fetchProfile: (userId: string) => Promise<UserProfile | null>;
  
  // Queue simulation (actual implementation will use Socket.IO)
  setQueueState: (state: Partial<CareerState>) => void;
  resetQueueState: () => void;
}

export const useCareerStore = create<CareerState>((set, get) => ({
  // Queue state
  inQueue: false,
  queuePosition: 0,
  queueWaitTime: 0,
  searchRange: 100,
  queueSize: 0,
  
  // Match state
  matchFound: false,
  matchRoomId: null,
  opponent: null,
  
  // Data
  leaderboard: [],
  matchHistory: [],
  arenas: [
    { level: 1, name: "Bronze", minTrophies: 0, reward: 0 },
    { level: 2, name: "Silver", minTrophies: 300, reward: 100 },
    { level: 3, name: "Gold", minTrophies: 600, reward: 200 },
    { level: 4, name: "Platinum", minTrophies: 1000, reward: 500 },
    { level: 5, name: "Diamond", minTrophies: 1500, reward: 1000 },
    { level: 6, name: "Champion", minTrophies: 2000, reward: 2000 },
    { level: 7, name: "Grand Champion", minTrophies: 2500, reward: 3000 },
    { level: 8, name: "Legend", minTrophies: 3000, reward: 5000 },
  ],
  
  // Loading states
  isLoadingLeaderboard: false,
  isLoadingMatches: false,
  
  fetchLeaderboard: async () => {
    set({ isLoadingLeaderboard: true });
    
    try {
      const response = await fetch(`${API_URL}/api/leaderboard`);
      const data = await response.json();
      
      if (data.success && data.players) {
        // Add rank to each player
        const ranked = data.players.map((player: UserProfile, index: number) => ({
          ...player,
          rank: index + 1,
        }));
        
        set({ 
          leaderboard: ranked,
          arenas: data.arenas || get().arenas,
        });
      }
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      set({ isLoadingLeaderboard: false });
    }
  },
  
  fetchMatchHistory: async (userId?: string) => {
    set({ isLoadingMatches: true });
    
    try {
      const authStore = useAuthStore.getState();
      const headers: Record<string, string> = {};
      
      if (authStore.token) {
        headers["Authorization"] = `Bearer ${authStore.token}`;
      }
      
      const url = userId 
        ? `${API_URL}/api/matches/${userId}`
        : `${API_URL}/api/matches`;
        
      const response = await fetch(url, { headers });
      const data = await response.json();
      
      if (data.success && data.matches) {
        set({ matchHistory: data.matches });
      }
    } catch (error) {
      console.error("Failed to fetch match history:", error);
    } finally {
      set({ isLoadingMatches: false });
    }
  },
  
  fetchProfile: async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/profile/${userId}`);
      const data = await response.json();
      
      if (data.success && data.profile) {
        return data.profile;
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
    return null;
  },
  
  setQueueState: (state) => {
    set(state);
  },
  
  resetQueueState: () => {
    set({
      inQueue: false,
      queuePosition: 0,
      queueWaitTime: 0,
      searchRange: 100,
      matchFound: false,
      matchRoomId: null,
      opponent: null,
    });
  },
}));
