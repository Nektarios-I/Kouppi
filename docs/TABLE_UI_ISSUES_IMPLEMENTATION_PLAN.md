# KOUPPI Table UI Issues — Implementation Plan

**Date:** 2026-07-24  
**Status:** Implemented (2026-07-24) — T2/T3/T1a/T1b/dealer label/T4a + tests green.  
**Depends on:** `docs/TABLE_UI_ISSUES_ANALYSIS.md`  
**Product decisions:** dealer kept + “Dealer” label; result copy panel-only (left rail ≥1024 / FAB &lt;1024); local chips use `sm` denom labels like bots; compact YOUR MOVE OK.

---

## Goals

1. Remove center-felt status/result clutter; surface history/status in a dedicated left (or equivalent) panel.
2. Delete decorative legacy red/gray dealer-tray chips.
3. Make local bankroll chip discs show denomination labels consistently with opponents (where readable).
4. Keep full table + all seats visible when `GameActionPanel` (“YOUR MOVE”) is mounted.

**Non-goals:** game-core rules, server protocol, SHISTRI math, reward economy, rewriting seat geometry unless required for dock clearance.

---

## Recommended implementation order

| Order | Task | Risk | Rationale |
|------:|------|------|-----------|
| 1 | T2 — Remove decorative dealer tray discs | Low | Isolated visual; no state |
| 2 | T3 — Local chip label consistency | Low–Med | Small shared change; verify dock clearance |
| 3 | T4a — Viewport/dock fit for YOUR MOVE | High | Unblocks usable play; shared shell |
| 4 | T1a — Disable/relocate center ribbon | Med | Unblocks felt clarity; uses existing log |
| 5 | T1b — Left history/status panel | Med–High | Depends on product answers; builds on log data |
| 6 | T1c — Bot-area status relocation | Low–Med | Depends on confirming which block |
| 7 | T5 — Docs/tests/manual matrix update | Low | After behavior locked |

Do **not** ship T1b before T1a decisions. T4a can proceed in parallel with T2/T3 after answers on compact dock (Q6–Q7).

---

## Ordered tasks

### T2 — Remove legacy red/gray dealer chips

**Risk:** Low  
**Depends on:** none  
**Modes:** Shared (`PokerTable`)

**Files likely to modify**
- `apps/web/components/PokerTable.tsx` — remove disc row (and optionally unused tray wrapper)
- Optionally trim related comments only

**Work**
1. Delete the five `#c03030` / `#f5f5f5` ornamental discs under the dealer tray.
2. Decide whether to keep the thin rail bar (recommended: keep bar, remove discs).
3. Confirm no other live path renders those colors as chips.

**Avoid**
- Touching `components/chips/*` or `ChipAnimation.tsx` unless cleaning dead preview-only imports later (out of scope).

---

### T3 — Local player chip denomination labels

**Risk:** Low–Medium  
**Depends on:** product answer on label style (analysis Q5)  
**Modes:** Shared hero path (`isLocal`)

**Files likely to modify**
- `apps/web/components/chips/PlayerChipStack.tsx` — size / dense policy for `isLocal`
- Possibly `apps/web/components/chips/PokerChip.tsx` — only if enabling xs labels (usually avoid)
- Possibly `apps/web/components/chips/ChipStack.tsx` — if using `showExactLabel` for hero total
- `apps/web/__tests__/chips.components.test.tsx` — assert local size/label behavior
- `apps/web/app/globals.css` — only if stack clearance tweaks needed

**Work (recommended default if Q5 = match bots)**
1. Desktop/tablet local: use `sm` (or same as non-local) so `PokerChip` `showLabel` is true.
2. Keep `dense` if needed for dock clearance.
3. Mobile: choose policy — either labeled `sm` scaled down, or keep `xs` + `showExactLabel` under stack.
4. Visually check hero stack vs `PlayerSeat` name and `.game-stage-dock`.

**Avoid**
- Changing decompose / transfer logic.
- Forcing `showExactLabel` on all contexts (pot already has its own label UI).

---

### T4a — YOUR MOVE / table visibility

**Risk:** High  
**Depends on:** Q6 (compact strip OK?), Q7 (target viewport)  
**Modes:** Shared stage CSS + both shells

**Files likely to modify**
- `apps/web/app/globals.css` — `--game-chrome-h`, `.game-stage-table-region`, `.game-action-dock-inner`, short-height media queries
- `apps/web/components/game/GameActionPanel.tsx` — optional compact header / density props
- `apps/web/components/TableGraphics.tsx` / `MultiplayerTableGraphics.tsx` — only if dock wrapper needs a visibility class (e.g. `data-dock="open"`) for CSS
- `apps/web/components/game/CasinoBackground.tsx` — only if shell flex contract wrong
- `docs/GAME_VIEWPORT_MANUAL_TEST.md` — re-run matrix

**Work**
1. When dock is mounted, ensure table region shrinks via flex **and** max-height budget matches real chrome (HUD + dock + secondary + padding).
2. Add stronger compact styles for `max-height` breakpoints (title collapse, tighter padding, single-row stats).
3. Confirm `overflow: hidden` no longer clips bot seat or hero name; prefer scaling surface over clipping.
4. Keep actions in normal flow below table (no `fixed` overlay).
5. Re-check MP chat/emote/history FAB clearance.

**Avoid**
- Absolute-positioning the dock over the felt.
- Reducing touch targets below 44×44 on mobile.
- Career-specific forks — fix shared shell once.

---

### T1a — Center ribbon off felt

**Risk:** Medium  
**Depends on:** Q2 (remove vs relocate vs panel-only)  
**Modes:** Shared feedback

**Files likely to modify**
- `apps/web/components/tableFeedback/TableEventFeedbackRoot.tsx` — stop mounting ribbon or mount in new host
- `apps/web/components/tableFeedback/TableResultRibbon.tsx` — optional keep for non-center host
- `apps/web/app/globals.css` — remove or relocate `.table-result-ribbon-host`
- `apps/web/__tests__/tableEventFeedback.components.test.tsx` — update expectations
- Docs: `TABLE_EVENT_FEEDBACK_*` — mark Layer 2 placement superseded

**Work**
1. Keep event ingest + log history unchanged.
2. Per Q2: unmount ribbon, or render it in HUD/dock-adjacent host, or panel-only.
3. Preserve `aria-live` somewhere (ribbon host or live region on side panel / log).

**Avoid**
- Deleting normalize/copy/queue.
- Reintroducing `GameResultBanner` / `Celebration`.

---

### T1b — Left-side history / info panel

**Risk:** Medium–High  
**Depends on:** T1a decision, Q3 (desktop rail vs mobile), optionally T4a for horizontal space  
**Modes:** Shared preferred

**Files likely to modify**
- New or extended: `apps/web/components/tableFeedback/TableEventLog.tsx` (or `TableInfoPanel.tsx`)
- `TableEventFeedbackRoot.tsx` — `TableFeedbackLogSlot` API
- `TableGraphics.tsx` / `MultiplayerTableGraphics.tsx` — stage composition (e.g. left rail + table)
- `apps/web/app/globals.css` — rail layout, responsive collapse
- Possibly `CasinoBackground` / stage grid

**Work**
1. Feed panel from existing `logEntries` (and optional live status props).
2. Desktop: left rail visible during play; do not cover felt center.
3. Mobile: either collapsible rail or retain FAB/sheet — per Q3.
4. Ensure short-height (`≤700px`) still has access to history.
5. Update manual tests that assume under-table desktop log only.

**Avoid**
- Duplicating a second event pipeline from raw `state.history` (prefer feedback events).
- Blocking gameplay with a modal history sheet that cannot close.

---

### T1c — Relocate Bot 1–area status block

**Risk:** Low–Medium  
**Depends on:** Q1 (which block), T1b if moving into panel  
**Modes:** SP and/or shared

**Files likely to modify (by candidate)**
- Dealer banner: `PokerTable.tsx`, `calmDealerMessage` usage in both shells
- SP bot planned: `TableGraphics.tsx` (`botPlanned` / `waitingMessage`), maybe publish to feedback log
- HUD banner: `GameHUD` / `GameStatusBanner` usage

**Work**
1. After screenshot/confirm, remove or slim the confirmed block from the felt/seat cluster.
2. Pipe verbose status into side panel live line if desired.
3. Keep minimal phase cue if product still wants dealer tokens.

---

### T5 — Docs, tests, regression harness

**Risk:** Low  
**Depends on:** T1–T4 complete  

**Files**
- Update: `TABLE_EVENT_FEEDBACK_MANUAL_TEST.md`, `CHIP_SYSTEM_MANUAL_TEST.md`, `GAME_VIEWPORT_MANUAL_TEST.md`
- Update this analysis if decisions diverge
- Unit/component tests listed under each task

---

## Dependencies (graph)

```
T2 (legacy chips) ──────────────────────────────┐
T3 (chip labels) ───────────────────────────────┼─► visual polish done
Q6/Q7 ─► T4a (YOUR MOVE layout) ────────────────┤
Q2 ─► T1a (ribbon) ─► Q3 ─► T1b (left panel) ──┼─► messaging UX done
Q1 ─► T1c (bot block) ─► preferably after T1b ─┘
                              └─► T5 docs/tests
```

---

## Test strategy

### Automated
1. `vitest` — `chips.components`, `tableEventFeedback.components`, `tableEventFeedback.normalize`, seat layout if anchors change.
2. Add/adjust cases:
   - Local `PlayerChipStack` renders labeled discs (or exact label) at desktop.
   - Ribbon not in center host when disabled / relocated.
   - Provider still pushes log entries without ribbon.
3. Typecheck / existing web suite green.

### Manual (minimum)

**Issue 2**
- [ ] SP 2P: no red/gray discs under bot
- [ ] MP: same; official stacks unchanged

**Issue 3**
- [ ] SP: hero and bot bankroll discs show denom text (per policy)
- [ ] MP/Career: local seat same
- [ ] Mobile: readable; no overlap with dock

**Issue 4**
- [ ] On local turn, full oval + bot seat + hero name visible
- [ ] YOUR MOVE fully usable; no page scroll
- [ ] Run viewports from `GAME_VIEWPORT_MANUAL_TEST.md` (at least 390×844, 1024×768, 1366×768, 1920×1080)
- [ ] MP FABs do not cover Pass/Bet

**Issue 1 / 1b**
- [ ] Pass / win / loss / KOUPPI / SHISTRI: no center-felt sentence overlay
- [ ] History panel/log shows matching lines
- [ ] Bot-area verbose block gone or moved
- [ ] `RoundEndPanel` still works (major end)
- [ ] Effects Off/Reduced: messaging still accessible

**Cross-mode**
- [ ] SP (`/play/single`)
- [ ] Casual MP (`/room/...`)
- [ ] Career room (same MP shell)

---

## Manual test checklist (copy-paste)

```
SP — idle table
[ ] No legacy red/gray tray chips under top bot
[ ] Official pot + seat stacks only

SP — resolutions
[ ] Pass / win / loss copy not over center cards/pot
[ ] History/info shows the event
[ ] Dealer banner behavior matches product decision

SP — chips
[ ] Bot discs labeled
[ ] Hero discs labeled (or approved alternate)
[ ] Wager markers still show amount when betting

SP — YOUR MOVE
[ ] Full table visible (bot + hero name)
[ ] Actions below table / non-overlapping
[ ] Short laptop height OK

MP / Career
[ ] Same ribbon/history/chip/dock expectations
[ ] Chat/emote/history FABs clear of dock
```

---

## Risk controls while implementing

1. Prefer CSS/composition changes over store/protocol changes.
2. One shared shell fix for dock/ribbon — no Career fork.
3. Feature-flag or CSS kill-switch for left rail if layout regresses mid-PR (optional).
4. After T4a, re-verify chip label clearance (T3) — order can swap if dock compaction changes hero stack space.
5. Do not remove `TableFeedbackProvider`; only change where Layer 2/3 render.

---

## Out of scope for the fix thread (unless requested)

- Redesigning reward/cosmetics wardrobe
- Replacing chip denomination art
- Reintroducing full-screen win celebration
- Server event IDs for feedback dedupe
- 3D preview / `ThreeDTablePlaceholder` cleanup (optional follow-up)
