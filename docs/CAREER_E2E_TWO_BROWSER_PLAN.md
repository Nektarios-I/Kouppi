# Career Mode — Two-Browser E2E Plan (Batch 3)

**Status:** Implemented locally in `apps/web/e2e/career-matchmaking.spec.ts` — not in CI yet.
**Depends on:** Tier-1 Career socket contracts (Batches 1–2) green on Node 20.

## Goal

Prove the full human path for Quick Join and Create/Join Waiting Table across two real browser contexts, against a **local** web app + game server (never production).

## Prerequisites

1. Node **20** (see `.tools/node-v20.19.0-win-x64` on Windows).
2. Temp SQLite: `DATABASE_PATH=%TEMP%\kouppi-career-e2e.db`
3. `JWT_SECRET=career-e2e-secret`
4. Server: `pnpm --filter @kouppi/server dev` (default `:4000`)
5. Web: `NEXT_PUBLIC_SERVER_URL=http://127.0.0.1:4000 pnpm --filter @kouppi/web dev`
6. Playwright already configured in `apps/web/playwright.config.ts` (web-only smoke today).

## Playwright project shape (proposed)

Add a second Playwright project (do **not** expand CI in this batch):

- `apps/web/e2e/career.two-player.spec.ts`
- `webServer` or documented dual-process start for **web + server**
- Two `browser.newContext()` sessions (Player A / Player B)
- Unique usernames `e2e_career_${Date.now()}_a|b`

## Scenarios

### E2E-CAREER-QJ-001 — Quick Match → Ready → start

1. A and B register/login on `/career`
2. Both select Bronze → Quick Match same ante
3. Assert searching UI, then match / waiting room
4. Both click Ready → assert countdown visible (~60s; optionally shorten via test-only env later)
5. Assert both navigate to `/room/career-game-*` with same id
6. Assert game UI receives state (not stuck on subscribe)

### E2E-CAREER-CT-001 — Create / Join waiting table

1. A creates waiting table
2. B joins from Live Waiting Tables
3. Both Ready → countdown → same game room
4. Assert double Create on A returns same table (idempotent)

### E2E-CAREER-CD-002 — Leave during countdown

1. Match or create+join
2. Both Ready
3. B leaves during countdown
4. Assert countdown clears; A back to waiting / not ready; no game start

## Explicit non-goals

- No production URLs / accounts
- No CI job expansion until local two-process E2E is stable
- No spectator mode
- Successful Create Waiting Table, Join, and Quick Match navigate to `/career/table/[id]`.
- The browser suite verifies the selected ante/bet configuration, seat count, refresh recovery, and that two Quick Match users reach the same table URL.

## Acceptance before implementing E2E code

- [ ] Local server + web documented in README or this file
- [ ] `CAREER-IT-NAV-001` green (dual-socket subscribe after transition)
- [ ] Manual smoke of Ready → start on two browsers once
