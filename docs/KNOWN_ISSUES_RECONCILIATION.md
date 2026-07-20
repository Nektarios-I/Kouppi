# KOUPPI Known Issues Reconciliation

**Date:** 2026-07-19  
**Purpose:** Map prior agent reports / docs to current code reality.  
**Statuses:** `confirmed fixed` | `confirmed unresolved` | `partially fixed` | `not verifiable` | `newly discovered regression` | `stale / superseded`

---

## Status legend

| Status | Meaning |
|--------|---------|
| confirmed fixed | Code/tests show issue resolved |
| confirmed unresolved | Code still exhibits the problem |
| partially fixed | Some aspects fixed; follow-ups remain |
| not verifiable | Cannot prove without deploy access / runtime |
| newly discovered regression | Found in this audit; not (clearly) in prior docs |
| stale / superseded | Doc claim outdated or contradicted by code |

---

## Infrastructure / database / deploy

| Issue | Source doc(s) | Status | Evidence (2026-07-19) |
|-------|---------------|--------|------------------------|
| Career `setOnMatchFound` / `runMatchmaking` not wired in production entry | `DATABASE_AND_INFRA_AUDIT.md`, `SCALING_ASSESSMENT.md` | **confirmed fixed (Batch A code)** | `createKouppiServer` registers callback + interval when DB initialized; tests in `matchmakingWiring.test.ts` |
| QA claim: matchmaking wired in `serverFactory` | `CAREER_MODE_QA_VALIDATION_REPORT.md` | **stale claim now accurate after Batch A** | Was false at audit time; code now matches the claim |
| Rating: absolute `newRating` passed as `ratingChange` | DATABASE, SCALING | **confirmed fixed (Batch A code)** | Call site passes `ratingDelta`; proven by `ratingDeltaContract.test.ts` + `ratingDeltaGameEnd.test.ts` |
| Free-tier SQLite `/tmp` ephemeral | DATABASE, RENDER_FREE, SCALING, ACCESS_GUIDE | **confirmed unresolved** | `render.free.yaml` still `DATABASE_PATH=/tmp/kouppi.db` |
| No automated backups | DATABASE, ACCESS_GUIDE | **confirmed unresolved** | No backup scripts/cron in repo |
| Redis packages undeclared; multi-instance unsafe | DATABASE, SCALING, GAME_SERVER_DEPLOY | **confirmed unresolved** | Dynamic import optional; queue still in-memory |
| JWT default secret / sessions unused for authz | DATABASE | **confirmed unresolved** | Sessions written on register; `requireAuth` JWT-primary (per prior audit; still accurate from auth flow read) |
| FK pragma off; cwd-relative DB paths; 1v1 match schema vs MP | DATABASE | **confirmed unresolved** / low priority | Documented; not re-deep-audited line-by-line |
| Production WS → localhost when env unset | `DEPLOYMENT_AND_WEBSOCKET_DIAGNOSIS.md` | **partially fixed** | Socket.IO still uses `getServerUrl()` with diagnostics; Career **auth** now refuses frontend/localhost production fallbacks via `resolveAuthApiBase` |
| Vercel lockfile / pnpm 9 mismatch | DEPLOYMENT diagnosis | **confirmed fixed** / superseded | Root `pnpm@10.12.4`; CI uses 10.12.4 |
| No `serverUrl.ts` / inconsistent helpers | DEPLOYMENT diagnosis | **confirmed fixed** | Central `serverUrl.ts`; auth/career use `getServerUrl()` |
| Paid vs free Render blueprint confusion | RENDER_FREE | **partially fixed** | Both YAMLs exist with comments; ops still easy to mix up |
| Cold start / sleep on free Render | RENDER_FREE, SCALING | **confirmed unresolved** (platform) | Expected free-tier behavior |
| CI `test \|\| true` | (noted in this audit; implied by weak CI culture) | **confirmed unresolved** / **newly emphasized** | `.github/workflows/ci.yml` L20 |

---

## Career mode

| Issue | Source doc(s) | Status | Evidence |
|-------|---------------|--------|----------|
| Career bypasses hardened MP rooms | `CAREER_MODE_SUMMARY.md` | **partially fixed** | Sprint 1 claimed shared rooms / join guards; `joinGuards.test.ts` exists; full bypass claim likely outdated |
| Trophy floor missing | CAREER SUMMARY / Sprint 1 | **partially fixed** | `trophyFloor.test.ts` + `updateRatingAndTrophies` floors exist |
| Socket identity weak | CAREER SUMMARY / Sprint 1 | **partially fixed** | Auth + join guards present; security tests partially stubby |
| Same-tier-only / unlimited quick-match gap (CM-QA-007) | CAREER QA, Sprint 2 | **confirmed unresolved** (product open) | Documented open decision |
| CM-QA-001..006 fixed | CAREER QA | **not verifiable** in full | Unit tests exist; production matchmaking wire still broken so end-to-end Career still blocked |
| `friends.test.ts` UNIQUE flake | CAREER QA | **not verifiable** | Not re-run to failure this pass |
| `careerGameFlow.test.ts` placeholder | This audit | **newly discovered** (test debt) | File asserts `expect(true)` |
| Career signup “Failed to fetch” | User report | **partially fixed (Batch A code)** | `resolveAuthApiBase` + actionable errors; live env still human-only |
| Password show/hide missing on AuthModal | User report / this audit | **newly discovered** | `AuthModal` fixed `type="password"` |

---

## Player seat UI

| Issue | Source doc(s) | Status | Evidence |
|-------|---------------|--------|----------|
| Seats on felt not rail; geometry | PLAYER_SEAT_UI_AUDIT | **partially fixed** | Implementation report + `PlayerSeat` / `seatLayout` tests exist |
| “Your turn” on every seat including bots | AUDIT | **partially fixed** | Impl report: seat YOUR TURN fixed; dealer copy may remain |
| No bet markers | AUDIT | **partially fixed** | Sparse markers remain per impl report |
| z-index / pot/card overlap | AUDIT | **partially fixed** | Layout work done; polish remain |
| FAB collisions | AUDIT / MANUAL_TEST | **confirmed unresolved** / follow-up | Listed remaining in impl report |
| Seat details popover | SPEC / IMPL report | **confirmed unresolved** | Remaining work |
| No seat tests at audit time | AUDIT | **confirmed fixed** | `PlayerSeat.test.tsx`, `seatLayout.test.ts` |
| Manual width matrix blank | MANUAL_TEST | **confirmed unresolved** | Still unverified systematically |

---

## Multiplayer / game rules

| Issue | Source doc(s) | Status | Evidence |
|-------|---------------|--------|----------|
| Early reconnect/presence/persistence planned | `Multiplayer-Log.md` | **partially fixed** | Sprint reconnect/hardening tests exist; not full persistence |
| SHI-UI-001 | MP/Career client eligibility `>= 6` | User report / this audit | **confirmed fixed (Batch B)** | `MultiplayerTableGraphics` uses `canShistri` |
| SHI-PCT-001 | Default 5% vs intended 7% | User report | **confirmed fixed (Batch B)** | `SHISTRI_DEFAULT_PERCENT = 7` |
| SP-CFG-001 | SP config persists after exit | User report | **confirmed fixed (Batch C)** | `resetSinglePlayer` + `/play/single` layout effect |
| UI-PLANT-001 | Global plant props | User report | **confirmed fixed (Batch C)** | All themes `plants: false` |
| AUTH-UX-001 | No password visibility toggle | User report / this audit | **confirmed fixed (Batch C)** | AuthModal show/hide |
| SHISTRI engine win/loss accounting | User report | **confirmed fixed** (engine correct) | `reducer.ts` win scoops pot; loss stake only; covered by new unit tests |
| Server validates SHISTRI | User report | **confirmed fixed** (enforcement present) | `applyAction` path |
| No SHISTRI unit tests | This audit | **confirmed fixed** (tests added) | `packages/game-core/tests/shistri.test.ts` (25 passing) — **coverage gap closed; product bugs remain** |

---

## Single Player / UI chrome

| Issue | Source doc(s) | Status | Evidence |
|-------|---------------|--------|----------|
| SP config persists after exit | User report | **confirmed fixed (Batch C)** | `resetSinglePlayer` + `/play/single` |
| Green corner plants on all pages | User report | **confirmed fixed (POST-A Phase 1)** | themes `plants: false`; gate `=== true`; `plants.disabled.test.tsx` |
| Asset READMEs / MANUAL_ACTIONS prop checklist | MANUAL_ACTIONS | n/a | Plants intentionally documented as props |

---

## Documentation freshness matrix

| Document | Freshness | Notes |
|----------|-----------|-------|
| `DATABASE_AND_INFRA_AUDIT.md` | **Current / accurate** | Matchmaking + rating findings reconfirmed |
| `SCALING_ASSESSMENT.md` | **Current** | Architecture limits still apply |
| `DATABASE_ACCESS_GUIDE.md` | **Current** | Ops guidance still valid |
| `GAME_SERVER_DEPLOY.md` | **Current** | Split deploy still required |
| `RENDER_FREE_DEPLOYMENT_PREP.md` | **Current** | Free vs paid still critical |
| `DEPLOYMENT_AND_WEBSOCKET_DIAGNOSIS.md` | **Partially stale** | pnpm/serverUrl improved; core split-host lesson remains |
| `CAREER_MODE_QA_VALIDATION_REPORT.md` | **Stale on matchmaking** | Do not trust “wired in serverFactory” |
| `CAREER_MODE_SUMMARY.md` | **Partially stale** | Early criticals partly superseded by Sprint 1 |
| `CAREER_SPRINT_1/2_SPEC.md` | Historical | Useful for intent; verify against code |
| `PLAYER_SEAT_UI_*` | Mostly current for remaining polish | Impl report is best status source |
| `Multiplayer-Log.md` | Historical scaffold | Low operational value |
| `README.md` | Partially current | Still lists career/e2e as roadmap items |

---

## Newly discovered in this audit (summary)

| ID | Summary |
|----|---------|
| UI-PLANT-001 | Global plant props |
| SP-CFG-001 | SP `ready` stale after SPA exit |
| SHI-UI-001 | MP/Career eligibility `>= 6` |
| SHI-PCT-001 | 5% vs 7% constant mismatch |
| AUTH-NET-001 | Register “Failed to fetch” — **code diagnostics fixed Batch A**; ops pending |
| AUTH-UX-001 | No password visibility toggle |
| CAREER-FLOW-TEST-001 | Placeholder game-flow test |
| CI-SWALLOW-001 | CI ignores test failures |

**Batch A (2026-07-19):** CAREER-MM-001 and CAREER-RATE-001 **confirmed fixed in code**. CAREER-DB-001 (ops) still open. See `CAREER_BATCH_A_IMPLEMENTATION_REPORT.md`.

---

## Reconciliation rules for future agents

1. Prefer **code + failing/passing tests** over QA “READY” claims.  
2. When a doc says “fixed in serverFactory,” **grep production entry** before believing it.  
3. Rating/trophy helpers: always check whether API expects **delta or absolute**.  
4. Career features that only pass with test-local `setOnMatchFound` are **not production-ready**.  
5. Update this file when Batch A–E items land.
