# Reward System — Normalized Spec (Implementation-Facing)

Source: `docs/REWARD_SYSTEM_DESIGN.md` (reconstructed V1).

---

## 1. Entities

| Entity | Description |
|--------|-------------|
| `RewardUserState` | Per-user streak, tokens, season XP, period markers, first-win date |
| `MissionSlot` | Assigned mission instance (daily/weekly), progress, status |
| `MissionDefinition` | Config pool entry (metric, target, rewards) |
| `SeasonDefinition` | `season_id`, window, level thresholds + rewards |
| `TrackClaim` | Claimed track level for a season |
| `AchievementDefinition` | Config metric + target + reward |
| `AchievementProgress` | Per-user progress / completion / claim |
| `LedgerEntry` | Immutable grant audit with unique idempotency key |
| `WheelSpin` | Recorded spin outcome |

---

## 2. States

### Daily claim
- `canClaim: boolean`
- `streak: number`
- `lastClaimDate: string | null` (`YYYY-MM-DD`)
- `nextReward: { chips, tokens, dayIndex }`
- `alreadyClaimedToday: boolean`

### First win
- `grantedToday: boolean`
- `rewardChips: number` (config)

### Mission slot
- `active` → `completed` (progress ≥ target) → `claimed`
- Reroll only from `active` with `progress < target`

### Season track
- `seasonId`, `xp`, `currentLevel`, `nextThreshold`
- Per level: `locked` | `claimable` | `claimed`

### Wheel
- `tokens: number`
- Spin allowed iff `tokens >= 1`

### Achievement
- `progress`, `completed`, `claimed`

---

## 3. Reward types

| Type | Payload |
|------|---------|
| `chips` | integer ≥ 0 credited to `users.bankroll` |
| `season_xp` | integer ≥ 0 added to season XP |
| `wheel_tokens` | integer ≥ 0 added to token balance |

Grants may combine types in one ledger entry.

---

## 4. Reset rules

| Period | Key format | Boundary |
|--------|------------|----------|
| Daily | `YYYY-MM-DD` | UTC midnight |
| Weekly | `YYYY-Www` | Monday 00:00 UTC |
| Season | config `season_id` | config start/end ms |

On daily key change: reassign 3 daily missions; reset daily reroll counter; first-win window refreshes.

On weekly key change: reassign 3 weekly missions.

On season change: XP resets; track claims scoped by `season_id` (old claims retained historically).

---

## 5. Claim rules

| Action | Rule |
|--------|------|
| Daily claim | Once per daily key; advances streak |
| Mission claim | Once per slot when completed |
| Track claim | Once per `(user, season, level)` when XP ≥ threshold |
| Achievement claim | Once when completed (or auto-grant on complete — V1 **auto-grants** on complete for less friction, still ledger-guarded) |
| Wheel spin | Consumes 1 token; grants table result once |

**V1 achievement choice:** auto-grant on completion (idempotent). Missions remain manual claim.

---

## 6. Anti-duplication rules

| Event | Idempotency key pattern |
|-------|-------------------------|
| Daily claim | `daily_claim:{userId}:{date}` |
| First win | `first_win:{userId}:{date}` |
| Mission claim | `mission_claim:{slotId}` |
| Track claim | `track_claim:{userId}:{seasonId}:{level}` |
| Achievement | `achievement:{userId}:{achievementId}` |
| Wheel spin | `wheel_spin:{spinId}` |
| Match XP | `match_xp:{matchEventId}:{userId}` (event id derived from career room + game id) |

Duplicate insert on unique `idempotency_key` → treat as already applied; return prior result or conflict error without double credit.

---

## 7. Mode applicability

| Feature | Career | Casual | Single |
|---------|--------|--------|--------|
| Reward Center / claims | ✅ | ✅ (if logged in) | ❌ |
| First win | ✅ | ❌ | ❌ |
| Mission progress (play/win/earn) | ✅ | ❌ | ❌ |
| Season XP from matches | ✅ | ❌ | ❌ |
| Daily claim / wheel / track claim | ✅ (auth) | ✅ (auth) | ❌ |

---

## 8. API surface (V1)

```
GET  /api/rewards/state
POST /api/rewards/daily/claim
POST /api/rewards/missions/:slotId/claim
POST /api/rewards/missions/:slotId/reroll
POST /api/rewards/track/:level/claim
POST /api/rewards/wheel/spin
```

All require `requireAuth`.

Internal (server-only): `onCareerMatchFinished(userId, event)` for first win + progress + XP.

---

## 9. Acceptance criteria

1. Daily claim succeeds once; second same-day attempt fails cleanly; streak increments / resets per rules; day-7 grants token.
2. First Career win of day grants chips once; second win / replay does not.
3. Three daily + three weekly missions assigned; progress from Career end; claim once; 1 daily reroll.
4. Season XP unlocks levels; track claim once per level.
5. Wheel consumes 1 token; zero tokens blocked; reward granted once.
6. Achievements progress and one-time grant.
7. Reward Center loads persisted state matching server.
8. Unit tests cover claim / duplicate / streak / first-win / mission / wheel / track.
9. Typecheck / build pass for touched packages.
