"use client";

import type { RewardCurrencyGrant } from "@/store/rewardStore";
import { formatRewardGrant } from "@/store/rewardStore";

export { formatRewardGrant };

export function formatResetCountdown(resetAt: number, nowMs: number): string {
  const ms = Math.max(0, resetAt - nowMs);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden border border-white/5">
      <div
        className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold-light transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function GrantText({ grant }: { grant: RewardCurrencyGrant | undefined }) {
  return <span>{formatRewardGrant(grant).replace(/^\+/, "").replace(/ · \+/g, " · ")}</span>;
}
