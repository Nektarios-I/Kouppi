# POST-A UI & Workflow Master Plan

**Date:** 2026-07-20  
**Scope:** Product/code Phases 1–5 only.  
**Explicit out of scope for this whole initiative:** VM/database hosting migration, Render/Vercel env changes, Redis/multi-instance scaling, production secrets, live data, joining ranked Career games already in progress.

**Evidence rule:** Current working-tree code + tests beat older audit wording. Several Batch B/C/D/E changes exist **uncommitted** in the working tree and are **not** on `main` (`26f1904`). Treat them as local code that still needs phase-by-phase verification, tests, and reports—not as “already shipped.”

---

## Document reconciliation (Phase 0 findings)

| Source | Claim | Current code evidence (2026-07-20) | Verdict |
|--------|-------|--------------------------------------|---------|
| `COMPREHENSIVE_BUG_AND_WORKFLOW_AUDIT.md` | Plants / SP reset / SHI-UI / SHI-PCT “Confirmed open” | Working tree: `plants: false` all themes; `resetSinglePlayer` + mount reset; `canShistri` in MP; `SHISTRI_DEFAULT_PERCENT = 7` | **Audit text stale** for those four; code largely fixed locally |
| `BUG_FIX_BACKLOG.md` | UI-PLANT / SP-CFG / SHI-UI / SHI-PCT marked DONE | Matches working tree; not merged to remote `main` | **Locally done; deploy/merge still open** |
| `KNOWN_ISSUES_RECONCILIATION.md` | CI `\|\| true`, JWT sessions unused, no backups | Working tree already changed CI, JWT+sessions, backup scripts | **Reconciliation doc partially stale** |
| `PLAYER_WORKFLOW_TEST_PLAN.md` | Playwright echo-skip; default SHISTRI still 5 | Playwright config + smoke exist; default is 7 | **Stale on tooling/default** |
| `CAREER_BATCH_A_IMPLEMENTATION_REPORT.md` | Matchmaking wired in factory | Present in working tree + tests | **Code present locally; live deploy not verified** |
| `PLAYER_SEAT_UI_*` | Seat layout done; height/scroll matrix incomplete | Seats shared via `PokerTable` / `TableSeatLayout`; action dock still document-flow | **Useful for Phase 4; height fit still open** |

**Infra note:** User will migrate server/DB VM manually. This plan never proposes hosting changes.

---

## Phase 1 — Remove green plant decorations

**Issue IDs:** UI-PLANT-001

### Problem statement

Green plant SVG props appear (or appeared) across shared casino backgrounds and look inappropriate. They must not show on any supported theme/route.

### Current code evidence

- `apps/web/components/game/BackgroundProps.tsx` still contains plant rendering gated by `props.plants` (`plant-left.svg` / `plant-right.svg`).
- `apps/web/lib/tableThemes.ts`: **all active themes already set `plants: false`** (working tree).
- Shared shells: `CasinoBackground` → `BackgroundProps`; `LobbyShell` / `PreGameShell` use `CasinoBackground`.
- Test already present: `apps/web/__tests__/batchBC.fixes.test.tsx` asserts every theme has `plants: false`.
- SVG assets remain under `public/assets/props/`; optional cleanup only.

### Exact likely files

| File | Role |
|------|------|
| `apps/web/lib/tableThemes.ts` | Theme `props.plants` flags |
| `apps/web/components/game/BackgroundProps.tsx` | Conditional plant DOM |
| `apps/web/components/game/CasinoBackground.tsx` | Shell wiring |
| `apps/web/__tests__/batchBC.fixes.test.tsx` | Theme assertion |
| Optional: `public/assets/props/plant-*.svg` | Asset cleanup if unused |

### Desired behavior

No plant images in DOM/network for any current theme on `/`, `/career`, `/lobby`, `/play/single`, room routes. Other background props (lamps, bar, etc.) unchanged.

### Implementation approach

1. **Verify** every theme in `TABLE_THEMES` / exports has `plants: false` (already true in WT).
2. Keep the `props.plants && (…)`` gate in `BackgroundProps` (safe default if a future theme forgets).
3. Do **not** route-level `display:none` hacks.
4. Optionally delete unused plant SVGs only after grep proves zero references.
5. Extend/confirm RTL: themes + optionally render `BackgroundProps` and assert no `plant-left`/`plant-right` `src`.
6. Manual route checklist.

If verification finds any theme still `true`, flip to `false` only—no layout redesign.

### Alternatives considered and rejected

| Alternative | Why rejected |
|-------------|--------------|
| Delete plant JSX entirely | Unnecessary; gate is fine; harder to re-enable for a future theme |
| CSS hide plants per route | Fragile; misses shared shells |
| Remove all decorative props | Out of scope; changes look beyond plants |

### Regression risks

Low. Theme-only / prop-gate. Risk: accidentally disabling unrelated props (`lamps`, `bar`, etc.).

### Automated tests

- Keep/strengthen `batchBC.fixes.test.tsx` theme loop.
- Optional: mount `BackgroundProps` with classic theme → no plant `img[src*="plant"]`.

### Manual QA

- `/`, `/career`, `/lobby`, `/play/single`, one `/room/[id]` if available.
- DevTools: no plant SVG requests; lamps/other props still present where themes enable them.

### Acceptance criteria

- [ ] No green plants on any supported theme/route.
- [ ] Unrelated background visuals unchanged.
- [ ] Focused web tests pass.

### Dependencies / blockers

None. Independent of Phases 2–5.

### Explicit non-goals

No layout, footer, routing, theme picker UX, table felt, or game-logic changes. No infra.

### Estimated complexity

**Small** (likely verification + docs if WT already correct).

---

## Phase 2 — Fresh Single Player on every entry

**Issue IDs:** SP-CFG-001

### Problem statement

SPA navigation can leave Zustand `gameStore.ready === true`, so re-entry skips `SettingsDialog` and resumes stale SP state.

### Current code evidence

- `apps/web/store/gameStore.ts`: `resetSinglePlayer()` resets bootstrap state, `ready: false`, clears `botProfiles`.
- `apps/web/app/play/single/page.tsx`: `useLayoutEffect` calls `resetSinglePlayer()` on mount and cleanup on unmount.
- `SettingsDialog open={!ready}`.
- Unit test: `apps/web/__tests__/gameStore.reset.test.ts`.
- Exit links in `TableGraphics` still navigate away; lifecycle reset covers Exit / Back / Home if unmount runs.

### Exact likely files

| File | Role |
|------|------|
| `apps/web/store/gameStore.ts` | `resetSinglePlayer` |
| `apps/web/app/play/single/page.tsx` | Mount/unmount reset |
| `apps/web/components/SettingsDialog.tsx` | Config gate |
| `apps/web/__tests__/gameStore.reset.test.ts` | Store contract |
| Optional page test | Remount shows dialog |

### Desired behavior

Every entry to `/play/single` shows configuration; clean SP-only state; MP/Career/auth untouched.

### Implementation approach

1. Verify `resetSinglePlayer` clears all SP session fields (state, ready, botProfiles, and any transient fields added later).
2. Keep mount **and** unmount reset (covers all nav paths).
3. Confirm no `localStorage` SP persistence and no full page reload hacks.
4. Confirm `remoteGameStore` / career stores not imported or reset.
5. Strengthen tests if any gap (e.g. remount component test).
6. Manual: Exit, Home, Back, round-end Exit, entry from another mode.

### Alternatives considered and rejected

| Alternative | Why rejected |
|-------------|--------------|
| Reset only on Exit button | Misses Back / Home / deep links |
| `window.location` hard reload | Breaks SPA; heavier |
| Persist SP in `sessionStorage` keyed by visit | Unnecessary complexity |

### Regression risks

Medium-low: double-reset on Strict Mode double-mount (should stay `ready: false`—acceptable). Must not wipe theme preference if it lives outside SP store (theme is typically separate—verify).

### Automated tests

- Existing store reset test; extend if fields missing.
- Optional: render `/play/single` with configured store → unmount → remount → dialog open.

### Manual QA

Checklist in acceptance; no live server.

### Acceptance criteria

- [ ] Re-entry always shows setup.
- [ ] No stale bots/round/`ready`.
- [ ] MP/Career/auth unchanged.
- [ ] Start-after-configure still works.
- [ ] Tests pass.

### Dependencies / blockers

None. Independent.

### Explicit non-goals

No MP/Career store resets; no auth logout; no theme system redesign.

### Estimated complexity

**Small** (likely verification + gap fill).

---

## Phase 3 — SHISTRI consistency and stake display

**Issue IDs:** SHI-UI-001, SHI-PCT-001, plus new **SHI-STAKE-UI-001** (stake copy/layout)

### Problem statement

A) Defaults must be consistently **7%**.  
B) Eligibility UI must use shared `canShistri`.  
C) Players must see the **exact stake** beside the SHISTRI action with clear responsive copy—not a bare tiny number.

### Current code evidence

**Already in working tree (rules/eligibility):**

- `packages/game-core/src/types.ts`: `SHISTRI_DEFAULT_PERCENT = 7`.
- Defaults wired through reducer, `gameStore`, `roomPresets`, `rooms.ts`, `serverFactory`, `careerRoomManager`, `remoteGameStore`.
- `MultiplayerTableGraphics.tsx` and `TableGraphics.tsx` use `canShistri` + `shistriBet`.
- `how-to-play` mentions 7%.
- `packages/game-core/tests/shistri.test.ts` covers eligibility + stake math; illegal throws `IllegalActionError`.
- Grep: no remaining `percent: 5` defaults in app TS/TSX.

**Still incomplete vs this phase’s UI spec:**

- `GameActionPanel.tsx` shows:
  - label `SHISTRI`
  - eligible: `<span className="text-[10px]">{shistriAmount}</span>` only
  - **Missing:** `Risk: … (7% of pot)`, compact `SHISTRI · €35`, mobile `SHISTRI €35` + helper `7% of pot`
- No shared currency/format helper for “Risk” line; app mostly uses raw chip numbers (no € today—preserve existing chip convention unless product insists on €).
- Disabled state: amount hidden when ineligible (good); titles are thin (`Not eligible`).

### Exact likely files

| File | Role |
|------|------|
| `packages/game-core/src/types.ts` | Default percent |
| `packages/game-core/src/validators.ts` | `canShistri`, `shistriBet` |
| `apps/web/components/game/GameActionPanel.tsx` | Stake labels (desktop/laptop/mobile) |
| `apps/web/components/TableGraphics.tsx` | SP wiring |
| `apps/web/components/MultiplayerTableGraphics.tsx` | MP/Career wiring |
| `apps/web/app/how-to-play/page.tsx` | Copy audit |
| `apps/web/lib/roomPresets.ts` | Preset defaults |
| Server defaults | Already on constant—re-audit only |
| Tests: `shistri.test.ts`, `batchBC.fixes.test.tsx`, new GameActionPanel tests |

### Desired behavior

- One shared 7% default; configurable % still honored when config sets it.
- Eligibility = `canShistri` everywhere.
- Stake = `shistriBet(pot, percent, minChip)` capped by bankroll/pot as UI already does for amount.
- Responsive labels per product brief; never show playable stake when disabled.
- Server remains authoritative; illegal SHISTRI rejected (`IllegalActionError` / `illegal_action`).

### Implementation approach

1. Re-audit all defaults/copy for stray `5` / “5%”.
2. Confirm single exported constant; do not duplicate formulas—call `shistriBet`.
3. Upgrade `GameActionPanel` presentation only:
   - Desktop: `SHISTRI` + adjacent `Risk: {n} ({p}% of pot)` (chip formatting; use `€` only if product confirms—**decision needed**).
   - Narrow: `SHISTRI · {n}`.
   - Mobile: button `SHISTRI {n}` + optional helper `{p}% of pot`.
4. Pass `shistriPercent` into panel (from `state.config.shistri.percent`) so copy matches table config.
5. Keep confirm dialogs aligned with displayed stake.
6. Tests for labels + eligibility; rules tests already strong.

### Alternatives considered and rejected

| Alternative | Why rejected |
|-------------|--------------|
| Client-only % math | Drift from server |
| Change engine eligibility | Engine already correct |
| Hide SHISTRI when ineligible via removing button | Prefer disabled + reason (current pattern) |

### Regression risks

- Label overflow pushing PASS/BET/KOUPPI off-screen on small widths → must use responsive CSS carefully (ties lightly to Phase 4 but Phase 3 must not break dock).
- Accidental change of stake formula.
- MP confirm modal copy mismatch.

### Automated tests

- Keep default === 7 and eligibility matrix.
- Component: eligible shows stake + percent; ineligible no misleading stake; no `abs >= 6` in MP source (grep/test import path).
- Optional: snapshot/class assertions for compact breakpoints via container width if practical in jsdom (limited)—prefer RTL text content + CSS class presence.

### Manual QA

- SP + MP (or Career table if available): legal A–3 shows stake; illegal Q–A disabled.
- Resize desktop → laptop → mobile; labels match brief; no overflow of action row.

### Acceptance criteria

- [ ] Single 7% default source; no accidental default 5%.
- [ ] SP/MP/Career agree on eligibility + stake.
- [ ] Stake visible before act with responsive copy.
- [ ] No rules/security regression; tests pass.

### Dependencies / blockers

- Product: currency symbol (`€` vs raw chips)—see Decisions.
- Soft dependency on Phase 4 for cramped heights, but stake copy can ship first with compact CSS.

### Explicit non-goals

No bot SHISTRI policy change; no accounting rule change; no infra.

### Estimated complexity

**Medium** (rules mostly done; UI stake presentation is the real work).

---

## Phase 4 — Responsive game stage & always-visible actions

**Issue IDs:** MOBILE-MATRIX-001 (height extension), new **UI-VIEWPORT-001**

### Problem statement

On laptop heights (e.g. 1366×768), players may need document scroll to reach `YOUR MOVE`, while the table fills the first viewport. Core play must fit without page scroll.

### Current code evidence

- SP: `CasinoBackground` + `min-h-screen`; table `PokerTable` uses `aspect-[16/10]` (width-driven height).
- Action dock: `.game-action-dock { @apply mb-4; }` — in normal document flow below table (`globals.css`), not sticky-in-viewport shell.
- Shared: `TableGraphics` / `MultiplayerTableGraphics` → `PokerTable` + `GameActionPanel`.
- Seat system already width-breakpoint aware (`seatLayout` ResizeObserver); **not** a full height-budgeted game shell.
- `PLAYER_SEAT_UI_MANUAL_TEST.md` width matrix incomplete for systematic height fit.
- Chat/emote FABs exist in MP; known collision follow-ups in seat reports.

### Exact likely files

| File | Role |
|------|------|
| `apps/web/app/globals.css` | Dock/shell CSS, `dvh`, clamps |
| `apps/web/components/PokerTable.tsx` | Aspect / max height |
| `apps/web/components/TableGraphics.tsx` | SP shell composition |
| `apps/web/components/MultiplayerTableGraphics.tsx` | MP/Career shell |
| `apps/web/components/game/GameActionPanel.tsx` | Dock content density |
| `apps/web/components/game/CasinoBackground.tsx` | Outer height |
| Seat/chat/emote components | Collapse secondary UI |
| New: `docs/GAME_VIEWPORT_MANUAL_TEST.md` (or extend seat manual) | Matrix |
| Optional small layout helper / CSS vars | Height budget |

### Desired behavior

Viewport-aware shell (`100dvh` where appropriate): header compresses first; table scales by **available height and width**; `YOUR MOVE` always visible; secondary UI collapses; mobile sticky tray ≥44×44; no hover-only critical actions.

### Implementation approach

1. **Measure first (no code until approved):** map overflow culprits (aspect table + header + dock + banners + FABs).
2. Write a height budget model in the phase report (e.g. header ≤ X, dock ≤ Y, stage = remainder).
3. Introduce a controlled **game stage** layout (CSS Grid/Flex, `min-height: 0`, `max-height` on table wrapper, `clamp` / container queries).
4. Prefer scaling table via `max-height: …` + preserve aspect over shrinking action dock.
5. Collapse secondary: chat/emote into FABs already present; shorten banners; avoid hiding turn controls.
6. Do not blind `overflow: hidden` on body without accessible scroll regions for secondary panels.
7. Manual matrix at required sizes; document Playwright visual limits (smoke exists but not visual regression suite).

### Alternatives considered and rejected

| Alternative | Why rejected |
|-------------|--------------|
| Canvas/WebGL rewrite | Out of scope |
| Fix only 1366×768 media query | Brittle; violates brief |
| Remove action panel on small height | Unsafe gameplay |
| `overflow:hidden` on `html` only | Traps secondary content |

### Regression risks

High-ish UI risk: seat positions vs scaled table; FAB vs dock; iOS `dvh` quirks; MP chat drawers. Requires careful manual matrix.

### Automated tests

- Limited: unit tests for any pure layout math helpers; component “dock rendered when isMyTurn”.
- Do not fake screenshot automation.
- Extend manual test doc with pass/fail per size.

### Manual QA

Full matrix from brief (320×568 … 1920×1080) for SP + MP (+ Career if shared shell). Checklist: no document scroll for core play; table/cards/pot/seat/actions visible; no FAB cover; focus visible; touch targets.

### Acceptance criteria

- [ ] Core gameplay fits common laptop/monitor viewports without page scroll.
- [ ] Action dock always reachable.
- [ ] Mobile/tablet intentional compact layouts.
- [ ] Manual QA documented; automated tests where practical pass.

### Dependencies / blockers

- Best after Phase 3 stake labels (dock content height may grow).
- Seat layout already present—reuse, don’t rebuild.
- No infra.

### Explicit non-goals

No game-logic rewrite; no Canvas; no removing critical controls; no full Playwright visual CI overhaul unless separately approved.

### Estimated complexity

**Large**.

---

## Phase 5 — Career league entry & matchmaking feedback

**Issue IDs:** Career UX (new **CAREER-UX-001**); uses CAREER-MM-001 code if present; **does not** include CAREER-DB-001 / VM work.

### Problem statement

Selecting a league / Find Match can feel like nothing happened: weak immediate feedback, unclear searching state, cancel/error/timeout UX gaps. Need hybrid waiting-room model for **waiting tables only**, not late join to in-progress ranked games.

### Current code evidence

**Client (`CareerLobby.tsx` + `careerLobbyStore.ts`):**

- Flow: connect → select tier → ante “Find Match” → `joinQueue` → intended queue UI (“Searching for opponent…”) → cancel → match found → `gameRoomId` → `/room/...`.
- `isJoiningQueue` shows `…` on button while joining.
- Queue panel, match-found panel, waiting-room panel (`currentRoom`) **already exist** in UI code.
- **Critical bug (code):** server `career:joinAnte` does `cb ? cb(null, response) : socket.emit("career:queueJoined", …)`. Client **always** passes a callback and **ignores ACK payload**, only listening for `career:queueJoined`. Result: `queueState` often never set; `isJoiningQueue` may stick true → stuck `…` / no searching panel. This strongly matches “click does nothing / unclear.”

**Server:**

- Queue: `career:joinAnte`, `leaveQueue`, `getQueueStatus`; matchmaking wired in factory (Batch A WT).
- Waiting rooms: `findOrCreateRoom`, status `waiting` / reject non-waiting joins in places; `getRoomsByAnte` for waiting list exists server-side.
- Client does **not** currently expose Create Waiting Table / Join Waiting Table as first-class Career lobby actions (queue-first).

### Exact likely files

| File | Role |
|------|------|
| `apps/web/store/careerLobbyStore.ts` | Apply ACK; optimistic searching; errors |
| `apps/web/components/CareerLobby.tsx` | Immediate feedback, hybrid lobby UI |
| `apps/web/app/career/page.tsx` | Page shell |
| `apps/server/src/career/careerSocketHandlers.ts` | Prefer emit+cb or document ACK contract |
| `apps/server/src/career/careerRoomManager.ts` | Waiting-only join rules |
| `apps/server/src/career/queue.ts` | Queue semantics |
| Tests: careerLobbyStore + server career handlers | |

### Desired behavior

Per brief: Quick Match feedback with league name, elapsed time, cancel, connection errors; match-found transition; Create/Join **waiting** tables only if protocol safely supports; never join in-progress ranked games; no fake client match.

### Implementation approach (staged inside Phase 5)

**5A — Queue UX fix (likely no new protocol):**

1. On `joinQueue` success ACK: set `queueState` from response + clear `isJoiningQueue`; optionally still listen for events.
2. Server: emit `career:queueJoined` **and** invoke cb (or always emit)—small, safe contract fix.
3. Immediate optimistic UI: `Searching for {League}…` as soon as click (disable duplicate joins).
4. Elapsed timer from `queuedAt` / local start.
5. Cancel, reconnect, timeout messaging; clear ghost states on disconnect.

**5B — Hybrid waiting table UI:**

1. Audit whether create/list/join waiting Career tables already have socket APIs usable without late-join.
2. If yes: thin UI for Create / Join waiting only; server rejects `in-game`.
3. If incomplete: **stop and write protocol proposal**; wait for explicit approval before backend expansion (per user rules).

### Alternatives considered and rejected

| Alternative | Why rejected |
|-------------|--------------|
| Client-only fake “matched” | Forbidden |
| Allow join in-progress Career | Explicit non-goal |
| Full Career redesign | Out of scope |
| Redis/queue scaling | Infra out of scope |
| Change rating-gap algorithm | Document only unless forced bug (CM-QA-007 open) |

### Regression risks

- Double-handling ACK + event (idempotent set).
- Leaving ghost queue entries on cancel failure.
- Accidental exposure of in-progress games in a list UI.

### Automated tests

- Store: ACK applies queue state; duplicate join blocked; cancel clears; error clears loading.
- Server: joinAnte with cb still notifies client (emit+cb); leaveQueue; reject join when status ≠ waiting (for waiting-table path).
- No live Render/Vercel.

### Manual QA

- Authenticated local server: select Bronze → Find Match → see searching immediately → cancel → retry → match with second client if possible.
- Disconnect mid-search; error retry.
- If waiting tables approved: create/join waiting; cannot join started.

### Acceptance criteria

- [ ] Immediate clear feedback on league/ante action.
- [ ] Cancel/retry/searching clarity.
- [ ] Match-found → game transition.
- [ ] No ranked late join.
- [ ] Any new waiting-table backend explicitly approved + tested.

### Dependencies / blockers

- Local/server auth for manual QA (user handles VM; local temp DB OK for tests).
- Product decision on Create/Join waiting-table scope if protocol incomplete.
- CM-QA-007 rating gap: document, don’t silently change.

### Explicit non-goals

No VM/DB migration; no Redis; no spectators; no economy redesign; no join-in-progress.

### Estimated complexity

**Medium** for 5A; **Large** if 5B needs new protocol.

---

## Cross-phase summary

### Proposed implementation order

1 → 2 → 3 → 4 → 5  

Rationale: 1–2 are small/isolated; 3 adjusts dock content before 4’s height budgeting; 5 is Career-specific and independent of table layout but benefits from stable auth/matchmaking already in tree.

### Complexity

| Phase | Complexity | Independence |
|-------|------------|--------------|
| 1 Plants | Small | Fully independent |
| 2 SP reset | Small | Fully independent |
| 3 SHISTRI + stake UI | Medium | Independent of 1–2; mild affect on 4 |
| 4 Viewport shell | Large | Best after 3 |
| 5 Career UX | Medium–Large | Independent of 1–4 (codebase-wise) |

Phases 1, 2, and 5A can proceed in parallel in separate branches if desired; this initiative still runs **one approved phase at a time**.

### Decisions needed from you before / during implementation

1. **Phase 3 currency:** Use existing **chip numbers** (e.g. `Risk: 35 (7% of pot)`) or literal **`€`** as in the brief?
2. **Phases 1–2:** Accept “verify + close gaps” if working-tree already satisfies acceptance, vs force rewrite for ritual purity?
3. **Phase 5B:** Prefer **queue-only polish first (5A)** and defer Create/Join Waiting Table until a protocol proposal is approved, or require hybrid UI in the same phase if server already supports it?
4. Confirm **no infra/deploy** work in any phase (already assumed).

### Non-goals for entire initiative

- Server/DB VM migration, Render disk, env secrets, Redis multi-instance.
- Joining ranked Career games in progress.
- Full Career product redesign; rating-gap policy change without product decision.
- Unrelated refactors; commits/pushes unless requested.

---

## Recommended next action

Reply exactly: `APPROVE PHASE 1`
