"use client";

import { HudButton } from "@/components/game/HudButton";
import { LobbyCard } from "@/components/game/LobbyUI";
import { formatResetCountdown, formatRewardGrant, ProgressBar } from "./RewardShared";
import type { RewardPublicState } from "@/store/rewardStore";

export function DailyClaimCard({
  dailyClaim,
  serverNow,
  isActing,
  onClaim,
}: {
  dailyClaim: RewardPublicState["dailyClaim"];
  serverNow: number;
  isActing: boolean;
  onClaim: () => void;
}) {
  const filled = dailyClaim.alreadyClaimedToday
    ? ((dailyClaim.streak - 1) % 7) + 1
    : Math.max(0, dailyClaim.nextDayIndex - 1);

  return (
    <LobbyCard title="Daily Claim" icon="◇">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 font-ui">Streak day</div>
          <div className="font-display text-3xl text-gold-light font-bold">
            {dailyClaim.alreadyClaimedToday
              ? ((dailyClaim.streak - 1) % 7) + 1
              : dailyClaim.nextDayIndex}
            <span className="text-base text-gray-500 font-ui font-normal"> / 7</span>
          </div>
          <div className="text-xs text-gray-500 font-ui mt-0.5">
            Best lifetime: {dailyClaim.lifetimeBestStreak}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-gray-500 font-ui">
            {dailyClaim.alreadyClaimedToday ? "Claimed · next reward" : "Next reward"}
          </div>
          <div className="font-ui text-sm text-gray-200">{formatRewardGrant(dailyClaim.nextReward)}</div>
          <div className="text-xs text-gold/80 font-ui mt-1 tabular-nums">
            Resets in {formatResetCountdown(dailyClaim.nextResetAt, serverNow)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
          const active = day <= filled;
          const isNext = !dailyClaim.alreadyClaimedToday && day === dailyClaim.nextDayIndex;
          return (
            <div
              key={day}
              className={`aspect-square rounded-md flex items-center justify-center text-xs font-ui border transition-colors ${
                isNext
                  ? "border-gold text-gold-light bg-gold/10"
                  : active
                    ? "border-gold/40 text-gold bg-gold/5"
                    : "border-white/10 text-gray-500 bg-black/20"
              }`}
              title={`Day ${day}`}
            >
              {day}
            </div>
          );
        })}
      </div>

      <HudButton
        variant="kouppi"
        fullWidth
        disabled={!dailyClaim.canClaim || isActing}
        onClick={onClaim}
      >
        {dailyClaim.alreadyClaimedToday ? "Already claimed today" : "Claim daily reward"}
      </HudButton>
    </LobbyCard>
  );
}

export function FirstWinBanner({ firstWin }: { firstWin: RewardPublicState["firstWin"] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <div className="font-ui text-sm text-gray-200">First win of the day</div>
        <div className="text-xs text-gray-500 font-ui">
          Career win grants +{firstWin.rewardChips} chips · +{firstWin.rewardXp} XP (once per UTC day)
        </div>
      </div>
      <div
        className={`text-xs font-ui uppercase tracking-wide px-2 py-1 rounded border ${
          firstWin.grantedToday
            ? "border-success/40 text-success bg-success/10"
            : "border-gold/40 text-gold-light bg-gold/10"
        }`}
      >
        {firstWin.grantedToday ? "Claimed" : "Available"}
      </div>
    </div>
  );
}

export function MissionsPanel({
  title,
  missions,
  freeRerolls,
  rerollTokens,
  showReroll,
  isActing,
  onClaim,
  onReroll,
}: {
  title: string;
  missions: RewardPublicState["dailyMissions"];
  freeRerolls?: number;
  rerollTokens?: number;
  showReroll?: boolean;
  isActing: boolean;
  onClaim: (id: string) => void;
  onReroll?: (id: string) => void;
}) {
  return (
    <LobbyCard
      title={title}
      icon="▣"
      badge={
        showReroll ? (
          <span className="text-xs text-gray-400 font-ui">
            Free {freeRerolls ?? 0} · Tokens {rerollTokens ?? 0}
          </span>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {missions.length === 0 ? (
          <p className="text-sm text-gray-500 font-ui py-4 text-center">No missions assigned</p>
        ) : (
          missions.map((m) => (
            <div key={m.id} className="rounded-md border border-white/10 bg-black/20 p-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-ui text-sm text-gray-100 truncate">{m.title}</div>
                  <div className="text-xs text-gray-500">{m.description}</div>
                </div>
                <div className="text-xs text-gold font-ui shrink-0 text-right max-w-[40%]">
                  {formatRewardGrant(m.reward)}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <ProgressBar value={m.progress} max={m.target} />
                <span className="text-xs text-gray-400 font-ui tabular-nums shrink-0">
                  {m.progress}/{m.target}
                </span>
              </div>
              <div className="flex gap-2">
                {m.canClaim && (
                  <HudButton
                    variant="success"
                    size="sm"
                    disabled={isActing}
                    onClick={() => onClaim(m.id)}
                  >
                    Claim
                  </HudButton>
                )}
                {m.status === "claimed" && (
                  <span className="text-xs text-success font-ui self-center">Claimed</span>
                )}
                {showReroll && m.canReroll && onReroll && (
                  <HudButton
                    variant="ghost"
                    size="sm"
                    disabled={isActing}
                    onClick={() => onReroll(m.id)}
                  >
                    Reroll
                  </HudButton>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </LobbyCard>
  );
}

export function SeasonTrackPanel({
  season,
  isActing,
  onClaim,
}: {
  season: RewardPublicState["season"];
  isActing: boolean;
  onClaim: (level: number) => void;
}) {
  const next = season.levels.find((l) => l.state !== "claimed") ?? season.levels[season.levels.length - 1];
  const prevXp = [...season.levels].reverse().find((l) => l.xpRequired <= season.xp)?.xpRequired ?? 0;
  const barMax = next ? Math.max(next.xpRequired - prevXp, 1) : 1;
  const barVal = next ? Math.max(0, season.xp - prevXp) : barMax;

  return (
    <LobbyCard title="Season Track" icon="◈">
      <div className="mb-4">
        <div className="flex justify-between gap-3 mb-1">
          <div className="font-ui text-sm text-gray-200">{season.name}</div>
          <div className="text-xs text-gray-400 font-ui">
            Lv {season.currentLevel}/{season.levels.length} · {season.xp.toLocaleString()} XP
          </div>
        </div>
        <ProgressBar value={barVal} max={barMax} />
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {season.levels.map((lvl) => (
          <div
            key={lvl.level}
            className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="font-ui text-sm text-gray-100">
                L{lvl.level} · {lvl.label}
              </div>
              <div className="text-xs text-gray-500">
                {lvl.xpRequired.toLocaleString()} XP · {formatRewardGrant(lvl.reward)}
              </div>
            </div>
            {lvl.state === "claimable" ? (
              <HudButton
                variant="kouppi"
                size="sm"
                disabled={isActing}
                onClick={() => onClaim(lvl.level)}
              >
                Claim
              </HudButton>
            ) : (
              <span
                className={`text-xs font-ui uppercase tracking-wide ${
                  lvl.state === "claimed" ? "text-success" : "text-gray-500"
                }`}
              >
                {lvl.state}
              </span>
            )}
          </div>
        ))}
      </div>
    </LobbyCard>
  );
}

export function WheelPanel({
  wheel,
  isActing,
  onSpin,
}: {
  wheel: RewardPublicState["wheel"];
  isActing: boolean;
  onSpin: () => void;
}) {
  return (
    <LobbyCard title="Reward Wheel" icon="◎">
      <p className="text-xs text-gray-500 font-ui mb-3">
        Token-based spins — secondary excitement, not required for the season track.
      </p>
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 font-ui">Tokens</div>
          <div className="font-display text-3xl text-gold-light font-bold">{wheel.tokens}</div>
        </div>
        <HudButton variant="kouppi" disabled={wheel.tokens < 1 || isActing} onClick={onSpin}>
          Spin (1 token)
        </HudButton>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {wheel.table.map((entry) => (
          <div
            key={entry.id}
            className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-xs font-ui text-gray-400"
          >
            <span className="text-gray-200">{entry.label}</span>
            <span className="float-right text-gray-500">{(entry.weight / 10).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </LobbyCard>
  );
}

export function AchievementsPanel({ achievements }: { achievements: RewardPublicState["achievements"] }) {
  return (
    <LobbyCard title="Achievements" icon="✦">
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {achievements.map((a) => (
          <div key={a.id} className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="flex justify-between gap-2 mb-1">
              <div className="font-ui text-sm text-gray-100">{a.name}</div>
              <div className="text-xs text-gray-400 font-ui tabular-nums">
                {a.progress}/{a.target}
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-2">{a.description}</div>
            <ProgressBar value={a.progress} max={a.target} />
            <div className="mt-2 flex justify-between text-xs font-ui gap-2">
              <span className="text-gold/80 truncate">{formatRewardGrant(a.reward)}</span>
              <span className={a.claimed ? "text-success" : a.completed ? "text-gold-light" : "text-gray-500"}>
                {a.claimed ? "Complete" : a.completed ? "Ready" : "In progress"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </LobbyCard>
  );
}
