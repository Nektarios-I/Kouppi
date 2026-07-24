"use client";

/**
 * Applies equipped cosmetics to local visual systems (table theme, etc.).
 * Mount once under authenticated shells / reward center / game pages.
 */

import { useEffect } from "react";
import { useRewardStore } from "@/store/rewardStore";
import { useUiThemeStore } from "@/store/uiThemeStore";
import { useAuthStore } from "@/store/authStore";
import { resolveTableThemeId } from "@/lib/cosmetics";

export function CosmeticsApplicator() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn());
  const equipped = useRewardStore((s) => s.state?.equipped);
  const setTableThemeId = useUiThemeStore((s) => s.setTableThemeId);

  useEffect(() => {
    if (!isLoggedIn || !equipped?.tableThemeId) return;
    const themeId = resolveTableThemeId(equipped.tableThemeId);
    setTableThemeId(themeId);
  }, [isLoggedIn, equipped?.tableThemeId, setTableThemeId]);

  return null;
}

/** Hook for components that need the active equipped cosmetics */
export function useEquippedCosmetics() {
  return useRewardStore((s) => s.state?.equipped ?? null);
}
