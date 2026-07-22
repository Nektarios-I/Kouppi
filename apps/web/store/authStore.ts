/**
 * Auth Store - Manages authentication state for Career Mode
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  formatAuthNetworkError,
  mapAuthHttpError,
  readAuthJsonResponse,
  resolveAuthApiBase,
} from "@/lib/serverUrl";

/**
 * Avatar configuration
 */
export interface Avatar {
  id: string;
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
  avatarId: string;
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
  /** Clear local JWT when the server rejects the session (DB wipe / expired sid). */
  clearStaleSession: (reason?: string) => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  
  // Helpers
  isLoggedIn: () => boolean;
  getAuthHeader: () => Record<string, string>;
}

function warnAuthDiagnostic(action: "login" | "register" | "me", diagnostic: string) {
  // Developer console only — never include passwords/tokens.
  console.warn(`[Career Auth] ${action}: ${diagnostic}`);
}

async function postAuth(
  action: "login" | "register",
  path: string,
  body: Record<string, unknown>
): Promise<{ success: true; token: string; user: UserProfile } | { success: false; error: string }> {
  const base = resolveAuthApiBase();
  if (!base.ok) {
    warnAuthDiagnostic(action, base.diagnostic);
    return { success: false, error: formatAuthNetworkError(base.diagnostic) };
  }

  let response: Response;
  try {
    response = await fetch(`${base.url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    warnAuthDiagnostic(action, `Network failure contacting ${base.url}${path}`);
    return { success: false, error: formatAuthNetworkError("Connection or CORS failure") };
  }

  const parsed = await readAuthJsonResponse(response);
  if (parsed.parseError || parsed.data == null) {
    warnAuthDiagnostic(action, `Non-JSON response (HTTP ${parsed.status}) from ${path}`);
    return {
      success: false,
      error: formatAuthNetworkError("Server returned an unexpected response"),
    };
  }

  if (!response.ok || !parsed.data.success) {
    const fallback = action === "login" ? "Login failed" : "Registration failed";
    return {
      success: false,
      error: mapAuthHttpError(parsed.status, parsed.data, fallback),
    };
  }

  return {
    success: true,
    token: parsed.data.token,
    user: parsed.data.user,
  };
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
        const result = await postAuth("login", "/api/auth/login", { username, password });
        if (!result.success) {
          set({ isLoading: false, error: result.error });
          return false;
        }
        set({
          token: result.token,
          user: result.user,
          isLoading: false,
          error: null,
        });
        return true;
      },
      
      register: async (username: string, password: string, avatar?: Partial<Avatar>) => {
        set({ isLoading: true, error: null });
        const result = await postAuth("register", "/api/auth/register", {
          username,
          password,
          avatar,
        });
        if (!result.success) {
          set({ isLoading: false, error: result.error });
          return false;
        }
        set({
          token: result.token,
          user: result.user,
          isLoading: false,
          error: null,
        });
        return true;
      },
      
      logout: () => {
        const { token } = get();
        const base = resolveAuthApiBase();
        // Best-effort server revoke; always clear local session.
        if (token && base.ok) {
          void fetch(`${base.url}/api/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => undefined);
        }
        set({ token: null, user: null, error: null });
      },

      clearStaleSession: (reason?: string) => {
        // Do not call logout HTTP — session is already invalid server-side.
        set({
          token: null,
          user: null,
          error: reason || "Your login session expired. Sign in again.",
        });
      },
      
      refreshUser: async () => {
        const { token } = get();
        if (!token) return;

        const base = resolveAuthApiBase();
        if (!base.ok) {
          warnAuthDiagnostic("me", base.diagnostic);
          return;
        }
        
        try {
          const response = await fetch(`${base.url}/api/auth/me`, {
            headers: { 
              "Authorization": `Bearer ${token}`,
            },
          });

          const parsed = await readAuthJsonResponse(response);
          if (parsed.parseError || !parsed.data) {
            warnAuthDiagnostic("me", `Non-JSON response (HTTP ${parsed.status})`);
            return;
          }
          
          if (!response.ok || !parsed.data.success) {
            if (response.status === 401) {
              get().clearStaleSession("Your login session expired. Sign in again.");
            }
            return;
          }
          
          set({ user: parsed.data.user });
        } catch {
          warnAuthDiagnostic("me", "Network failure refreshing profile");
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
