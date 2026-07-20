# KOUPPI Bug Fix Backlog

**Date:** 2026-07-19  
**Rule:** Implement in severity order; do not start until audit approval.  
**IDs** match `COMPREHENSIVE_BUG_AND_WORKFLOW_AUDIT.md`.

---

## Sprint / batch plan

| Batch | Goal | Items | Est. |
|-------|------|-------|------|
| **A** | Unblock Career | AUTH-NET-001 (code done / ops open), CAREER-MM-001 ✅, CAREER-RATE-001 ✅ | Large |
| **B** | Rules correctness | SHI-UI-001 ✅, SHI-PCT-001 ✅ | Medium |
| **C** | SP + UX | SP-CFG-001 ✅, UI-PLANT-001 ✅, AUTH-UX-001 ✅ | Medium |
| **D** | Quality gates | CI-SWALLOW-001 ✅, Playwright smoke ✅, CAREER-FLOW-TEST-001 ✅, EMPTY-CATCH-001 ✅, SOFT-REJECT-001 ✅ | Medium |
| **E** | Infra hardening | CAREER-DB-001 (ops open), JWT-SESS-001 ✅, REDIS-PKG-001 ✅, BACKUP-001 ✅ | Large / ops |

---

## P0 checklist

### [x] CAREER-MM-001 — Wire career matchmaking in production
- **Complexity:** medium  
- **Dependencies:** none (blocks Career play)  
- **Work:** In `server.ts` / `serverFactory.ts`: `setOnMatchFound((m) => handleMatchFound(m, io))`; start interval/`runMatchmaking`; ensure leave/cleanup.  
- **Files:** `apps/server/src/serverFactory.ts`, `server.ts`, `career/queue.ts`, `career/careerRoomManager.ts`  
- **Tests that prove fix:** Integration: two authenticated sockets join queue → both receive `career:matchFound` **without** test-only callback; unit asserting factory registers callback.  
- **Batch:** A  
- **Status:** **DONE (2026-07-19)** — `CAREER_BATCH_A_IMPLEMENTATION_REPORT.md`

### [x] CAREER-RATE-001 — Pass rating delta (not absolute) to `updateRatingAndTrophies`
- **Complexity:** small  
- **Dependencies:** none (data integrity)  
- **Work:** `updateRatingAndTrophies(userId, newRating - careerPlayer.rating, trophyChange)` **or** change DB API to accept absolute and update all callers. Prefer delta at call site to match existing DB tests.  
- **Files:** `apps/server/src/career/careerRoomManager.ts` ~L650–658; verify `packages/database/src/users.ts`  
- **Tests:** Unit: known before/after ratings; integration end-of-match rating change ≈ Elo delta, not `rating + newRating`.  
- **Batch:** A  
- **Status:** **DONE (2026-07-19)**

### [x] SHI-UI-001 — Fix MP/Career SHISTRI eligibility UI
- **Complexity:** small  
- **Dependencies:** none  
- **Work:** Replace `Math.abs(...) >= 6` with `canShistri(up)` from `@kouppi/game-core`.  
- **Files:** `apps/web/components/MultiplayerTableGraphics.tsx` L158–163  
- **Tests:** Existing `shistri.test.ts` for rules; add web/component or integration; E2E2 after Playwright.  
- **Batch:** B  
- **Status:** **DONE (2026-07-19)** 

### [~] AUTH-NET-001 — Career register connectivity + diagnostics
- **Complexity:** medium (ops + small code)  
- **Dependencies:** Deployed server health  
- **Work (ops):** Set Vercel `NEXT_PUBLIC_SERVER_URL`; Render `CORS_ORIGIN`; verify `/health/ready`; wake free tier. **STILL OPEN (human).**  
- **Work (code):** `resolveAuthApiBase` + actionable errors; refuse Vercel/localhost production fallbacks for auth. **DONE.**  
- **Files:** `apps/web/store/authStore.ts`, `apps/web/lib/serverUrl.ts`, deploy dashboards  
- **Tests:** IT-AUTH + authStore unit — **DONE.**  
- **Batch:** A  
- **Status:** **CODE DONE; OPS PENDING** — checklist in `CAREER_BATCH_A_IMPLEMENTATION_REPORT.md` 

### [~] CAREER-DB-001 — Persistent Career database (ops)
- **Complexity:** ops / medium  
- **Dependencies:** Paid Render disk or external volume  
- **Work:** Stop using `/tmp/kouppi.db` for real Career; use `render.yaml` disk path; document backup.  
- **Files:** `render.free.yaml` (docs only), `render.yaml`, `DATABASE_ACCESS_GUIDE.md`, `GAME_SERVER_DEPLOY.md`  
- **Tests:** Manual ops checklist; health `database: true` after restart.  
- **Batch:** E  
- **Status:** **DOCS/SCRIPTS DONE; PAID DISK STILL HUMAN OPS**

---

## P1 checklist

### [x] SP-CFG-001 — Reset Single Player on exit / re-entry
- **Complexity:** small  
- **Dependencies:** none  
- **Work:** Add `resetSinglePlayer()` to `gameStore` (`ready: false`, bootstrap state, clear botProfiles). Call on `/play/single` mount + unmount. Do not touch MP/Career stores.  
- **Files:** `apps/web/store/gameStore.ts`, `apps/web/app/play/single/page.tsx`  
- **Tests:** UT-SP-001; E2E1  
- **Batch:** C  
- **Status:** **DONE (2026-07-19)** 

### [x] SHI-PCT-001 — SHISTRI default percent 5 → 7 (configurable constant)
- **Complexity:** small  
- **Dependencies:** Product confirmation that 7% is final  
- **Work:** `export const SHISTRI_DEFAULT_PERCENT = 7` in game-core; replace all hardcoded `percent: 5` defaults; update how-to-play copy.  
- **Files:** `packages/game-core` types/reducer; `gameStore.ts`; `roomPresets.ts`; `rooms.ts`; `serverFactory.ts`; `careerRoomManager.ts`; `remoteGameStore.ts`; `how-to-play/page.tsx`  
- **Tests:** Update default assertion in `shistri.test.ts`; stake tests already parametric.  
- **Batch:** B  
- **Status:** **DONE (2026-07-19)** 

### [x] CI-SWALLOW-001 — Fail CI when tests fail
- **Complexity:** small  
- **Dependencies:** Fix or quarantine known flakes (`friends.test.ts`) first  
- **Work:** Remove `|| true` from `.github/workflows/ci.yml`.  
- **Tests:** CI itself  
- **Batch:** D  
- **Status:** **DONE (2026-07-19)** — friends re-request UNIQUE fix included

### [x] JWT-SESS-001 — Session revocation / JWT hygiene
- **Complexity:** medium  
- **Dependencies:** none  
- **Work:** Either wire `sessions` into `requireAuth` or stop writing unused rows; ensure logout invalidates; no default JWT secret in prod.  
- **Files:** `apps/server/src/auth/*`, `packages/database` sessions, `apps/web/store/authStore.ts`  
- **Tests:** Logout then `/me` fails; register with missing JWT_SECRET fails closed in prod.  
- **Batch:** E  
- **Status:** **DONE (2026-07-19)**

### [x] REDIS-PKG-001 / multi-instance honesty
- **Complexity:** large  
- **Dependencies:** product need for >1 instance  
- **Work:** Declare Redis deps or document single-instance only; queue still in-memory even with Redis.  
- **Batch:** E  
- **Status:** **DONE (2026-07-19)** — optionalDeps + docs; queue still in-memory

### [x] BACKUP-001 — Automated SQLite backups
- **Complexity:** medium  
- **Dependencies:** persistent disk  
- **Batch:** E  
- **Status:** **DONE (2026-07-19)** — scripts + docs; host scheduling is ops

---

## P2 checklist

### [x] UI-PLANT-001 — Remove green plant decorations
- **Complexity:** small  
- **Work:** `plants: false` on all themes (preferred) or delete plants block in `BackgroundProps`.  
- **Files:** `tableThemes.ts`, optionally `BackgroundProps.tsx`, SVG cleanup later  
- **Tests:** Manual / RTL absence of plant img src  
- **Batch:** C / POST-A Phase 1  
- **Status:** **DONE (2026-07-20 Phase 1)** — required `plants: boolean`; gate `=== true`; `plants.disabled.test.tsx`; SVG assets retained (gated, unused by shipped themes)

### [x] AUTH-UX-001 — Show/hide password on login & register
- **Complexity:** small  
- **Work:** Accessible button (`aria-label`), toggle `type`, keyboard, mobile, preserve value; both password fields on register.  
- **Files:** `apps/web/components/AuthModal.tsx` (mirror `CreateRoomDialog` pattern)  
- **Tests:** RTL; E2E3  
- **Batch:** C  
- **Status:** **DONE (2026-07-19)**

### [~] AUTH-UX-002 — Clearer client validation / errors
- **Complexity:** small  
- **Dependencies:** AUTH-NET-001  
- **Work:** Username regex/max length client-side; map 409/400; clear fields on mode switch carefully.  
- **Batch:** C  
- **Status:** **PARTIAL** — username regex/max length added on register; mode switch clears visibility toggles 

### [x] EMPTY-CATCH-001 — Log swallowed server errors
- **Complexity:** small  
- **Files:** `serverFactory.ts` empty catches  
- **Batch:** D  
- **Status:** **DONE (2026-07-19)**

### [x] CAREER-FLOW-TEST-001 — Replace placeholder careerGameFlow test
- **Complexity:** medium  
- **Dependencies:** CAREER-MM-001, CAREER-RATE-001  
- **Batch:** D  
- **Status:** **DONE (2026-07-19)**

### [x] SOFT-REJECT-001 — Explicit client error on illegal intents
- **Complexity:** medium  
- **Batch:** D  
- **Status:** **DONE (2026-07-19)** — `IllegalActionError` + intent `illegal_action` code

### [ ] CM-QA-007 — Quick-match rating gap product decision
- **Complexity:** product + small/medium  
- **Batch:** E / product  
- **Status:** **OPEN**
---

## P3 checklist

### [ ] SEAT-POLISH-001 — Remaining seat UI (popover, FAB, bet markers)
- **Source:** PLAYER_SEAT_UI_IMPLEMENTATION_REPORT  
- **Complexity:** medium  
- **Batch:** later  

### [ ] MOBILE-MATRIX-001 — Complete width checklist
- **Complexity:** small (manual)  

### [ ] SHI-BOT-001 — Review bot always-takes-SHISTRI policy
- **Complexity:** small / product  

### [ ] Optional plant asset cleanup
- Remove unused SVGs after UI-PLANT-001  

---

## Dependency graph (simplified)

```
AUTH-NET-001 (ops) ──┐
CAREER-MM-001 ────────┼──► Career E2E / IT-CAREER / CAREER-FLOW-TEST
CAREER-RATE-001 ──────┘
CAREER-DB-001 (ops) ──► durable progression

SHI-UI-001 ──► fair MP/Career SHISTRI
SHI-PCT-001 ──► product confirm first

SP-CFG-001 ──► E2E1
UI-PLANT-001 ──► independent
AUTH-UX-001 ──► independent (after AUTH modal still reachable)

CI-SWALLOW-001 ──► fix flakes first
Playwright setup ──► E2E1–5
```

---

## Suggested implementation batches (sprints)

### Sprint 1 — Batch A (Career unblock)
1. AUTH-NET-001 ops verification + auth error diagnostics  
2. CAREER-MM-001 wire matchmaking  
3. CAREER-RATE-001 rating delta  
4. IT-AUTH + IT-MM regression tests  

### Sprint 2 — Batch B (SHISTRI)
1. SHI-UI-001  
2. Product confirm → SHI-PCT-001  
3. Expand MP SHISTRI integration tests  

### Sprint 3 — Batch C (SP + UX)
1. SP-CFG-001  
2. UI-PLANT-001  
3. AUTH-UX-001 (+ AUTH-UX-002)  

### Sprint 4 — Batch D (Quality)
1. Quarantine/fix flakes; CI-SWALLOW-001  
2. Playwright config + E2E1, E2E3 smoke  
3. CAREER-FLOW-TEST-001; EMPTY-CATCH-001  

### Sprint 5 — Batch E (Infra)
1. Persistent DB / backups  
2. JWT session story  
3. Scaling honesty (Redis / single-instance)

---

## Definition of done (per item)

- [ ] Code fix merged  
- [ ] Automated test listed above passes in CI (after CI-SWALLOW-001)  
- [ ] Manual checklist item checked where E2E unavailable  
- [ ] Related docs updated (how-to-play, deploy guides) if user-facing  
