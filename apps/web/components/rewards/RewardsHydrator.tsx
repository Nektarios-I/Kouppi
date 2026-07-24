"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRewardStore } from "@/store/rewardStore";

/** Loads reward/cosmetics state whenever the user is logged in. */
export function RewardsHydrator() {
  const token = useAuthStore((s) => s.token);
  const fetchState = useRewardStore((s) => s.fetchState);

  useEffect(() => {
    if (!token) return;
    void fetchState();
  }, [token, fetchState]);

  return null;
}
