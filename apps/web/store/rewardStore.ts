/**
 * Reward Center client store — loads / mutates server-authoritative reward state.
 */

import { create } from "zustand";
import { resolveAuthApiBase, formatAuthNetworkError } from "@/lib/serverUrl";
import { useAuthStore } from "@/store/authStore";

export interface RewardUnlockGrant {
  kind: string;
  id: string;
  label: string;
}

export interface RewardCurrencyGrant {
  chips?: number;
  seasonXp?: number;
  wheelTokens?: number;
  missionRerollTokens?: number;
  unlocks?: RewardUnlockGrant[];
}

export interface MissionSlotView {
  id: string;
  periodType: "daily" | "weekly";
  slotIndex: number;
  definitionId: string;
  title: string;
  description: string;
  metric: string;
  progress: number;
  target: number;
  status: "active" | "completed" | "claimed";
  reward: RewardCurrencyGrant;
  canClaim: boolean;
  canReroll: boolean;
}

export interface TrackLevelView {
  level: number;
  label: string;
  xpRequired: number;
  reward: RewardCurrencyGrant;
  state: "locked" | "claimable" | "claimed";
}

export interface AchievementView {
  id: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  reward: RewardCurrencyGrant;
}

export interface RewardPublicState {
  serverNow: number;
  dailyPeriodKey: string;
  weeklyPeriodKey: string;
  nextDailyResetAt: number;
  nextWeeklyResetAt: number;
  currencies: {
    bankroll: number;
    wheelTokens: number;
    missionRerollTokens: number;
    seasonXp: number;
  };
  dailyClaim: {
    canClaim: boolean;
    alreadyClaimedToday: boolean;
    streak: number;
    lifetimeBestStreak: number;
    lastClaimDate: string | null;
    nextDayIndex: number;
    nextReward: RewardCurrencyGrant;
    nextResetAt: number;
  };
  firstWin: {
    grantedToday: boolean;
    rewardChips: number;
    rewardXp: number;
  };
  dailyMissions: MissionSlotView[];
  weeklyMissions: MissionSlotView[];
  dailyRerollsRemaining: number;
  season: {
    id: string;
    name: string;
    startsAt: number;
    endsAt: number;
    xp: number;
    currentLevel: number;
    levels: TrackLevelView[];
  };
  wheel: {
    tokens: number;
    table: Array<{ id: string; label: string; weight: number }>;
  };
  unlocks: Array<{ kind: string; id: string; label: string; unlockedAt: number }>;
  equipped: {
    titleId: string | null;
    badgeId: string | null;
    frameId: string | null;
    cardBackId: string | null;
    tableThemeId: string | null;
    seatRingId: string | null;
    chipSkinId: string | null;
  };
  cosmeticsCatalog: Array<{
    id: string;
    kind: string;
    slot: string;
    label: string;
    owned: boolean;
    isDefault?: boolean;
    tableThemeId?: string;
    emoteGlyph?: string;
  }>;
  achievements: AchievementView[];
}

interface RewardStoreState {
  state: RewardPublicState | null;
  isLoading: boolean;
  isActing: boolean;
  error: string | null;
  lastFeedback: string | null;
  fetchState: () => Promise<void>;
  claimDaily: () => Promise<boolean>;
  claimMission: (slotId: string) => Promise<boolean>;
  rerollMission: (slotId: string) => Promise<boolean>;
  claimTrack: (level: number) => Promise<boolean>;
  spinWheel: () => Promise<boolean>;
  equipCosmetic: (slot: string, cosmeticId: string | null) => Promise<boolean>;
  clearError: () => void;
  clearFeedback: () => void;
}

export function formatRewardGrant(grant: RewardCurrencyGrant | undefined): string {
  if (!grant) return "Reward granted";
  const parts: string[] = [];
  if (grant.chips) parts.push(`+${grant.chips} chips`);
  if (grant.seasonXp) parts.push(`+${grant.seasonXp} XP`);
  if (grant.wheelTokens) parts.push(`+${grant.wheelTokens} wheel token${grant.wheelTokens === 1 ? "" : "s"}`);
  if (grant.missionRerollTokens) {
    parts.push(`+${grant.missionRerollTokens} reroll token${grant.missionRerollTokens === 1 ? "" : "s"}`);
  }
  for (const u of grant.unlocks ?? []) parts.push(u.label);
  return parts.length ? parts.join(" · ") : "Reward granted";
}

async function rewardFetch(path: string, init?: RequestInit): Promise<{
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
  error?: string;
}> {
  const base = resolveAuthApiBase();
  if (!base.ok) {
    return { ok: false, status: 0, json: {}, error: formatAuthNetworkError(base.diagnostic) };
  }
  const headers = useAuthStore.getState().getAuthHeader();
  const response = await fetch(`${base.url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...(init?.headers ?? {}),
    },
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      json,
      error: typeof json.error === "string" ? json.error : "Request failed",
    };
  }
  return { ok: true, status: response.status, json };
}

export const useRewardStore = create<RewardStoreState>((set) => ({
  state: null,
  isLoading: false,
  isActing: false,
  error: null,
  lastFeedback: null,

  clearError: () => set({ error: null }),
  clearFeedback: () => set({ lastFeedback: null }),

  fetchState: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await rewardFetch("/api/rewards/state");
      if (!result.ok) {
        set({ isLoading: false, error: result.error ?? "Failed to load rewards" });
        return;
      }
      set({
        isLoading: false,
        state: result.json.state as RewardPublicState,
      });
    } catch {
      set({ isLoading: false, error: "Failed to load rewards" });
    }
  },

  claimDaily: async () => {
    set({ isActing: true, error: null });
    try {
      const result = await rewardFetch("/api/rewards/daily/claim", { method: "POST" });
      if (!result.ok) {
        set({ isActing: false, error: result.error ?? "Claim failed" });
        return false;
      }
      set({
        isActing: false,
        state: result.json.state as RewardPublicState,
        lastFeedback: formatRewardGrant(result.json.grant as RewardCurrencyGrant),
      });
      void useAuthStore.getState().refreshUser();
      return true;
    } catch {
      set({ isActing: false, error: "Claim failed" });
      return false;
    }
  },

  claimMission: async (slotId: string) => {
    set({ isActing: true, error: null });
    try {
      const result = await rewardFetch(`/api/rewards/missions/${slotId}/claim`, { method: "POST" });
      if (!result.ok) {
        set({ isActing: false, error: result.error ?? "Mission claim failed" });
        return false;
      }
      set({
        isActing: false,
        state: result.json.state as RewardPublicState,
        lastFeedback: formatRewardGrant(result.json.grant as RewardCurrencyGrant),
      });
      void useAuthStore.getState().refreshUser();
      return true;
    } catch {
      set({ isActing: false, error: "Mission claim failed" });
      return false;
    }
  },

  rerollMission: async (slotId: string) => {
    set({ isActing: true, error: null });
    try {
      const result = await rewardFetch(`/api/rewards/missions/${slotId}/reroll`, { method: "POST" });
      if (!result.ok) {
        set({ isActing: false, error: result.error ?? "Reroll failed" });
        return false;
      }
      set({
        isActing: false,
        state: result.json.state as RewardPublicState,
        lastFeedback: "Mission rerolled",
      });
      return true;
    } catch {
      set({ isActing: false, error: "Reroll failed" });
      return false;
    }
  },

  claimTrack: async (level: number) => {
    set({ isActing: true, error: null });
    try {
      const result = await rewardFetch(`/api/rewards/track/${level}/claim`, { method: "POST" });
      if (!result.ok) {
        set({ isActing: false, error: result.error ?? "Track claim failed" });
        return false;
      }
      set({
        isActing: false,
        state: result.json.state as RewardPublicState,
        lastFeedback: formatRewardGrant(result.json.grant as RewardCurrencyGrant),
      });
      void useAuthStore.getState().refreshUser();
      return true;
    } catch {
      set({ isActing: false, error: "Track claim failed" });
      return false;
    }
  },

  spinWheel: async () => {
    set({ isActing: true, error: null });
    try {
      const result = await rewardFetch("/api/rewards/wheel/spin", { method: "POST" });
      if (!result.ok) {
        set({ isActing: false, error: result.error ?? "Spin failed" });
        return false;
      }
      const label = typeof result.json.label === "string" ? result.json.label : "Spin complete";
      set({
        isActing: false,
        state: result.json.state as RewardPublicState,
        lastFeedback: `${label} · ${formatRewardGrant(result.json.grant as RewardCurrencyGrant)}`,
      });
      void useAuthStore.getState().refreshUser();
      return true;
    } catch {
      set({ isActing: false, error: "Spin failed" });
      return false;
    }
  },

  equipCosmetic: async (slot: string, cosmeticId: string | null) => {
    set({ isActing: true, error: null });
    try {
      const result = await rewardFetch("/api/rewards/cosmetics/equip", {
        method: "POST",
        body: JSON.stringify({ slot, cosmeticId }),
      });
      if (!result.ok) {
        set({ isActing: false, error: result.error ?? "Equip failed" });
        return false;
      }
      set({
        isActing: false,
        state: result.json.state as RewardPublicState,
        lastFeedback: cosmeticId ? "Cosmetic equipped" : "Cosmetic cleared",
      });
      try {
        const { useRemoteGameStore } = await import("@/store/remoteGameStore");
        useRemoteGameStore.getState().syncCosmetics();
      } catch {
        // ignore — may not be in a room
      }
      try {
        const { useCareerLobbyStore } = await import("@/store/careerLobbyStore");
        useCareerLobbyStore.getState().syncCosmetics();
      } catch {
        // ignore
      }
      return true;
    } catch {
      set({ isActing: false, error: "Equip failed" });
      return false;
    }
  },
}));
