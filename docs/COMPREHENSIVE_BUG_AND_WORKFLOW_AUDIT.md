# KOUPPI Comprehensive Bug & Workflow Audit

**Audit date:** 2026-07-19  
**Scope:** Full repository scan (docs, apps, packages, tests, deploy configs).  
**Constraint:** No production behavior changes in this phase. Safe SHISTRI unit tests were added.  
**Auditor role:** Full-stack game engineer / QA / rules auditor / production investigator.

---

## Executive summary

Four user-reported issues are **confirmed with code evidence**:

1. **Green corner decorations** — themed potted-plant SVGs in `BackgroundProps`, enabled by default via `CasinoBackground` shells used on nearly every route.
2. **Single Player config reuse** — Zustand `useGameStore.ready` stays `true` after soft navigation Exit; no reset on leave/re-enter.
3. **SHISTRI rules** — engine eligibility/accounting is largely correct, but (a) MP/Career UI uses a wrong `abs(rank) >= 6` check, and (b) shipped stake percent is **5%** everywhere vs intended **7%**.
4. **Career “Failed to fetch”** — browser network failure on `POST {getServerUrl()}/api/auth/register` (server down / bad `NEXT_PUBLIC_SERVER_URL` / CORS / cold start), not account-validation logic.

Additional **P0** findings from prior docs + code verification:

- Career matchmaking callback/`runMatchmaking` loop is **not wired** in production server entry (only in unit tests).
- Career end-of-match rating update passes **absolute new rating** into an API that expects a **delta** → rating corruption.
- Free-tier SQLite on `/tmp` is ephemeral (Career/auth data wipe on restart).
- CI runs `pnpm -w test || true` — test failures do not fail the pipeline.

---

## Repository / documentation scan summary

| Area | Location | Notes |
|------|----------|-------|
| Frontend | `apps/web` | Next.js 14, Zustand, Socket.IO client |
| Game server | `apps/server` | Express + Socket.IO, authoritative rooms |
| Rules engine | `packages/game-core` | Shared SP + server |
| Contracts | `packages/protocol` | Zod message schemas |
| Persistence | `packages/database` | better-sqlite3 / SQLite |
| Docs | `docs/*.md` (16 files) | Seat UI, Career, DB/infra, deploy, QA |
| Tests | Vitest everywhere; Playwright dep but **no config/specs** | CI swallows failures |
| Deploy | Vercel (web) + Render (`render.yaml` / `render.free.yaml`) | Split architecture |

Docs read: all `docs/*.md`, `README.md`, `ToDO.txt`, `apps/web/MANUAL_ACTIONS.md`, deploy YAMLs, `.env.example`, CI workflow.

---

## Current app architecture relevant to these issues

```
Browser (apps/web @ Vercel)
  ├─ SPA routes + Zustand stores (gameStore, remoteGameStore, authStore, career*)
  ├─ CasinoBackground → BackgroundProps (plants / décor)
  ├─ Single Player: gameStore + game-core locally
  └─ Career/MP: REST + Socket.IO → getServerUrl() / NEXT_PUBLIC_SERVER_URL
           │
           ▼
apps/server (Render / local :4000)
  ├─ /api/auth/* → SQLite users (bcrypt + JWT)
  ├─ rooms.ts + game-core reducer (MP / Career table)
  ├─ career/queue.ts (in-memory; callback must be wired)
  └─ packages/database → DATABASE_PATH SQLite file
```

| Mode | Config UI | Rules engine | Auth/DB |
|------|-----------|--------------|---------|
| Single Player | `SettingsDialog` gated by `gameStore.ready` | Client `game-core` | None |
| Casual MP | Lobby / room presets | Server `game-core` | Optional |
| Career | AuthModal + matchmaking UI | Server `game-core` | Required |

---

## Previously identified bugs and status

See also `docs/KNOWN_ISSUES_RECONCILIATION.md` for full reconciliation.

| Prior issue | Source | Status (this audit) |
|-------------|--------|---------------------|
| Matchmaking not wired in production | DATABASE_AND_INFRA_AUDIT, SCALING | **Confirmed unresolved** (QA report claim is stale) |
| Ephemeral Free SQLite `/tmp` | DATABASE, RENDER_FREE | **Confirmed unresolved** (by design on free) |
| Rating absolute vs delta bug | DATABASE, SCALING | **Confirmed unresolved** |
| JWT default / sessions unused | DATABASE | **Confirmed unresolved** |
| Seat UI felt/rail / YOUR TURN / FAB | PLAYER_SEAT_* | **Partially fixed** (impl report); follow-ups remain |
| Production WS → localhost | DEPLOYMENT_AND_WEBSOCKET | **Partially mitigated** via `serverUrl.ts`; still fails if env wrong |
| CM-QA-007 unlimited quick-match gap | CAREER QA | **Open / product decision** |
| friends.test.ts UNIQUE flake | CAREER QA | **Unknown/unverified** this pass |
| Career bypasses rooms.ts | CAREER SUMMARY | **Likely partially fixed** (Sprint 1); not re-proven end-to-end |

---

## User-reported issue 1: green global decorations

### Finding table

| ID | Severity | User impact | Reproduction | Root cause/evidence | Exact files | Recommended fix | Test required | Status |
|----|----------|-------------|--------------|---------------------|-------------|-----------------|---------------|--------|
| UI-PLANT-001 | P2 | Green plant props on nearly all pages | Open `/`, `/career`, `/lobby`, etc. | Was: themes had `plants: true`. **Now:** all shipped themes `plants: false`; gate is `props.plants === true`; RTL proves no plant imgs | `BackgroundProps.tsx`; `tableThemes.ts`; `__tests__/plants.disabled.test.tsx` | Keep plants false; optional asset cleanup later | RTL + manual routes | **Fixed (POST-A Phase 1)** |

**Why all pages:** Not root `layout.tsx`. Almost every route uses `PreGameShell` or `LobbyShell` → `CasinoBackground` → `BackgroundProps`.

**Routes affected:** `/`, `/how-to-play`, `/privacy`, `/terms`, `/join`, `/lobby`, `/career`, `/leaderboard`, `/friends/stats`, `/room/[id]`, `/play/single`, `/3d-preview`.  
**Not affected:** bare `/play`, `/multiplayer` redirect stubs.

**Other décor (keep unless product wants strip):** chandelier, sconces, neon, distant people/tables, slots, bar silhouette, floor/vignette — same system, not plant-shaped.

**Cleanest removal:** flip `plants: false` in `tableThemes.ts` for all themes. No layout/footer structure change.

---

## User-reported issue 2: Single Player stale configuration

### Finding table

| ID | Severity | User impact | Reproduction | Root cause/evidence | Exact files | Recommended fix | Test required | Status |
|----|----------|-------------|--------------|---------------------|-------------|-----------------|---------------|--------|
| SP-CFG-001 | P1 | Re-entering SP skips SettingsDialog; resumes prior table | Start SP → Exit → Single Player again (no refresh) | `SettingsDialog open={!ready}`; `configureSinglePlayer` sets `ready: true`; Exit is `<Link href="/">` only; Zustand module singleton survives SPA nav; no `reset` API; refresh re-inits module → `ready: false` | `apps/web/app/play/single/page.tsx` L10–24; `apps/web/store/gameStore.ts` L18–84; `apps/web/components/TableGraphics.tsx` Exit links ~L219–238 | Add `resetSinglePlayer()` on `useGameStore` only; call on `/play/single` mount **and** unmount cleanup; optionally call before Exit navigate | Unit: reset clears `ready`; E2E1: re-entry shows config | Confirmed open |

**Not caused by:** localStorage for table settings (none); MP/Career stores; theme persist (`kouppi-ui-theme`) is separate.

**Exit paths that must reset:** HUD Exit, round-end Exit, browser Back, any soft nav away, Career “Practice” / Home re-entry. Prefer mount+unmount reset so all paths are covered without enumerating every link.

**Safe scope:** touch only `gameStore` — never `remoteGameStore`, `authStore`, `careerStore`, `careerLobbyStore`.

---

## User-reported issue 3: SHISTRI rules and implementation

### Rank model

`Rank = 1|…|13` with Ace=1, J=11, Q=12, K=13 (`packages/game-core/src/types.ts`).  
Core eligibility: `gapSize(up) === 1` ⇔ `abs(rank1-rank2) === 2` (`validators.ts`). **Correct.** No wrap-around.

### Economics (engine — correct mechanics)

Stake: `S = min(bankroll, pot, max(floor(percent/100 * pot), minChip))`.

| Outcome | Bankroll | Pot | `lastResolution.amount` |
|---------|----------|-----|-------------------------|
| **Win** | `B + P` | `0` | full pot `P` (stake never pre-debited) |
| **Loss** | `B − S` | `P + S` | stake `S` only |

Equivalent win model: “post stake then scoop pot including stake” nets `+P`.  
KOUPPI win also scoops whole pot but risks `P` on loss — distinct from SHISTRI.

### Finding table

| ID | Severity | User impact | Reproduction | Root cause/evidence | Exact files | Recommended fix | Test required | Status |
|----|----------|-------------|--------------|---------------------|-------------|-----------------|---------------|--------|
| SHI-UI-001 | P0 | MP/Career: legal SHISTRI hidden; illegal wide gaps shown | Career/MP table with A+3 vs 2+8 | `Math.abs(a.rank - b.rank) >= 6` instead of `canShistri` / `=== 2` | `apps/web/components/MultiplayerTableGraphics.tsx` L158–163 | Import/use `canShistri` from `@kouppi/game-core` (same as SP `TableGraphics.tsx` L54) | Unit + E2E2; server already rejects illegal | Confirmed open |
| SHI-PCT-001 | P1 | Stake is 5% not intended 7% | Any SHISTRI; how-to-play copy | Hardcoded `percent: 5` in defaults/presets/docs | `game-core` reducer/types; `gameStore.ts`; `roomPresets.ts`; `rooms.ts`; `serverFactory.ts`; `careerRoomManager.ts`; `remoteGameStore.ts`; `how-to-play/page.tsx` | Introduce named constant e.g. `SHISTRI_DEFAULT_PERCENT = 7`; update all defaults + copy | Unit stake tests already cover percent param; assert default=7 after fix | Confirmed open |
| SHI-ACC-001 | — | — | — | Win/loss accounting in reducer matches intended model | `packages/game-core/src/reducer.ts` L232–303 | Keep; document; ensure UI copy matches | Covered by new `shistri.test.ts` | Engine OK |
| SHI-SRV-001 | — | — | — | Server validates via `applyAction` | `rooms.ts` + reducer | Keep; optionally return hard error instead of soft no-op | Integration: ineligible rejected | Engine OK |
| SHI-BOT-001 | P3 | Bots always pick SHISTRI when eligible | SP with bots | `bot.ts` L66–68 | intentional aggressiveness? product decide | Unit bot policy | OK / product |

**Product note:** Changing 5%→7% is a **rules constant change**, not a bug in the formula. Confirm before shipping if any live rooms/docs should stay at 5.

**Accounting conflict flag:** None with win/loss semantics. Soft-fail illegal SHISTRI (state unchanged + history log, still may bump revision) is a reliability UX issue (P2).

---

## User-reported issue 4: Career signup “Failed to fetch”

### Request path

| Item | Value |
|------|--------|
| Method | `POST` |
| URL | `` `${resolveAuthApiBase().url}/api/auth/register` `` (Batch A) |
| Body | `{ username, password, avatar? }` |
| Client | `apps/web/store/authStore.ts` → `AuthModal` |
| Server | `apps/server/src/auth/routes.ts` → Zod → `createUser` → JWT |

`resolveAuthApiBase()` (`apps/web/lib/serverUrl.ts`): valid env or local `:3000→:4000` / localhost:4000 for auth. Production missing/invalid/localhost/frontend-origin configs **block** the request with a clear message (Batch A).

### Finding table

| ID | Severity | User impact | Reproduction | Root cause/evidence | Exact files | Recommended fix | Test required | Status |
|----|----------|-------------|--------------|---------------------|-------------|-----------------|---------------|--------|
| AUTH-NET-001 | P0 | Cannot create Career account | Career → Sign up with server down / bad env / CORS | `fetch` TypeError → `error.message` = `"Failed to fetch"`; not Zod/DB | `authStore.ts`; `serverUrl.ts`; CORS (`corsOrigins.ts`); Render `CORS_ORIGIN` sync:false; Vercel `NEXT_PUBLIC_SERVER_URL` | Ops: ensure server up + env; Code: use `resolveAuthApiBase` + actionable errors | Integration register against test server; E2E3 | **Partially fixed** — code done; ops pending |
| AUTH-UX-001 | P2 | Password not toggleable | Open AuthModal | Fixed `type="password"`; no show/hide | `AuthModal.tsx` | Accessible toggle (aria-label, keyboard, preserve value) like `CreateRoomDialog` | RTL a11y | Confirmed missing |
| AUTH-UX-002 | P3 | Opaque errors / weak client validation | Bad username regex only server-side | Client: length + confirm only | `AuthModal.tsx`; auth routes | Mirror server rules; clearer 409/400 messages | Integration | Confirmed |

**Local repro:** start web only → register → Failed to fetch; start server `:4000` → succeeds.  
**Prod repro:** Network tab host must be Render origin; check `/health/ready`; verify `CORS_ORIGIN` includes exact Vercel origin; wake free-tier if sleeping.

**Not root cause of “Failed to fetch”:** JWT missing, password validation, duplicate username (those return HTTP JSON).

---

## Broader gameplay / workflow findings

| ID | Severity | User impact | Reproduction | Root cause/evidence | Exact files | Recommended fix | Test required | Status |
|----|----------|-------------|--------------|---------------------|-------------|-----------------|---------------|--------|
| CAREER-MM-001 | P0 | Matchmaking never creates rooms in production | Two clients join career queue | `setOnMatchFound` / `runMatchmaking` never called from `server.ts`/`serverFactory.ts`; `tryFindMatch` drops callback if null; `handleMatchFound` exists but unwired | `queue.ts`; `careerRoomManager.ts` `handleMatchFound`; contrast `queue.test.ts` | Wire callback + periodic `runMatchmaking` in server boot; emit `career:matchFound` | Integration already partially exists; add regression that production factory wires callback | **Fixed (Batch A code)** — see `CAREER_BATCH_A_IMPLEMENTATION_REPORT.md` |
| CAREER-RATE-001 | P0 | Ratings explode/corrupt after matches | Finish career match | `updateRatingAndTrophies(userId, newRating, trophyChange)` but API does `user.rating + ratingChange` | `careerRoomManager.ts` ~L650–658; `users.ts` L259–272 | Pass `newRating - careerPlayer.rating` (delta) or change API to absolute | DB unit + career game-end integration | **Fixed (Batch A code)** |
| CAREER-DB-001 | P0 (ops) | Career accounts wiped on free Render restart | Deploy free tier | `DATABASE_PATH=/tmp/kouppi.db` | `render.free.yaml` | Document; use paid disk for real Career | Manual ops | By design / open |
| CI-SWALLOW-001 | P1 | Broken tests green in CI | Any failing test | `pnpm -w test \|\| true` | `.github/workflows/ci.yml` L20 | Remove `\|\| true` | CI | Confirmed open |
| EMPTY-CATCH-001 | P2 | Silent desync hard to debug | Leave/round-end race | Empty `catch {}` in serverFactory | `serverFactory.ts` ~316+ | Log structured errors | — | Confirmed |
| CAREER-FLOW-TEST-001 | P2 | False confidence | Read tests | `careerGameFlow.test.ts` is placeholder `expect(true)` | that file | Replace with real flow | Integration | Confirmed |
| SOFT-REJECT-001 | P2 | Illegal actions look accepted | Illegal SHISTRI/bet | Reducer returns cloned state; may still emit | `reducer.ts`; rooms emit path | Return explicit error to client | Integration | Open |
| CM-QA-007 | P2 | Unbalanced quick matches | Product | Open product decision | career filter/queue | Decide + implement | Unit | Open |

---

## UI / mobile / accessibility findings

| ID | Severity | User impact | Exact files | Recommended fix | Status |
|----|----------|-------------|-------------|-----------------|--------|
| UI-PLANT-001 | P2 | See issue 1 | BackgroundProps / themes | Disable plants | Open |
| AUTH-UX-001 | P2 | No password visibility | AuthModal | Add toggle | Open |
| SEAT-POLISH-001 | P3 | Popover/FAB/bet markers | PLAYER_SEAT impl report | Follow remaining checklist | Partial |
| MOBILE-MATRIX-001 | P3 | Unverified widths | Manual test doc blank | Run 320–1366 checklist | Unverified |
| A11Y-COLOR-001 | P3 | Status may be color-only | HUD / seats | Pair with text/icons | Unverified |

---

## Backend / database / infrastructure findings

| ID | Severity | Summary | Status |
|----|----------|---------|--------|
| CAREER-MM-001 | P0 | Matchmaking unwired | **Fixed (Batch A)** |
| CAREER-RATE-001 | P0 | Rating delta bug | **Fixed (Batch A)** |
| CAREER-DB-001 | P0 | Ephemeral free DB | Open (ops) |
| AUTH-NET-001 | P0 | Register connectivity/CORS/env | **Code fixed; ops pending** |
| JWT-SESS-001 | P1 | Sessions table unused; logout doesn’t revoke JWT | Open |
| REDIS-PKG-001 | P1 | Redis packages undeclared; multi-instance unsafe | Open |
| BACKUP-001 | P1 | No automated backups | Open |
| FK-PRAGMA-001 | P2 | Foreign keys pragma often off | Open |
| HEALTH-001 | P2 | `/health/ready` exists — use in auth preflight | Available |

---

## Test coverage findings

| Area | Coverage | Gap |
|------|----------|-----|
| game-core basic flow / invariants | Present | Was missing SHISTRI — **added** `packages/game-core/tests/shistri.test.ts` (25 tests, passing) |
| MP rooms / security / sprints | Strong | SHISTRI action acceptance/rejection integration thin |
| Career queue unit | Present | Production wiring not guarded by test |
| Career auth HTTP | Weak | No dedicated register/login suite |
| Career game flow | Placeholder | `expect(true)` |
| Single Player reset | None | Needs store reset API first |
| Playwright E2E | Dep only | No `playwright.config`, script echo-skips |
| CI | Broken contract | `\|\| true` |

---

## Prioritized bug list

### P0
1. ~~CAREER-MM-001 — Wire matchmaking~~ **Fixed Batch A**  
2. ~~CAREER-RATE-001 — Fix rating delta~~ **Fixed Batch A**  
3. SHI-UI-001 — Fix MP/Career SHISTRI eligibility UI  
4. AUTH-NET-001 — Unblock Career register (**code done**; **ops checklist pending**)  
5. CAREER-DB-001 — Persistent DB for real Career (ops)

### Batch A note (2026-07-19)

Implementation report: `docs/CAREER_BATCH_A_IMPLEMENTATION_REPORT.md`. Live Vercel/Render env was **not** verified from the agent environment.

### P1
6. SP-CFG-001 — Reset Single Player on exit/re-entry  
7. SHI-PCT-001 — Default SHISTRI percent 5→7 + constant  
8. CI-SWALLOW-001 — Fail CI on test failures  
9. JWT-SESS-001 / Redis / backups (infra)

### P2
10. UI-PLANT-001 — Remove plants  
11. AUTH-UX-001 — Password show/hide  
12. EMPTY-CATCH / soft-reject / careerGameFlow placeholder  

### P3
13. Seat polish, mobile matrix, bot SHISTRI aggressiveness, form UX nits  

---

## Recommended implementation order

See `docs/BUG_FIX_BACKLOG.md` for sprint batches.

1. **Batch A (Career unblock):** AUTH diagnostics + ops checklist; wire matchmaking; fix rating delta.  
2. **Batch B (Rules correctness):** SHI-UI-001; SHI-PCT-001 constant; expand integration tests.  
3. **Batch C (SP + UI):** SP-CFG-001 reset; UI-PLANT-001; AUTH password toggle.  
4. **Batch D (Quality):** CI fail-on-test; Playwright smoke; careerGameFlow real tests; empty-catch logging.

---

## Risk assessment

| Risk | Level | Notes |
|------|-------|-------|
| Career progression data integrity | **Critical** | Rating bug + ephemeral DB |
| Matchmaking dead in prod | **Critical** | Feature appears to work in tests only |
| SHISTRI unfair/unavailable in MP | **High** | UI gate wrong; server correct |
| Changing percent mid-flight | Medium | Document constant; migrate docs |
| Removing plants | Low | Decorative only |
| SP reset too aggressive | Low if scoped to gameStore |

---

## Exact unknowns / blockers

1. **Production env values** for live Vercel/Render (`NEXT_PUBLIC_SERVER_URL`, `CORS_ORIGIN`, whether free sleep) were not live-probed in this audit — need dashboard access or Network tab from deployed site.  
2. **Browser screenshot** of plants not attached in-repo; code evidence matches description.  
3. **Full two-browser Career E2E** not run (requires both apps + DB).  
4. Whether product wants SHISTRI at **7%** for all modes including existing how-to-play at 5% — confirm before Batch B.  
5. Playwright not configured — E2E planned, not executed.

---

## File map (issue areas)

| Issue | Primary files |
|-------|----------------|
| Plants | `BackgroundProps.tsx`, `CasinoBackground.tsx`, `tableThemes.ts`, `plant-*.svg`, `LobbyUI.tsx` |
| SP config | `play/single/page.tsx`, `gameStore.ts`, `SettingsDialog.tsx`, `TableGraphics.tsx` |
| SHISTRI | `validators.ts`, `reducer.ts`, `bot.ts`, `TableGraphics.tsx`, `MultiplayerTableGraphics.tsx`, presets/server defaults |
| Career auth | `AuthModal.tsx`, `authStore.ts`, `serverUrl.ts`, `auth/routes.ts`, `users.ts`, CORS, Render/Vercel env |
| Matchmaking | `queue.ts`, `careerSocketHandlers.ts`, `careerRoomManager.handleMatchFound`, missing wire in `serverFactory`/`server.ts` |
| Rating | `careerRoomManager.ts`, `packages/database/src/users.ts` |
