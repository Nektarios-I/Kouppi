# Reward System — Implementation Plan

## Architecture scan summary

KOUPPI is a pnpm monorepo:

| Package / app | Role |
|---------------|------|
| `apps/web` | Next.js 14 client (Zustand stores, LobbyShell UI) |
| `apps/server` | Express + Socket.IO authoritative multiplayer / Career |
| `packages/game-core` | Rules / reducer (bankroll in-match only) |
| `packages/protocol` | Zod socket contracts |
| `packages/database` | SQLite (`better-sqlite3`), users, matches, sessions |

**Economy today:** Career bankroll / rating / trophies persist in `users`. Arena `reward` metadata exists but is never credited. No daily/streak/mission/season/XP/wheel/achievement code existed before this work.

**Authoritative match end:** `handleCareerGameEnd` in `apps/server/src/career/careerRoomManager.ts` updates rating, trophies, bankroll, match stats, then emits `career:gameResults`. This is the primary hook for first-win + mission/XP progress.

**Auth:** JWT + SQLite sessions; client `authStore` + `requireAuth` middleware. Rewards require login.

**Reset / time helpers:** none existed — V1 introduces UTC period keys in the reward domain.

---

## Existing relevant systems

- `packages/database/src/users.ts` — bankroll absolute set; need **delta credit** for grants
- `packages/database/src/migrations.ts` — idempotent ALTER / CREATE pattern
- `apps/server/src/career/profileRoutes.ts` — REST pattern for authenticated APIs
- `apps/web/app/career/page.tsx` — Career hub integration point
- `apps/web/store/careerStore.ts` / `authStore.ts` — Zustand + fetch patterns
- `apps/web/components/game/LobbyUI.tsx` — visual language for Reward Center

---

## Exact files to create / modify

### Docs
- `docs/REWARD_SYSTEM_DESIGN.md` (reconstructed; was empty)
- `docs/REWARD_SYSTEM_IMPLEMENTATION_PLAN.md` (this file)
- `docs/REWARD_SYSTEM_SPEC_NORMALIZED.md`
- `docs/REWARD_SYSTEM_MANUAL_TEST.md`
- `docs/REWARD_SYSTEM_IMPLEMENTATION_REPORT.md`

### Database package (new reward domain)
- `packages/database/src/rewards/types.ts`
- `packages/database/src/rewards/config.ts`
- `packages/database/src/rewards/time.ts`
- `packages/database/src/rewards/ledger.ts`
- `packages/database/src/rewards/grant.ts`
- `packages/database/src/rewards/dailyClaim.ts`
- `packages/database/src/rewards/firstWin.ts`
- `packages/database/src/rewards/missions.ts`
- `packages/database/src/rewards/seasonTrack.ts`
- `packages/database/src/rewards/wheel.ts`
- `packages/database/src/rewards/achievements.ts`
- `packages/database/src/rewards/service.ts`
- `packages/database/src/rewards/schema.ts`
- `packages/database/src/rewards/index.ts`
- `packages/database/src/__tests__/rewards/*.test.ts`
- Modify: `packages/database/src/migrations.ts`, `packages/database/src/index.ts`, `packages/database/src/users.ts` (creditBankroll)

### Server
- `apps/server/src/rewards/routes.ts`
- Modify: `apps/server/src/serverFactory.ts` (mount `/api/rewards`)
- Modify: `apps/server/src/career/careerRoomManager.ts` (post-match reward hook)
- `apps/server/tests/rewards/*.test.ts`

### Web
- `apps/web/store/rewardStore.ts`
- `apps/web/components/rewards/*` (RewardCenter + section cards)
- `apps/web/app/rewards/page.tsx`
- Modify: `apps/web/app/career/page.tsx`, `apps/web/app/page.tsx` (entry points)

---

## Phased implementation plan

| Phase | Work |
|-------|------|
| 0 | Discovery + design reconstruction + this plan + normalized spec |
| 1 | Core domain: types, config, time, ledger, grant |
| 2 | Schema + migrations + persistence + HTTP routes |
| 3 | Daily claim + first win + Career hook |
| 4 | Daily + weekly missions + reroll |
| 5 | Season track XP + claims |
| 6 | Wheel tokens + spin |
| 7 | Achievements foundation |
| 8 | Reward Center UI + Career/home links |
| 9 | Unit/integration tests, typecheck/build, manual test + report docs |

---

## Assumptions / risks / blockers

### Assumptions (documented, not blockers)

1. **Empty design doc** → reconstructed design above; numeric values are tunable defaults.
2. **UTC resets** — chosen because no server timezone helper existed.
3. **Match-derived rewards = Career only** in V1 (single-player is client-authoritative).
4. **Mission completion is claim-based** (not auto-claim) for clearer anti-duplication UX.
5. **Weekly missions: no reroll** in V1.
6. **`creditBankroll` increments** chips; Career end still sets absolute bankroll from match, then reward deltas apply after.

### Risks

- Career game-end currently fires on room close; duplicate processing must be ledger-guarded (first-win key).
- Absolute `updateBankroll` after match could theoretically race with concurrent claims — SQLite single-writer mitigates locally; keep grants transactional where possible.

### Blockers

**None.** Auth + SQLite persistence + Career match end path exist and are sufficient for a safe V1.

---

## Proceed

Implementation continues immediately through Phases 1–9 unless a hard architectural conflict appears.
