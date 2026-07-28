# GAMEPLAY LIFECYCLE / ANTE / AVATAR — Implementation Plan

> Spec: `docs/GAMEPLAY_LIFECYCLE_ANTE_AVATAR_SPEC.md`

**Goal:** Implement result-reveal delay, bankrupt→spectator demotion, configurable ante progression, and avatar picker overflow fix across SP / MP / Career with tests.

**Architecture:** Keep game-core authoritative for settlement, completedRounds, and ante derivation. Server owns MP/Career timers, demotion, Stay/Leave. Clients render state and send intents. Avatar fix uses portal overlays (existing HistoryDrawer pattern).

**Tech stack:** TypeScript, `@kouppi/game-core`, `@kouppi/protocol`, Socket.IO server, Next/React web, Vitest.

## Global constraints

- No critical gameplay logic client-only for MP/Career.
- No scattered `setTimeout` for Stay/Leave transitions on clients.
- No `any`; no compounding ante mutation without derivation.
- Do not settle pot twice; demote only after settlement.
- Avatar: structural portal fix, not z-index-only.
- User paths for docs: this file + SPEC / MANUAL_TEST / IMPLEMENTATION_REPORT under `docs/`.

---

## File map

| Area | Create / Modify |
|------|-----------------|
| Timing + ante helpers | Create `packages/game-core/src/timing.ts`, `anteProgression.ts`; modify `types.ts`, `reducer.ts`, `index.ts` |
| Protocol | Modify `packages/protocol/src/messages.ts` |
| Server | Modify `serverFactory.ts`, `rooms.ts`, `types.ts`; Career `tiers.ts` / `careerRoomManager.ts` as needed |
| Web SP | `SettingsDialog.tsx`, `gameStore.ts`, `TableGraphics.tsx`, center cards |
| Web MP | `CreateRoomDialog.tsx`, `roomPresets.ts`, `WaitingRoom.tsx`, `MultiplayerTableGraphics.tsx`, `remoteGameStore.ts`, lobby listing |
| Avatar | `AvatarPicker.tsx`, `globals.css` |
| Tests | game-core, server, web vitest files |

---

### Task 1: Shared timing + ante progression core

**Files:**
- Create: `packages/game-core/src/timing.ts`
- Create: `packages/game-core/src/anteProgression.ts`
- Modify: `packages/game-core/src/types.ts`, `reducer.ts`, `index.ts`
- Test: `packages/game-core/tests/anteProgression.test.ts`, `timing` export check in reducer RoundEnd tests

**Produces:**
- `ROUND_RESULT_REVEAL_DELAY_MS = 3000`
- `DEFAULT_ANTE_PROGRESSION`, `deriveAnte(...)`, `normalizeAnteProgression(...)`
- `TableConfig.anteProgression`, `GameState.completedRounds`
- RoundEnd increments `completedRounds` once; `ante` action derives & charges

- [ ] **Step 1:** Add types + helpers + failing tests for formula
- [ ] **Step 2:** Wire reducer RoundEnd + ante
- [ ] **Step 3:** Run `pnpm --filter @kouppi/game-core test`

**Risk:** Medium (core economy). Mitigate with pure formula tests first.

---

### Task 2: Issue 1 — Server reveal delay + client presentation

**Files:**
- Modify: `apps/server/src/serverFactory.ts` (delay before `handleRoundEnd`)
- Modify: `apps/web/components/game/useCenterCardsPresentation.ts` (show lastResolution on RoundEnd)
- Modify: `apps/web/components/MultiplayerTableGraphics.tsx`, `TableGraphics.tsx`
- Test: `apps/server/tests/roundRevealDelay.test.ts` (new), web center-cards unit test

**Produces:**
- `scheduleFlowStep(roomId, ROUND_RESULT_REVEAL_DELAY_MS, () => handleRoundEnd(...))` when phase becomes RoundEnd
- Guard against duplicate schedules via existing flowTimer clear + decision.active
- SP delayed RoundEndPanel

- [ ] Implement server delay at all RoundEnd call sites consistently
- [ ] Fix center cards for RoundEnd + lastResolution
- [ ] Tests: decision starts only after delay; no double decision

**Risk:** High (sync). Keep timer only on server.

---

### Task 3: Issue 2 — Bankrupt demotion

**Files:**
- Modify: `apps/server/src/rooms.ts` — `demoteBankruptPlayersToSpectators(roomId)`
- Modify: `apps/server/src/serverFactory.ts` — call at start of `handleRoundEnd`
- Modify: client store/UI for bankrupt notice toast/banner
- Modify: SP `TableGraphics` bankrupt human/bot handling
- Test: `apps/server/tests/bankruptDemotion.test.ts`

**Produces:**
- Post-settlement scan; spectator join; personal event `playerBankruptRemoved` / system message
- Idempotent demotion; bots leave without spectator (if any)

**Risk:** High (membership). Run after settlement only; skip winners with bankroll > 0.

---

### Task 4: Issue 3 — Protocol + UI + Career preset

**Files:**
- Modify: `packages/protocol/src/messages.ts` RoomConfig
- Modify: `CreateRoomDialog.tsx`, `SettingsDialog.tsx`, `roomPresets.ts`, `WaitingRoom.tsx`, lobby meta if needed
- Modify: Career room creation to attach default progression
- Test: protocol parse defaults; server createRoom; game-core already covered

**Risk:** Medium. Defaults for missing fields.

---

### Task 5: Issue 4 — Avatar portal picker

**Files:**
- Modify: `AvatarPicker.tsx`, `globals.css`
- Optionally WaitingRoom layout tweak
- Test: `apps/web/__tests__/avatarPicker.portal.test.tsx`

**Risk:** Low–medium UI. Portal escapes `.lobby-card` overflow.

---

### Task 6: Regression docs + suite

- Run game-core, server, web unit tests; web lint; builds for touched packages
- Write `docs/GAMEPLAY_LIFECYCLE_ANTE_AVATAR_MANUAL_TEST.md`
- Write `docs/GAMEPLAY_LIFECYCLE_ANTE_AVATAR_IMPLEMENTATION_REPORT.md`

---

## Self-review (plan)

| Check | Mitigation in plan |
|-------|-------------------|
| Double pot settle | Delay only schedules Stay/Leave; settlement stays in reducer once |
| Duplicate reveal timers | `scheduleFlowStep` clears prior; `decision.active` early return |
| Bankrupt before settlement | Demotion only inside `handleRoundEnd` after RoundEnd already settled |
| Winner incorrectly removed | Scan `bankroll <= 0` only after settle |
| Ante reconnect drift | Derive from `startingAnte` + `completedRounds`, never compound alone |
| Non-host ante edits | No update API; create-time only; Career locked |
| Career fairness | Server preset progression only |
| Avatar clip | Portal/fixed, not z-index |
| Old rooms | `normalizeAnteProgression` defaults |

**Spec coverage:** Issues 1–4 mapped to Tasks 2–5; shared core Task 1; verification Task 6.
