# Career Matchmaking & Table Flow Audit

**Date:** 2026-07-22  
**Scope:** Phase 0 — evidence-based audit of CURRENT repository Career Quick Join, Create Waiting Table, Join Waiting Table, and pre-game countdown.  
**Constraint:** No production behavior changes in this phase.  
**Git HEAD at audit:** `29ace23` — `fix(career): unblock Create Waiting Table and Quick Match pairing`  
**Branch:** `main` (up to date with `origin/main`)

---

## 0. Executive verdict

| Flow | Socket/server path | Client UX path | vs product requirements |
|------|--------------------|----------------|-------------------------|
| Quick Join (two players, same ante) | **Works** when Career DB initializes and factory wires matchmaking | Searching UI → shared `/career/table/[id]` + Ready | **Verified** by two-browser Playwright |
| Create Waiting Table | **Works** (create + seat + ACK room payload) | Loading gate → `/career/table/[id]` + Ready | **Verified** including table config and refresh recovery |
| Join Waiting Table | **Works** for waiting rooms; rejects in-progress **and countdown** | Join from live list | **OK** for join lock (Batch 2); max 2 |
| 60s Ready → countdown → start | Both Ready → 60s → start | Implemented Batch 2 | **OK** (provisional product defaults) |

Historical risk **CAREER-MM-001** (unwired `setOnMatchFound` / `runMatchmaking`) is **fixed in current code** and covered by `matchmakingWiring.test.ts`.  
Historical **CAREER-FLOW-TEST-001** “placeholder `expect(true)`” is **stale** — `careerGameFlow.test.ts` now has real match + rating-delta tests.

---

## 1. Current architecture map

### 1.1 Quick Join

| Step | File | Symbol | Payload / contract | Status |
|------|------|--------|--------------------|--------|
| User click Quick Match | `apps/web/components/CareerLobby.tsx` | `AnteCard.onQuickMatch` → `handleJoinAnte(anteId)` | ante id e.g. `bronze-1` | **Implemented** |
| Store | `apps/web/store/careerLobbyStore.ts` | `joinQueue(token, anteId)` | Optimistic `queueState.inQueue=true`; emit `career:joinAnte` | **Implemented** |
| Socket emit | same | `socket.emit("career:joinAnte", { token, anteId }, cb)` | ACK: queue status or `{ matched: true, inQueue: false }` | **Implemented** |
| Server handler | `apps/server/src/career/careerSocketHandlers.ts` | `socket.on("career:joinAnte")` | Auth JWT; rating/bankroll; refuse if already in room | **Implemented** |
| Queue | `apps/server/src/career/queue.ts` | `joinQueue` → `tryFindMatch` | Same `anteId` required (post-`29ace23`); rating via `isMatchmakingCompatible` | **Implemented** |
| Matchmaking loop | `apps/server/src/serverFactory.ts` | `setOnMatchFound` + `setInterval(runMatchmaking, 2000)` when Career DB up | Production wiring | **Implemented** (proven by tests) |
| Room creation | `apps/server/src/career/careerRoomManager.ts` | `handleMatchFound(match, io)` | New `career-{8hex}` room; seats both; **ignores** queue `MatchFound.roomId` | **Implemented** |
| Match-found event | same | `io.to(socketId).emit("career:matchFound", { roomId, opponent })` | Same `roomId` to both | **Implemented** |
| Client listener | `careerLobbyStore.ts` | `career:matchFound` | Sets `matchFound`, clears queue | **Implemented** |
| Room state | same + `CareerLobby.tsx` | `career:roomUpdate` → `currentRoom` | Waiting UI on `/career` (not a separate route) | **Partial** vs product “table route” |
| Pre-game | `careerRoomManager.ts` | Waiting until both Ready; then 60s `starting` countdown | `career:setReady` + `career:autoStartTimer` | **Implemented (Batch 2)** |
| Game start | same | `triggerGameStart` → mark all Ready → `startRoom` / `career:transitionToGame` | Navigates client to `/room/{gameRoomId}` | **Implemented** (Batch 1 fixed `not_all_ready`; dual-socket subscribe remains) |
| Game page entry | `apps/web/app/room/[id]/page.tsx` | `subscribeToCareerRoom` if id starts with `career-game-` | Uses `remoteGameStore` socket (separate from Career lobby socket) | **Implemented** |

### 1.2 Create Table

| Step | File | Symbol | Payload | Status |
|------|------|--------|---------|--------|
| Click Create Waiting Table | `CareerLobby.tsx` | `handleCreateWaiting(anteId)` | — | **Implemented** |
| Store | `careerLobbyStore.ts` | `createWaitingRoom` | Sets `isJoiningRoom`; emit `career:createWaitingRoom` | **Implemented** |
| Server | `careerSocketHandlers.ts` | `career:createWaitingRoom` | Auth + eligibility; leave queue if queued; `createCareerRoom` + `joinCareerRoom({ socket })` | **Implemented** |
| ACK | same | `{ success, roomId, room: buildCareerRoomUpdatePayload }` | Room in ACK (fix in `29ace23`) | **Implemented** |
| Socket.IO room join | `careerRoomManager.joinCareerRoom` | `opts.socket.join(roomId)` before broadcast | Creator receives `career:roomUpdate` | **Implemented** |
| Client apply | `careerLobbyStore.ts` | sets `currentRoom` from ACK | Stays on `/career` | **Partial** (no `/career/[roomId]`) |
| Waiting UI | `CareerLobby.tsx` | `currentRoom` branch | League/ante, seats, Leave; no Ready control | **Partial** |

### 1.3 Join Waiting Table

| Step | File | Symbol | Payload | Status |
|------|------|--------|---------|--------|
| Browse list | `CareerLobby.tsx` + store | `browseAllWaitingRooms` → `career:listWaitingRooms` | Poll ~4s while idle | **Implemented** |
| Join click | same | `joinWaitingRoom(token, roomId)` | — | **Implemented** |
| Server | `careerSocketHandlers.ts` | `career:joinWaitingRoom` | Rejects missing / not waiting / rating / bankroll / already in room | **Implemented** |
| Seat | `joinCareerRoom` | starts auto-start if `players.length >= 2` and no timer | Status remains `"waiting"` during countdown | **Partial** — mid-countdown joins still allowed |
| Client | store ACK → `currentRoom` | — | **Implemented** |

---

## 2. Current behavior matrix

| Workflow step | Expected (product / provisional defaults) | Current code behavior | Evidence | Status |
|---|---|---|---|---|
| Unauthenticated Quick Join | Block with sign-in | Lobby shows “Sign in…”; no queue emit | `CareerLobby.tsx` L151–158 | **OK** |
| Authenticated Quick Join | Searching UI + Cancel | Optimistic search + `career:joinAnte`; Cancel → `leaveQueue` | store + Lobby | **OK** |
| Two-player Quick Join same pool | One room; both get same matchFound; leave queue | Works for same ante + compatible ratings | `matchmakingWiring.test.ts`, `careerQueueIntegration.test.ts` (Node 20) | **OK** |
| Duplicate Quick Join click | One queue entry | Client rejects if `isJoiningQueue \|\| queueState.inQueue`; server refresh if already queued | store L422–424; `queue.joinQueue` idempotent refresh | **Mostly OK** |
| Queue cancellation | Removed; no future match | `career:leaveQueue` + emit | handlers + integration disconnect test | **OK** |
| Queue disconnect | Cleanup | `disconnect` → `leaveQueue` + `handleDisconnect` | handlers L687–698 | **OK** |
| Match-found handling | Authoritative room id | Event + ACK `matched` path; ACK must not wipe matchFound | store `applyQueueJoined`; commit `29ace23` | **OK** |
| Route after match | Career table route | Stays on `/career` with waiting card | `CareerLobby.tsx` | **GAP** |
| Table created by Quick Join | Waiting / READY; no instant start | Room created; both not Ready; countdown after both Ready | Batch 2 | **OK** |
| Create Table click | One waiting room; navigate | Creates + seats; UI switches to `currentRoom` on same page | `waitingTables.test.ts` create ACK | **Partial** |
| Duplicate Create click | Idempotent or safe reject | Client `isJoiningRoom` gate; server `already_in_room` if seated | store + handlers | **Partial** (reject, not idempotent return) |
| Route after create | Career table route | No dedicated route | page.tsx / Lobby | **GAP** |
| Join waiting table | Compatible join while waiting | Works; locked during `starting` countdown | handlers + JT-001 | **OK** |
| Full table | Reject | Full at **2** players | `MAX_PLAYERS_PER_ROOM = 2` | **OK** |
| In-progress join | Reject | `status !== "waiting"` → error | handlers + test | **OK** |
| Ready state | Both must Ready before countdown | `career:setReady` + UI Ready button | Batch 2 | **OK** |
| 60s countdown | 60s after both Ready | `AUTO_START_DELAY_MS = 60000` | Batch 2 | **OK** |
| Auto start after countdown | Start once | `triggerGameStart` once; marks MP ready before `startRoom` | CD-001 | **OK** |
| Leave during countdown | Cancel; return to waiting | Cancel + clear remaining Ready + `career:countdownCancelled` | CD-002 | **OK** |
| Timer/queue cleanup | No leaks | Factory `stopCleanup` clears matchmaking interval; module `setInterval(cleanupStaleRooms)` always on | manager L959; factory L1864+ | **Partial** |
| Reconnect grace (waiting) | Preserve if supported | Disconnect immediately leaves Career waiting room; **no grace** | `handleDisconnect` → `leaveCareerRoom` | **MISSING** |
| Env / Node | Tests runnable | Node 25 breaks `better-sqlite3` ABI; Node 20 works | Audit run 2026-07-22 | **Env risk** |

---

## 3. Defect list

### CAREER-QJ-001 — Quick Match starts countdown without Ready
- **Severity:** P0 → **Fixed Batch 2**
- Match seats both not-Ready; countdown only after `career:setReady` from both.

### CAREER-CD-001 — Countdown is 30 seconds, not 60
- **Severity:** P1 → **Fixed Batch 2** (`DEFAULT_AUTO_START_DELAY_MS = 60000`)

### CAREER-CD-002 — Mid-countdown joins still allowed
- **Severity:** P1 → **Fixed Batch 2** (`status: "starting"` + `countdown_in_progress`)

### CAREER-JT-001 — Waiting tables sized for 8 players, not 2
- **Severity:** P1 → **Fixed Batch 2** (`MAX_PLAYERS_PER_ROOM = 2`)

### CAREER-CD-004 — Auto-start failed with `not_all_ready`
- **Severity:** P0 → **Fixed Batch 1** (retained)

### Batch 2 status (2026-07-22) — DONE

- Ready gate + 60s countdown + join lock + max 2.
- Protocol: `career:setReady`, `career:countdownCancelled`.
- UI Ready / Cancel Ready + countdown copy.

### Batch 3 status (2026-07-22) — DONE

- **CAREER-CD-003** — stale-room interval started/stopped via factory `stopCleanup`
- **CAREER-CT-002** — duplicate Create returns existing room (`idempotent: true`)
- **CAREER-NAV-001 / CT-001** — dedicated `/career/table/[id]` waiting route; dual-socket game path proven by `CAREER-IT-NAV-001`
- E2E plan written: `docs/CAREER_E2E_TWO_BROWSER_PLAN.md`

See `docs/CAREER_MATCHMAKING_IMPLEMENTATION_REPORT.md`.

---

## 4. Protocol contract audit

Career events are **ad hoc Socket.IO strings**, not Zod schemas in `packages/protocol` (protocol only lists `"career_queue"` / `"career_room"` message categories in `messages.ts`).

| Direction | Event/API | Payload | Auth | Handler | Expected ACK/event | Problems |
|---|---|---|---|---|---|---|
| C→S | `career:auth` | `{ token }` | JWT | handlers | ACK profile / `career:error` | OK |
| C→S | `career:getTiers` | `{ token }` | JWT | handlers | ACK tiers | Also HTTP `/api/career/tiers` fallback |
| C→S | `career:joinAnte` | `{ token, anteId }` | JWT | handlers | ACK queue **or** `{ matched:true }` | OK after `29ace23` |
| C→S | `career:leaveQueue` | `{ token }` | JWT | handlers | ACK / `career:queueLeft` | OK |
| C→S | `career:getQueueStatus` | `{ token }` | JWT | handlers | ACK status | OK |
| S→C | `career:queueJoined` | queue fields | — | emit | — | OK |
| S→C | `career:matchFound` | `{ roomId, opponent }` | — | `handleMatchFound` | — | OK |
| C→S | `career:createWaitingRoom` | `{ token, anteId }` | JWT | handlers | `{ success, roomId, room }` | OK |
| C→S | `career:listWaitingRooms` | `{ token, anteId? }` | JWT | handlers | `{ rooms }` + emit | OK |
| C→S | `career:joinWaitingRoom` | `{ token, roomId }` | JWT | handlers | `{ success, roomId, room }` | Rejects `starting` / in-progress |
| C→S | `career:setReady` | `{ token, ready }` | JWT | handlers | ACK room payload | **Batch 2** |
| C→S | `career:leaveRoom` | `{ token }` | weak (socket room map) | handlers | ACK | Allows leave during countdown |
| C→S | `career:getRoomInfo` | `{}` | socket map | handlers | room + ready + `secondsRemaining` | OK |
| S→C | `career:roomUpdate` | room payload | — | broadcast | — | Includes `ready` |
| S→C | `career:autoStartTimer` | `{ roomId, startsAt, secondsRemaining }` | — | timer start | — | 60s after both Ready |
| S→C | `career:countdownCancelled` | `{ roomId, reason }` | — | cancel path | — | **Batch 2** |
| S→C | `career:transitionToGame` | `{ careerRoomId, gameRoomId, config, snapshot }` | — | game start | Client stores `gameRoomId` | OK |
| S→C | `career:error` | `{ code, message }` | — | various | — | OK |
| C→S | `subscribeCareerRoom` | `{ roomId, playerId, … }` | player in game room | `serverFactory` | snapshot ACK | Dual-socket path (Batch 3) |
| — | **join Quick Match queue** | — | — | `career:joinAnte` | — | **Exists** (named joinAnte) |
| — | **leave/cancel queue** | — | — | `career:leaveQueue` | — | **Exists** |
| — | **queue status** | — | — | `career:getQueueStatus` | — | **Exists** |
| — | **match found** | — | — | `career:matchFound` | — | **Exists** |
| — | **create waiting table** | — | — | `career:createWaitingRoom` | — | **Exists** |
| — | **list waiting tables** | — | — | `career:listWaitingRooms` | — | **Exists** |
| — | **join waiting table** | — | — | `career:joinWaitingRoom` | — | **Exists** |
| — | **leave waiting table** | — | — | `career:leaveRoom` | — | **Exists** |
| — | **player ready** | — | — | — | — | **MISSING** |
| — | **countdown started/tick/cancelled** | started only | — | `career:autoStartTimer` | cancel via roomUpdate implied | **Partial** (no cancel/tick events) |
| — | **game started** | — | — | `career:transitionToGame` | — | **Exists** |
| — | **server error** | — | — | `career:error` + ACK err | — | **Exists** |

---

## 5. Timer and lifecycle audit

| Timer | Location | Start | Cleanup | Notes |
|-------|----------|-------|---------|-------|
| Matchmaking interval 2s | `serverFactory.ts` | If Career DB initialized | `stopCleanup` → `clearInterval` + `clearOnMatchFound` | **Production wired once per instance** |
| Auto-start timeout | `careerRoomManager.startAutoStartTimer` | 2+ players OR match found | `cancelAutoStartTimer` / `cleanupRoom` / game start nulls handle | Guard `if (autoStartTimer) clear` before reset; second player does not double-start if timer exists |
| Finished-room delay 5s | `markRoomFinished` | On finish | Fires `cleanupRoom` | Not cleared if process exits mid-delay |
| Stale room sweep 60s | **module load** `setInterval(cleanupStaleRooms)` | Always | **Never cleared** | CAREER-CD-003 |
| Empty MP rooms 30s | `serverFactory` cleanupInterval | Always | `stopCleanup` | Unrelated to Career queue |
| Client queue poll 2s | `careerLobbyStore.startQueuePolling` | On queue join | `stopQueuePolling` on match/leave/disconnect | Stops if `matchFound` |
| Client countdown display 1s | `CareerLobby` useEffect | When `autoStartAt` set | effect cleanup | Display only |
| Client waiting-list poll 4s | `CareerLobby` | Idle lobby | cleanup | OK |

**Verified:**
- Matchmaking callback wiring exists in real `createKouppiServer` path (not only unit tests).
- Immediate match path: `joinQueue` → `tryFindMatch` → callback (requires handler registered).
- Countdown starts once per room while `autoStartTimer` set; leave to `<2` cancels.
- Server restart: in-memory queue + career rooms **lost** (honest: no Redis/durable Career rooms).

**Not verified / gaps:**
- No fake-timer automated proof of start-at-T+60.
- Module stale interval open-handle risk in long test runs.
- No reconnect grace timer for Career waiting.

---

## 6. Test gap audit

### What existing tests prove

| Suite | Proves |
|-------|--------|
| `queue.test.ts` | Algorithm: ante isolation, rating windows, leave, callback once (uses **test-local** `setOnMatchFound`) |
| `matchmakingWiring.test.ts` | Factory wires handler; skipCareerDatabase does not; two sockets match **without** injected callback |
| `careerQueueIntegration.test.ts` | Production wiring matchFound same roomId; disconnect clears queue |
| `waitingTables.test.ts` | joinAnte ACK; create seats + roomUpdate; list without anteId; reject join when in-game |
| `careerGameFlow.test.ts` | Match via wiring + `handleCareerGameEnd` rating **delta** (not placeholder) |
| `careerLobbyStore.test.ts` | Optimistic queue; ACK apply; matchFound not wiped; create ACK; duplicate joinQueue blocked |
| `joinGuards.test.ts` | Career → shared `rooms.ts` join/start guards (game room layer) |

### Weak / stale / placeholders

- Docs claiming `expect(true)` in `careerGameFlow.test.ts` are **stale**.
- `matchmakingWiring` contains trivial `expect(hadManual).toBe(false)` — harmless noise, not a real placeholder suite.
- No fake-timer countdown tests.
- No WEB component tests for searching/create/wait UI (store-only).
- Playwright: **real config** `apps/web/playwright.config.ts` + `e2e/smoke.spec.ts` (homepage, SP dialog, Career auth modal). **Does not** start game server; **no** two-browser Career match E2E.

### Runnable now (server/socket IT)

With **Node 20** + temp SQLite + `createKouppiServer`: all Tier-1 matchmaking/create/join/error tests can be written against live local sockets.

### Needs browser E2E

- Visible searching copy, Cancel, create navigation, countdown UI, dual-context match → same table → Ready → start.
- Only after Tier-1 reliable; Playwright must launch web **and** server (`NEXT_PUBLIC_SERVER_URL`).

### Unrelated / env failures observed this audit

| Command | Result |
|---------|--------|
| Default `node` v25.9.0 + Career DB ITs | **FAIL** `better-sqlite3` ABI 115 vs 141 |
| `.tools/node-v20.19.0-win-x64` + `vitest run` matchmakingWiring + waitingTables + careerQueueIntegration | **PASS** 11 tests |
| `pnpm --filter @kouppi/web exec vitest run store/careerLobbyStore.test.ts` | **PASS** 6 tests |
| Prior Batch A note | `friends.test.ts` UNIQUE flake may still fail full server suite (not re-run this pass) |

---

## 7. Proposed test plan

Use isolated temp DB, real `createKouppiServer`, Socket.IO clients, **fake timers** for countdown (never sleep 60s). Prefer Node 20.

### Tier 1 — Server/socket (implement with Batch 1+)

1. **CAREER-IT-QJ-001** — Two auth clients Quick Join → one room, same `matchFound.roomId`, both out of queue, both in room, waiting state; no duplicate room after extra `runMatchmaking` ticks; `stopCleanup` + disconnect.
2. **CAREER-IT-QJ-002** — Rapid double `joinAnte` → single queue entry.
3. **CAREER-IT-QJ-003** — Cancel leaveQueue + disconnect cleanup; peer cannot match ghost.
4. **CAREER-IT-CT-001** — Create Bronze waiting table; one room; creator seated; status waiting; duplicate create idempotent **or** `already_in_room`.
5. **CAREER-IT-JT-001** — Second player joins; reject nonexistent / full / in-progress / unauth / ineligible.
6. **CAREER-IT-CD-001** — Both Ready (after Ready exists) → countdown 60 once; advance 59s no start; 60s start once; both get `transitionToGame`.
7. **CAREER-IT-CD-002** — Countdown then leave/disconnect → cancel; advance past 60 → no start.
8. **CAREER-IT-ERR-001** — Defined ACK/`career:error` codes; no hang.

*Until Ready exists, CD tests should assert **current** 30s / 2-seat behavior as characterization tests, then flip expectations in the Ready batch.*

### Tier 2 — Frontend/store

9. **CAREER-WEB-QJ-001** — Searching state, disabled duplicate, Cancel, error restore, matchFound → expected navigation helper.
10. **CAREER-WEB-CT-001** — Creating state, double-click gate, success room apply, failure restore.
11. **CAREER-WEB-WAIT-001** — Waiting room fields, countdown display, leave, gameRoomId navigation.

### Tier 3 — Playwright

12. Smoke already executable (web only). Propose two-context Career E2E **after** Tier-1 green; do not expand CI in Phase 0.

---

## 8. Proposed implementation plan (do not implement until approved)

### Batch 1 — Tests-first characterization + harden existing paths
- **Goal:** Lock current working Quick Join / Create / Join contracts; add missing IT gaps that do not require Ready yet; fix doc staleness.
- **Files:** new/extended `apps/server/tests/career/*`; `careerLobbyStore.test.ts`; docs.
- **API:** none (or tiny test helpers only).
- **Risk:** Low.
- **AC:** CAREER-IT-QJ-001..003, CT-001, JT-001 (current behavior), ERR-001 green on Node 20; audit §6 updated.

### Batch 2 — Ready gate + 60s countdown + join lock
- **Goal:** Both present + Ready → 60s countdown once; cancel on leave; reject joins during countdown; Career max players = 2 for ranked waiting/quick.
- **Files:** `careerRoomManager.ts`, `careerSocketHandlers.ts`, `careerLobbyStore.ts`, `CareerLobby.tsx`, protocol comments/docs.
- **API:** add `career:setReady` (+ optional `career:countdownCancelled`).
- **Tests first/alongside:** CD-001, CD-002, WEB-WAIT-001.
- **Risk:** Medium (behavior change vs current auto-30s).
- **AC:** Product provisional defaults for Ready/60s/cancel; no mid-countdown join; no double start.

### Batch 3 — Navigation / socket cohesion + E2E plan
- **Goal:** Decide table route vs in-lobby waiting; strengthen transition/`subscribeCareerRoom` IT; optional minimal Playwright two-context plan.
- **Files:** web routes/Lobby; possibly shared socket; docs reports.
- **Risk:** Medium if route added; low if documenting in-lobby as accepted.
- **AC:** CAREER-NAV addressed per product decision; E2E plan written; no CI expansion unless required.

### Explicitly out of batches
- Ratings/trophies/SHISTRI policy, Redis/multi-instance queue, Render disk, CORS/env production ops, spectator mode, redesign Career page.

---

## 9. Decisions needed from product owner

1. **Ready gate:** Confirm provisional default — both must click Ready before countdown (current code has **no** Ready).
2. **Countdown length:** Confirm **60s** (code is **30s**).
3. **Disconnect during countdown:** Confirm **cancel** (current) vs pause + reconnect grace. Career waiting today has **no** reconnect grace.
4. **Player count:** Confirm **2** for Career ranked Quick Match / waiting tables (code allows **8** and starts timer at 2+).
5. **Table route:** Require `/career/table/[id]` (or similar) vs accept in-lobby waiting on `/career`.
6. **CM-QA-007:** Keep unlimited rating gap after 45s wait, or cap?
7. **Duplicate Create:** Prefer idempotent return of existing room vs hard `already_in_room`?

**Provisional defaults used for planning (per task brief):**  
2 players; both Ready; 60s countdown after both Ready; disconnect cancels countdown and returns remaining player to waiting; no late join after start; server authority mandatory.

---

## 10. Confirmed evidence notes (git / history)

- `29ace23` fixed: Socket.IO join before broadcast; room in create ACK; queue ACK must not wipe `matchFound`; same-ante pairing; hydration on Career page date.
- Batch A previously fixed production matchmaking wiring + rating delta.
- Docs under `docs/DATABASE_AND_INFRA_AUDIT.md` / older comprehensive audit still describe unwired matchmaking in places — **prefer this document + source** over those sections.

---

### Batch 1 status (2026-07-22) — DONE

- Added `careerFlowContracts.test.ts` covering CAREER-IT-QJ-001..003, CT-001, JT-001, CD-001/002 (+ fake-timer cancel unit), ERR-001.
- Extended `careerLobbyStore.test.ts` for CAREER-WEB-QJ/CT/WAIT characterization.
- Minimal production fix: CAREER-CD-004 (`not_all_ready` on auto-start).
- Test helpers: `setAutoStartDelayMsForTests`, `clearAllCareerRoomsForTests`, `getAutoStartDelayMs`.

See `docs/CAREER_MATCHMAKING_IMPLEMENTATION_REPORT.md`.

---

## 11. Phase / batch status

- Audit + Batch 1 + Batch 2 + Batch 3 complete.
- **Product decision superseded (2026-07-22):** Pre-game UX now uses `/career/table/[id]`, matching casual multiplayer's URL-driven room flow. Dual Career-lobby + game-room sockets remain covered by `CAREER-IT-NAV-001`.
- Remaining open product only: CAREER-QJ-002 (rating gap after 45s); CAREER-TEST-002 (use Node 20 locally).
- E2E: `apps/web/e2e/career-matchmaking.spec.ts` (implemented locally, not CI).
