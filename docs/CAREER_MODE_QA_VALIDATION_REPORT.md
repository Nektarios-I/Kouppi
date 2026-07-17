# Career Mode QA Validation Report

**Date:** 2026-07-17  
**Scope:** Sprint 1 + Sprint 2 (Career shared rooms + queue matchmaking)  
**Validator:** Independent QA pass (automated + targeted integration)  
**Overall readiness:** **READY FOR INTERNAL TESTING** (not release candidate)

---

## Phase 0 — Environment Baseline

| Item | Result | Notes |
|------|--------|-------|
| Package manager | **PASS** | `pnpm@9.7.0` via `packageManager` field; installed globally to `%AppData%\Roaming\npm` |
| System Node | **BLOCKED on v25** | Host Node `v25.9.0` — `better-sqlite3` prebuild unavailable; compile requires VS C++ SDK |
| Project Node target | **PASS** | Added `.nvmrc` → `20`; portable Node `20.19.0` at `.tools/node-v20.19.0-win-x64` |
| Native deps | **PASS** (Node 20) | `better-sqlite3` + `bcrypt` restored via `prebuild-install` under Node 20 |
| Build | **PASS** | `pnpm build` (turbo, all 5 packages) |
| Database tests | **PASS** | 14/14 |
| Server tests | **PASS*** | 93/94 career-relevant; 1 unrelated pre-existing failure (`friends.test.ts` UNIQUE constraint) |
| Web tests | **PASS** | 41/41 including new `careerLobbyStore.test.ts` |
| Game-core / protocol | **PASS** | 3 + 6 tests |

### Commands (use Node 20)

```powershell
$env:Path = "C:\Users\User\Desktop\KOUPPI\kouppi\.tools\node-v20.19.0-win-x64;C:\Users\User\AppData\Roaming\npm;" + $env:Path
cd C:\Users\User\Desktop\KOUPPI\kouppi
pnpm install
pnpm build
pnpm --filter @kouppi/database test
pnpm --filter @kouppi/server test
pnpm --filter @kouppi/web exec vitest run
```

---

## Phase 1 — Architecture Audit (Static)

### Sprint 1 claims vs code

| Claim | Verified | Evidence |
|-------|----------|----------|
| Career uses shared `rooms.ts` | **PASS** | `triggerGameStart()` → `createRoomWithCreator`, `joinRoom`, `startRoom` |
| Career metadata stored | **PASS** | `matchType`, `tierId`, `anteId`, `careerRoomId` on room |
| Hidden from casual lobby | **PASS** | `listedInLobby: false` + `roomsInfo()` filter (`careerFilter.test.ts`) |
| Join-after-start blocked | **PASS** | `joinGuards.test.ts`, `rooms.ts` |
| Reconnect with session token | **PASS** (after fix) | Token-valid reconnect allowed; hijack without token → `slot_taken` |
| Trophy floor | **PASS** | `updateRatingAndTrophies` + 7 DB tests |

### Sprint 2 claims vs code

| Claim | Verified | Evidence |
|-------|----------|----------|
| Queue replaces instant ante join | **PASS** (server) | `career:joinAnte` → `joinQueue` |
| 2s matchmaking loop | **PASS** (after fix) | Wired in `serverFactory.ts` |
| Disconnect removes queue entry | **PASS** | `careerSocketHandlers` + integration test |
| Rating-based stages | **PASS** | `packages/database/src/rating.ts` |
| Client queue UI | **FAIL → FIXED** | Store/UI had regressed to Sprint 1; restored in this QA pass |
| Redirect to `/room/[id]` | **PARTIAL** | Navigation on `career:transitionToGame` after 30s auto-start, not at match-found |

---

## Validated Matchmaking Stages

Source: `packages/database/src/rating.ts` + `apps/server/src/career/queue.ts`

| Stage | Trigger | Server behavior | UI label |
|-------|---------|-----------------|----------|
| Initial | 0–14s wait | Both players must fit within dynamic range starting **±100**, expanding +50 every 5s (cap **±500**) | (no banner) |
| Expanded | ≥15s (either player) | Hard fallback **±250** | "Expanding Search Range" |
| Cross-tier | ≥30s | Hard fallback **±400** (~2 tiers) | "Searching All Leagues" |
| Quick match | ≥45s | **`return true` — any rating gap** | "Quick Match Mode" |

**Quick match is NOT a bot.** It matches any waiting human opponent with no maximum rating-difference ceiling.

---

## Phase 2 — Test Matrix (summary)

| Area | File | Level | Status |
|------|------|-------|--------|
| Trophy floors | `packages/database/src/__tests__/trophyFloor.test.ts` | Unit/DB | **PASS** |
| Matchmaking math | `packages/database/src/__tests__/matchmaking.test.ts` | Unit | **PASS** |
| Queue algorithm | `apps/server/tests/career/queue.test.ts` | Unit | **PASS** |
| Lobby filter | `apps/server/tests/career/careerFilter.test.ts` | Unit | **PASS** |
| Join guards | `apps/server/tests/career/joinGuards.test.ts` | Unit | **PASS** |
| Queue socket flow | `apps/server/tests/career/careerQueueIntegration.test.ts` | Integration | **PASS** |
| Store polling | `apps/web/store/careerLobbyStore.test.ts` | Component/store | **PASS** |
| Manual 2-browser E2E | — | Manual | **NOT COVERED** (integration tests substitute) |

---

## Bugs Found & Fixed

### CM-QA-001 — Matchmaking loop not active in `createKouppiServer`
- **Severity:** Critical
- **Status:** **Fixed**
- **Root cause:** Loop only in `server.ts`; tests/dev factory had no `setOnMatchFound` / `runMatchmaking`
- **Files:** `apps/server/src/serverFactory.ts`, `apps/server/src/server.ts`
- **Test:** `careerQueueIntegration.test.ts`

### CM-QA-002 — Client queue UI/store missing (Sprint 2 regression)
- **Severity:** Critical
- **Status:** **Fixed**
- **Root cause:** `careerLobbyStore.ts` / `CareerLobby.tsx` still used instant-room join; server returned queue payload
- **Files:** `apps/web/store/careerLobbyStore.ts`, `apps/web/components/CareerLobby.tsx`

### CM-QA-003 — Reconnect with valid token blocked by `slot_taken`
- **Severity:** High
- **Status:** **Fixed**
- **Files:** `apps/server/src/rooms.ts`
- **Test:** `joinGuards.test.ts`

### CM-QA-004 — Queue ignored selected `anteId`
- **Severity:** High
- **Status:** **Fixed**
- **Files:** `queue.ts`, `careerSocketHandlers.ts`, `careerRoomManager.ts` (`resolveMatchAnte`)

### CM-QA-005 — Match players created with `bankroll: 0`
- **Severity:** High
- **Status:** **Fixed**
- **Files:** `careerRoomManager.ts` (loads users from DB)

### CM-QA-006 — Queue reconnect returned `already_in_queue`
- **Severity:** Medium
- **Status:** **Fixed**
- **Files:** `careerSocketHandlers.ts`, `queue.ts`

### CM-QA-007 — Quick match allows extreme rating gaps
- **Severity:** High (fairness)
- **Status:** **Open — needs product decision**
- **Behavior:** At 45s+, `isMatchmakingCompatible` returns true for any pair (e.g. 800 vs 1900)
- **Tests:** `matchmaking.test.ts`, `queue.test.ts`
- **Recommendation:** Confirm intentional "Option C" or add ceiling/bot fallback

---

## Pre-existing / Out of Scope

| Item | Status |
|------|--------|
| `friends.test.ts` UNIQUE constraint on second friend request | **FAIL** — unrelated to Career; shared temp DB pollution |
| Host Node 25 without `.tools` Node 20 | **BLOCKED** for native SQLite tests |
| Full 45s manual timing scenarios | **NOT COVERED** — covered by injected clock in unit tests |

---

## Manual Smoke Checklist

1. Use Node 20: `$env:Path = "...\\.tools\\node-v20.19.0-win-x64;" + $env:Path`
2. `pnpm dev` (or server `:4000` + web `:3000`)
3. Create/login two Career accounts in separate incognito windows
4. Both select same league/ante → **Find Match**
5. Confirm queue UI (position, range, fallback banners after test clock or wait)
6. Confirm both get **Match Found** → waiting room → countdown → `/room/{gameRoomId}`
7. Confirm Career room absent from casual `/lobby` list
8. Cancel search / disconnect / refresh — no ghost matches
9. Casual single-player + multiplayer still launch

---

## Assumptions Requiring Approval

1. **Quick match (45s):** Accept unlimited human rating gap — keep or cap?
2. **Post-match flow:** 30s career waiting room before game room — keep or skip to immediate start?

---

*Report maintained during QA pass 2026-07-17.*
