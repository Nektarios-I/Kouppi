/**
 * Auth Store - Manages authentication state for Career Mode
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Get API URL dynamically at runtime (not module load time)
function getApiUrl() {
  return typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin.replace(':3000', ':4000'))
    : (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000');
}

/**
 * Avatar configuration
 */
export interface Avatar {
  emoji: string;
  color: string;
  borderColor: string;
}

/**
 * User profile from API
 */
export interface UserProfile {
  id: string;
  username: string;
  createdAt: number;
  lastLoginAt: number | null;
  bankroll: number;
  rating: number;
  trophies: number;
  highestTrophies: number;
  arena: number;
  arenaName: string;
  gamesPlayed: number;
  gamesWon: number;
  totalEarnings: number;
  winRate: number;
  avatarEmoji: string;
  avatarColor: string;
  avatarBorder: string;
}

/**
 * Auth store state
 */
interface AuthState {
  // Auth state
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, avatar?: Partial<Avatar>) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  
  // Helpers
  isLoggedIn: () => boolean;
  getAuthHeader: () => Record<string, string>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,
      error: null,
      
      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`${getApiUrl()}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });
          
          const data = await response.json();
          
          if (!response.ok || !data.success) {
            set({ 
              isLoading: false, 
              error: data.error || "Login failed" 
            });
            return false;
          }
          
          set({ 
            token: data.token, 
            user: data.user, 
            isLoading: false,
            error: null,
          });
          
          return true;
        } catch (error: any) {
          set({ 
            isLoading: false, 
            error: error.message || "Failed to connect to server" 
          });
          return false;
        }
      },
      
      register: async (username: string, password: string, avatar?: Partial<Avatar>) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`${getApiUrl()}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, avatar }),
          });
          
          const data = await response.json();
          
          if (!response.ok || !data.success) {
            set({ 
              isLoading: false, 
              error: data.error || "Registration failed" 
            });
            return false;
          }
          
          set({ 
            token: data.token, 
            user: data.user, 
            isLoading: false,
            error: null,
          });
          
          return true;
        } catch (error: any) {
          set({ 
            isLoading: false, 
            error: error.message || "Failed to connect to server" 
          });
          return false;
        }
      },
      
      logout: () => {
        set({ token: null, user: null, error: null });
      },
      
      refreshUser: async () => {
        const { token } = get();
        if (!token) return;
        
        try {
          const response = await fetch(`${getApiUrl()}/api/auth/me`, {
            headers: { 
              "Authorization": `Bearer ${token}`,
            },
          });
          
          const data = await response.json();
          
          if (!response.ok || !data.success) {
            // Token might be invalid, logout
            if (response.status === 401) {
              set({ token: null, user: null });
            }
            return;
          }
          
          set({ user: data.user });
        } catch (error) {
          console.error("Failed to refresh user:", error);
        }
      },
      
      clearError: () => {
        set({ error: null });
      },
      
      isLoggedIn: () => {
        return !!get().token && !!get().user;
      },
      
      getAuthHeader: (): Record<string, string> => {
        const { token } = get();
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
      },
    }),
    {
      name: "kouppi-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
