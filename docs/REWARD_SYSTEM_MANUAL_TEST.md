# Reward System — Manual Test Guide

## Prerequisites

Prefer Node **20–22** (repo engines). If using Node 25+, rebuild native deps first:

```bash
cd node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3
npm run build-release
```

From monorepo root:

```bash
pnpm install
pnpm --filter @kouppi/database build
pnpm --filter @kouppi/server build
pnpm --filter @kouppi/web build
```

## Automated commands run

```bash
# Pure + SQLite reward tests
pnpm --filter @kouppi/database exec vitest run src/__tests__/rewardTime.test.ts src/__tests__/rewards.test.ts

# Package builds
pnpm --filter @kouppi/database build
pnpm --filter @kouppi/server build
pnpm --filter @kouppi/web build
```

**Results (2026-07-23):** `rewardTime` + `rewards` = **15/15 passed**. Database + server `tsc` OK. Web production build OK after a small pre-existing `remoteGameStore` type widen.

---

## Local interactive setup

Terminal A:

```bash
pnpm --filter @kouppi/server dev
```

Terminal B:

```bash
pnpm --filter @kouppi/web dev
```

Open `http://localhost:3000`, register/sign in (Career auth), open **Reward Center** (`/rewards`).

---

## Manual scenarios

### Daily claim
1. Open `/rewards` while logged in → Daily Claim shows day 1 reward.
2. Click **Claim daily reward** → bankroll increases; feedback toast; streak = 1.
3. Click claim again → error “already claimed”; bankroll unchanged.
4. (DB) Set `last_daily_claim_date` to yesterday and `daily_streak` to 6 → claim → day 7 reward includes 1 token.
5. (DB) Set `last_daily_claim_date` to 3 days ago → claim → streak resets to 1.

### First win of day
1. Play a Career match to completion as winner → bankroll +100 (+80 XP) once; Reward Center shows First win **Claimed**.
2. Win again same UTC day → no second first-win grant.
3. Trigger duplicate game-end processing (reconnect / re-close) → ledger key `first_win:{user}:{date}` prevents double grant.

### Cosmetics wardrobe / apply
1. Claim a track level that grants a cosmetic (e.g. Midnight Felt / Classic Blue card back / title).
2. Open **Wardrobe** on `/rewards` → item shows owned; Equip → feedback “Cosmetic equipped”.
3. Start Career or multiplayer → **local** seat shows title/badge; avatar uses equipped frame/seat ring.
4. Face-down cards use equipped card back; chip stacks use gold-edge skin when equipped.
5. Table theme selector: locked themes disabled for logged-in users; selecting an owned theme equips server-side and updates felt.
6. Unlock respectful-nod emote → `🫡` appears in EmotePanel quick row.
7. Equip locked theme via API / Wardrobe → rejected (`COSMETIC_LOCKED`).
8. Two logged-in players in one Career or casual room: each sees the other’s title/badge/frame on seats and waiting lobby.
9. Equip a new title while seated → other client updates after `syncCosmetics` / roomUpdate (no rejoin).

### Daily missions
1. Fresh day → exactly 3 daily missions.
2. Finish Career matches → play/win/earn progress increments.
3. Claim a completed mission once → reward granted; second claim blocked.
4. Reroll one incomplete daily mission → succeeds; second reroll same day blocked.
5. After UTC midnight (or advance period key) → new 3 missions.

### Weekly missions
1. Exactly 3 weekly missions with larger rewards.
2. Progress persists across days within the same ISO week.
3. Claim once when complete.

### Season track
1. Earn XP via matches/missions → levels unlock to **claimable**.
2. Claim level once → **claimed**; duplicate claim blocked.
3. Confirm season id `S1` in footer / state.

### Wheel
1. Obtain a token (day-7 streak / track / weekly).
2. Token count visible in header.
3. Spin → consumes exactly 1 token; reward granted once.
4. With 0 tokens → Spin disabled / API returns `WHEEL_NO_TOKENS`.

### Achievements
1. Win first Career match → `first_career_win` completes and auto-grants once.
2. Reload Reward Center → still claimed; bankroll not increased again.

### UI
1. Entry points: home **Reward Center**, Career header **Rewards**, profile **Rewards**.
2. Mobile width (~375px): no severe overflow; missions scroll inside cards.
3. Displayed bankroll / tokens match `/api/rewards/state` after each action.

---

## Edge cases checklist

| Case | Expected |
|------|----------|
| Duplicate daily claim | 409 `DAILY_ALREADY_CLAIMED` |
| Duplicate first win | No second credit |
| Duplicate mission claim | 409 `MISSION_ALREADY_CLAIMED` |
| Duplicate track claim | 409 `TRACK_ALREADY_CLAIMED` |
| Wheel at 0 tokens | 409 `WHEEL_NO_TOKENS` |
| Unauthenticated `/api/rewards/*` | 401 |
| Single-player win | No Career reward grants |
| Stale client after claim | Re-fetch state; UI updates from response `state` |

---

## Useful SQL (local SQLite)

DB default: `apps/server/data/kouppi.db`

```sql
SELECT * FROM reward_user_state WHERE user_id = '...';
SELECT * FROM reward_ledger WHERE user_id = '...' ORDER BY created_at DESC LIMIT 20;
SELECT * FROM reward_unlocks WHERE user_id = '...';
SELECT * FROM reward_equipped WHERE user_id = '...';
UPDATE reward_user_state SET last_daily_claim_date = date('now','-1 day'), daily_streak = 6 WHERE user_id = '...';
```
