# Career Batch A Implementation Report

**Date:** 2026-07-19  
**Batch:** A — Unblock Career Mode safely  
**Status:** Code + tests complete; live Render/Vercel configuration remains a **manual** step (not verified from this environment).

---

## Scope and non-goals

### In scope (completed in code)

1. **CAREER-MM-001** — Wire Career matchmaking in the real `createKouppiServer` production path.
2. **CAREER-RATE-001** — Pass rating **delta** into `updateRatingAndTrophies`.
3. **AUTH-NET-001 (code)** — Safer Career auth URL resolution + actionable network errors + HTTP auth integration tests.
4. Focused unit/integration tests proving the three fixes.
5. Manual deployment handoff checklist (below).

### Explicitly out of scope (later batches)

- SHI-UI-001, SHI-PCT-001  
- SP-CFG-001 (Single Player reset)  
- UI-PLANT-001  
- AUTH-UX-001 (password visibility)  
- CI-SWALLOW-001 / Playwright  
- CAREER-DB-001 (paid disk / persistent DB)  
- Redis / multi-instance  
- Broad refactors  

---

## Root causes addressed

| ID | Root cause | Fix |
|----|------------|-----|
| CAREER-MM-001 | `setOnMatchFound` / `runMatchmaking` only used in unit tests; production factory never registered `handleMatchFound` | Factory registers callback + 2s interval when Career DB is actually initialized; `stopCleanup` clears interval + callback |
| CAREER-RATE-001 | `handleCareerGameEnd` passed absolute `newRating` into API that does `user.rating + ratingChange` | Compute `ratingDelta = newRating - previousRating` and pass delta |
| AUTH-NET-001 | Generic `Failed to fetch`; auth used `getServerUrl()` which could silently target Vercel origin in production when env missing | `resolveAuthApiBase()` refuses bad production fallbacks; actionable UI message + safe console diagnostic; preserve 400/401/409 messages |

---

## Exact files changed

### Production / app code

| File | Change |
|------|--------|
| `apps/server/src/serverFactory.ts` | Wire matchmaking when DB initialized; cleanup; `careerMatchmakingWired` flag |
| `apps/server/src/career/queue.ts` | `clearOnMatchFound`, `hasMatchFoundHandler` |
| `apps/server/src/career/careerRoomManager.ts` | Rating delta call site; `markRoomInGame` also sets `careerGameMapping` |
| `apps/server/src/auth/routes.ts` | Structured server logs on register/login 500 (no secrets) |
| `apps/web/lib/serverUrl.ts` | `resolveAuthApiBase`, `formatAuthNetworkError`, `mapAuthHttpError`, `readAuthJsonResponse` |
| `apps/web/store/authStore.ts` | Use auth URL resolver; classify network vs HTTP errors |

### Tests added/updated

| File | Purpose |
|------|---------|
| `apps/server/tests/career/matchmakingWiring.test.ts` | Factory wiring + two-socket match without injected callback |
| `apps/server/tests/career/ratingDeltaGameEnd.test.ts` | `handleCareerGameEnd` stores Elo delta result |
| `apps/server/tests/auth.http.test.ts` | Register/login/duplicate/invalid against temp DB |
| `packages/database/src/__tests__/ratingDeltaContract.test.ts` | Delta vs absolute contract |
| `apps/web/__tests__/authStore.test.ts` | Client network/HTTP/non-JSON/missing-env |
| `apps/web/__tests__/serverUrl.test.ts` | Extended auth URL resolution cases |
| `apps/server/tests/career/careerQueueIntegration.test.ts` | Assert production handler present (no test inject) |

---

## Matchmaking wiring design

```
createKouppiServer()
  └─ if careerDbInitialized (real getDatabase success, not skipCareerDatabase):
       setOnMatchFound(match => handleMatchFound(match, io))  // once
       setInterval(runMatchmaking, 2000)                      // once
  └─ stopCleanup():
       clearInterval(cleanupInterval)
       clearInterval(matchmakingInterval) if any
       clearOnMatchFound()
```

- Immediate matches still occur inside `joinQueue` → `tryFindMatch` when a compatible peer is already waiting (callback must be set).
- Periodic `runMatchmaking` covers expanding search windows over time.
- MP tests using `skipCareerDatabase: true` do **not** start the matchmaking interval (no handle leaks).
- `server.ts` continues to call `createKouppiServer({ corsOrigin })` — no separate wiring needed in the entry file.

---

## Rating delta contract before/after

| | Before | After |
|---|--------|-------|
| Helper | `updateRatingAndTrophies(userId, ratingChange, trophyChange)` → `rating + ratingChange` | **unchanged** |
| Career call site | `updateRatingAndTrophies(id, newRating, trophyChange)` | `ratingDelta = newRating - previousRating`; pass `ratingDelta` |
| Example | 1300 + 1312 → **2612** (corrupt) | 1300 + 12 → **1312** (correct) |

Verified in tests at 1300 equal opponents: winner 1312 (+12), loser 1288 (−12).

---

## Auth connectivity/error handling before/after

| Scenario | Before | After |
|----------|--------|-------|
| Network down | UI: `Failed to fetch` | UI: `Unable to reach the KOUPPI game server…` (+ short safe reason) |
| Missing `NEXT_PUBLIC_SERVER_URL` on Vercel | May POST to Vercel origin | **No fetch**; clear config diagnostic |
| Localhost URL in production | Fetch localhost | Blocked for auth |
| HTTP 400 / 409 / 401 | Server `error` string | Unchanged / still distinguished from network |
| Non-JSON 502 | Possible JSON parse throw → opaque | Actionable unexpected-response message |
| Passwords / JWTs in UI | Not shown | Still not shown; server 500 logs omit secrets |

Local `:3000` → `:4000` and explicit `NEXT_PUBLIC_SERVER_URL` for valid hosts remain supported.

---

## Tests added

See table above. Focused Batch A suites: **all passing**.

---

## Exact commands run and results

Environment: Windows, Node from `.tools/node-v20.19.0-win-x64`, pnpm 10.12.4.

| Command | Result |
|---------|--------|
| `pnpm --filter @kouppi/database test` | **PASS** (17 tests) |
| `pnpm exec vitest run` (Batch A server files) | **PASS** (9 tests) |
| `pnpm --filter @kouppi/server test` | **FAIL** 1 pre-existing: `tests/friends.test.ts` UNIQUE constraint (`decline and remove friend`); **107 other server tests passed** including all Batch A |
| `pnpm --filter @kouppi/web exec vitest run` | **PASS** (73 tests) |
| `pnpm --filter @kouppi/game-core test` | **PASS** (28) |
| `pnpm --filter @kouppi/protocol test` | **PASS** (6) |
| `pnpm -w build` | **PASS** (turbo 5 packages; Next.js typecheck included) |

**Pre-existing failure (not introduced by Batch A):**  
`apps/server/tests/friends.test.ts` → `UNIQUE constraint failed: friend_requests.from_user_id, friend_requests.to_user_id` — documented in prior CAREER QA / audit as a known flake; Batch A did not modify friends code.

Live Vercel/Render register was **not** exercised (no dashboard access).

---

## Known remaining limitations

- AUTH-NET-001 **ops** half: user must set Render `CORS_ORIGIN` + Vercel `NEXT_PUBLIC_SERVER_URL` and redeploy (see checklist).
- Free Render SQLite remains ephemeral (CAREER-DB-001).
- Career matchmaking still in-process memory (no Redis queue).
- `friends.test.ts` UNIQUE failure still fails full server suite.
- CI still uses `pnpm -w test || true` (CI-SWALLOW-001, later batch).

---

# Manual deployment checklist

These steps can **only** be completed in your Render and Vercel dashboards. This environment cannot set or verify them.

## 1. Render (game server)

Set these environment variables on the KOUPPI server service:

| Key | Format / source | Notes |
|-----|-----------------|-------|
| `NODE_ENV` | `production` | Required |
| `CORS_ORIGIN` | `https://kouppi-web-nektarios-is-projects.vercel.app` | Exact origin, **no** trailing slash. Comma-separate if you also allow localhost for debugging (e.g. `https://kouppi-web-nektarios-is-projects.vercel.app,http://localhost:3000`). Do **not** use `*`. |
| `JWT_SECRET` | Long random secret from Render “generate” or your password manager | Never commit; never paste into chat |
| `DATABASE_PATH` | Free: `/tmp/kouppi.db` · Paid disk: `/var/data/kouppi.sqlite` | Free = ephemeral |
| `PORT` | Leave unset on free Render (platform injects). Paid blueprint may set `4000` | Prefer platform `PORT` on free |

**Verify health (replace host with your service URL):**

```text
GET https://<render-service>.onrender.com/health/ready
```

Expect JSON with `"ok": true` and `"database": true`.

**Reminders:**

- Free Render may sleep; first request can take 30–60+ seconds (wake-up).
- Free-tier SQLite under `/tmp` is wiped on restart/redeploy — not for durable Career data.

## 2. Vercel (frontend)

| Key | Value format |
|-----|----------------|
| `NEXT_PUBLIC_SERVER_URL` | `https://<render-service>.onrender.com` |

Rules:

- **Production** environment (and Preview if you test preview deployments).
- **No** trailing slash.
- **No** `/health/ready` or `/api` suffix — origin only.
- After changing the variable, **redeploy** the frontend (build-time inlining).

## 3. Browser verification

1. Open: `https://kouppi-web-nektarios-is-projects.vercel.app/career`
2. Create Account with a **new** test username.
3. DevTools → Network: request must be  
   `POST https://<render-service>.onrender.com/api/auth/register`  
   (host = Render, **not** Vercel, **not** localhost).
4. Success: HTTP **201**, JSON `{ "success": true, "token": "...", "user": { ... } }` (token present; no password fields).
5. If it fails, check in order:
   - Network request **host**
   - Browser console (`[Career Auth]` warnings are safe diagnostics)
   - Render logs
   - `CORS_ORIGIN` exact match to the Vercel origin you opened
   - `/health/ready`
   - Free-tier sleep/cold start (retry after wake)
