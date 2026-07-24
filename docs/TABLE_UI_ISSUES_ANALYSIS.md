# KOUPPI Table UI Issues — Analysis Report

**Date:** 2026-07-24  
**Scope:** Analysis + implementation follow-up (fixes landed same day).  
**Deploy tested by user:** current Vercel production (pre-fix).  
**Modes covered:** Single Player, Multiplayer, Career (Career = Multiplayer table shell).

**Implementation status (2026-07-24):** Fixes applied per product answers — see `TABLE_UI_ISSUES_IMPLEMENTATION_PLAN.md` “Implementation completed”. Center result copy → left **Table info** panel; legacy tray discs removed; local chip denom labels match bots; dealer banner labeled; YOUR MOVE dock compacted with `game-stage--dock-open` chrome budget.

**Confidence legend**
- **Confirmed** — verified in source.
- **Likely** — strong code evidence; needs visual confirm with user.
- **Open** — cannot decide without user input or runtime screenshot.

---

## Executive summary

All three live play modes share one presentational pipeline (`PokerTable` → seats/chips/feedback). Mode shells differ mainly by store and routing. The four user-reported problems map to **four distinct causes**, not one shared bug:

| # | Symptom | Root cause class | Scope |
|---|---------|------------------|-------|
| 1 | “You passed” / “Bot … passed” / “You lost” over table center | Intended Layer-2 `TableResultRibbon` placed at ~46% Y | **Shared** (all modes) |
| 1b | Extra block near Bot 1 (SP) | **Likely** dealer banner +/or SP bot-thinking copy; needs confirm | SP-heavy / shared banner |
| 2 | Old red/gray chips under bot | Decorative dealer tray in `PokerTable` (not chip system) | **Shared** |
| 3 | Local chips lack on-chip numbers; bot has them | `PlayerChipStack` forces `size="xs"` for local → `showLabel: false` | **Shared** (any local hero) |
| 4 | “YOUR MOVE” breaks table / covers name / clips bot | Viewport budget vs tall `GameActionPanel` + `overflow: hidden` | **Shared** layout; observed in SP |

There is already a Layer-3 history source (`TableEventLog` + `TableFeedbackProvider.logEntries`) that can back a left-side history/info panel. Center ribbon copy and log copy are produced by the same `lib/tableEventFeedback/copy.ts` pipeline.

---

## Architecture map

### Confirmed component chain

```
Single Player
  app/play/single/page.tsx
    → TableGraphics.tsx (SinglePlayerTableGraphics)
         → TableFeedbackProvider (gameStore.lastResolution)
         → CasinoBackground (lockViewport → .game-viewport-shell)
         → .game-stage
              → .game-stage-hud → GameHUD (+ optional GameStatusBanner)
              → .game-stage-table-region
                   → PokerTable
                        → dealer tray (decorative red/gray)
                        → dealer banner (calmDealerMessage)
                        → PotChipStack
                        → CenterCards (children)
                        → TableSeatLayout
                             → PlayerChipStack (bankroll)
                             → PlayerBetMarker (wager)
                             → PlayerSeat
                   → TableFeedbackOverlays
                        → TablePhysicalFeedbackLayer
                        → TableResultRibbon   ← Issue 1 center copy
              → .game-stage-dock → GameActionPanel ("YOUR MOVE")  ← Issue 4
              → .game-stage-secondary → TableFeedbackLogSlot → TableEventLog

Multiplayer / Career
  app/room/[id]/page.tsx
    → MultiplayerTableGraphics.tsx
         → same shell/table/feedback/dock/log pattern
         → store: remoteGameStore (Career uses career room id + same shell)
```

### Shared vs mode-specific

| Layer | Shared? | Notes |
|-------|---------|-------|
| `PokerTable`, `TableSeatLayout`, seats, chips | Yes | All modes |
| `TableResultRibbon` / physical FX / `TableEventLog` | Yes | Wired from both shells |
| `GameActionPanel` + `.game-stage-*` CSS | Yes | Both shells |
| SP bot thinking (`botThinking` / `botPlanned`) | **SP only** | `TableGraphics.tsx` |
| MP turn timer / spectator / confirm dialogs | MP/Career | Not primary for these four issues |
| Career table graphics | None separate | Reuses MP shell |

### Relevant prior docs (Phase 0)

| Doc | Relevance |
|-----|-----------|
| `TABLE_EVENT_FEEDBACK_AUDIT_AND_SPEC.md` | Spec’d center safe-zone ribbon (Layer 2) + hand history (Layer 3) |
| `TABLE_EVENT_FEEDBACK_IMPLEMENTATION_REPORT.md` | Confirms ribbon mounted in table region |
| `CHIP_SYSTEM_AUDIT_AND_SPEC.md` / `IMPLEMENTATION_REPORT.md` | Official stacks; local stack intentionally compact |
| `PLAYER_SEAT_UI_*` | Perimeter seats; central safe zone for cards/pot/messages |
| `POST_A_UI_AND_WORKFLOW_IMPLEMENTATION_REPORT.md` | Viewport shell + `--game-chrome-h` dock budget |
| `GAME_VIEWPORT_MANUAL_TEST.md` | Documents known laptop-height risk for YOUR MOVE |

No dedicated Cursor handoff file under `docs/` or `.cursor/` for this table UI pass; the reports above are the handoff surface.

---

## Issue 1 — Center-table action/result messages

### User-observed symptom
Messages such as “You passed”, “Bot passes”, “You lost” appear in the middle of the table over the central play area (cards / pot / felt).

### Exact component(s) and file path(s)

| Role | Path |
|------|------|
| UI | `apps/web/components/tableFeedback/TableResultRibbon.tsx` |
| Mount | `TableFeedbackOverlays` in `apps/web/components/tableFeedback/TableEventFeedbackRoot.tsx` |
| Wired from | `TableGraphics.tsx` L262; `MultiplayerTableGraphics.tsx` L557 |
| Copy | `apps/web/lib/tableEventFeedback/copy.ts` (`buildResolutionCopy`) |
| Normalize / queue | `normalize.ts`, `queue.ts`, provider ingest |
| Placement CSS | `apps/web/app/globals.css` `.table-result-ribbon-host` (`left:50%`, `top:46%`, `z-index:22`) |

### Data/state source
- Authoritative: `GameState.lastResolution` (SP: `gameStore`; MP/Career: remote state).
- Provider normalizes → enqueues ribbon + log entry.
- Copy examples (confirmed): `` `${playerName} passed` ``, `You lost`, `You lost {n}`, `You won {n}` — not the literal string “Bot passes” (actual: `"Bot 1 passed"`).

### Current rendering path
`lastResolution` → `normalizeResolutionEvent` → `ingest` → `activeRibbon` → `TableResultRibbon` absolutely positioned in `.game-stage-table-region`.

### Root cause
**Confirmed — placement / product layering, not a stray bug.**  
The 2026-07-23 table-feedback spec intentionally put Layer 2 in the central safe zone (~42–48% Y). That collides with the user’s preference that the felt center stay reserved for cards/chips/pot/players.

### Why it shows in this mode
Shared across SP / MP / Career. SP may feel worse because 2P puts Bot 1 at top and hero at bottom, so center ribbon sits in the only busy corridor.

### Already-existing history/log (reusable)
**Confirmed:** `TableEventLog` + `logEntries` from the same events (`ribbonText` / `logText`). Desktop: collapsible under `.game-stage-secondary`. Mobile: FAB + sheet. Orphan legacy: `GameLog` in `GamePanels.tsx` (unused by shells).

### Safe fix options
1. **Disable / stop mounting Layer-2 ribbon**; rely on (or upgrade) Layer-3 log only. Low risk to game logic.
2. **Relocate ribbon** to left rail / above dock / under HUD — keep ephemeral toast behavior without covering felt.
3. **Promote left-side history panel** that shows live status + scrollable log (user direction); optionally keep a non-center ephemeral cue.

### Recommended fix
Combine (1)+(3): stop center ribbon (or gate it off by default), expand/reposition history into a **left-side info panel** fed by existing `logEntries` (+ optional live status line). Keep dealer banner calm labels unless user wants those moved too (see Issue 1b).

### Regression risks
- Spec/tests assume center ribbon (`tableEventFeedback.components.test.tsx`, manual test docs).
- a11y: ribbon is `aria-live`; log must remain polite/live if ribbon removed.
- Effects Off / Reduced currently still show ribbon — product expectation may change.
- MP/Career players who relied on center flash lose that cue unless panel is always visible.

### Verification notes needed after fix
- Pass / bet win / bet loss / KOUPPI / SHISTRI in SP and MP.
- No text over pot/cards.
- Log receives same events; no duplicates.
- Mobile history still reachable when secondary chrome is hidden (`max-height: 700px`).

---

## Issue 1b — Extra block near Bot 1 (single-player)

### User-observed symptom
A separate displayed block around Bot 1 should move into the same left history/info panel.

### Exact component(s) — candidates

| Candidate | Path | Mode | Confidence |
|-----------|------|------|------------|
| Dealer banner | `PokerTable.tsx` `table-dealer-banner` @ `top-[16%]`; text from `calmDealerMessage` | Shared | **Likely** — sits under top opponent in 2P |
| SP bot planned / thinking wait copy | `TableGraphics.tsx` → `CenterCards` `waitingMessage` (`Bot 1: Pass`, etc.) | SP only | **Likely** when center is in waiting mode |
| HUD `GameStatusBanner` | `GameHUD` + `"{name} is thinking..."` | SP (and similar MP) | **Less likely** — above table, not “around Bot 1” |
| Physical SHISTRI badge / seat FX | `TablePhysicalFeedbackLayer.tsx` | Shared | **Possible** for SHISTRI only |

### Data/state source
- Dealer: `calmDealerMessage({ awaitingNext, resolution, isMyTurn, botThinking })` → `WAITING` / `PASS` / `YOUR TURN` / `RESOLVED` / `KOUPPI`.
- SP bot: local `botThinking` / `botPlanned` in `TableGraphics.tsx`.

### Root cause
**Likely — intentional status chrome clustered near the top seat**, not a duplicate of the ribbon. Needs user confirmation of which visual block.

### Safe fix options
- Move ephemeral status into left panel; keep or slim dealer banner.
- If SP-only bot planned text: stop piping it into `CenterCards`; publish to log/status panel instead.

### Recommended fix
Confirm identity with user (see Open questions). Default plan: keep short dealer tokens optional; route verbose SP bot intent (“Bot 1: Bet 10”) into the side panel only.

### Regression risks
- Removing dealer banner removes a calm phase cue used after shouty banners were retired.
- Changing `CenterCards` waiting copy affects empty-table states.

### Verification
SP 2P: bot turn, pass, resolve — nothing verbose glued to Bot 1 seat.

---

## Issue 2 — Legacy red/gray chips under bot display

### User-observed symptom
Below the bot display in SP, old simplistic red/gray chip discs remain. Only the new chip system should remain.

### Exact component(s) and file path(s)
**Confirmed:** decorative “Dealer chip tray” in `apps/web/components/PokerTable.tsx` (~L267–291):

- Absolute `top-[5%]` under the top rail.
- Five `rounded-full` discs alternating `#c03030` / `#f5f5f5`.
- `aria-hidden="true"` — pure ornament.
- In SP 2P, bot seat sits near top (`y≈4%`), so these discs read as “under Bot 1”.

### Not the cause
| Item | Status |
|------|--------|
| Official `components/chips/*` | Production bankroll/bet/pot stacks |
| `ChipAnimation.tsx` | Deprecated shim; **not mounted** by live SP/MP shells (only `ThreeDTablePlaceholder` still imports legacy `ChipStack`) |
| `PlayerBetMarker` / `PlayerChipStack` | Official system |

### Data/state source
None — hardcoded decorative markup. Independent of bankroll/bet/pot state.

### Root cause
**Confirmed — leftover ornamental UI** inside shared `PokerTable`, not a fallback of the chip denomination system and not SP-only code (SP merely makes it obvious under the top bot).

### Safe fix options
1. Remove the five discs (and optionally the whole tray chrome).
2. Restyle tray using official `PokerChip` ornaments (usually unnecessary).

### Recommended fix
**Remove the decorative disc row** (optionally keep the thin rail bar). No state/logic change.

### Regression risks
- **Very low.** Shared visual only; all modes lose the ornament.
- Snapshot/visual tests if any assert tray (none found in focused chip tests).
- Do not confuse with removing `PlayerChipStack` / pot stacks.

### Verification
SP/MP: no red/gray discs under top seat; official stacks still animate and label correctly.

---

## Issue 3 — Local player chips missing on-chip number labels

### User-observed symptom
In SP, bot bankroll chips show denomination numbers on top; local (hero) chips do not.

### Exact component(s) and file path(s)

| Step | Path | Behavior |
|------|------|----------|
| Mount | `TableSeatLayout.tsx` | `PlayerChipStack` with `isLocal={player.isMe}` |
| Size branch | `PlayerChipStack.tsx` | `size = mobile ? "xs" : isLocal ? "xs" : "sm"`; `dense` for local |
| Label gate | `PokerChip.tsx` | `xs` → `showLabel: false`; `sm+` → `showLabel: true` |
| Optional stack label | `ChipStack.tsx` `showExactLabel` | Defaults **false**; `PlayerChipStack` never passes it |

### Data/state source
Same `player.bankroll` for all seats. Not a missing data path.

### Root cause
**Confirmed — intentional local compaction disables on-chip labels.**  
Comment in `PlayerChipStack`: “Local hero seat — keep compact so action dock stays clear.” Combined with `PokerChip` xs policy, hero discs render blank while opponents use `sm` with labels.

Also: exact bankroll remains on `PlayerSeat` text; chip discs were treated as visual-only for hero.

### Why it happens in this mode
Logic is **shared** whenever `player.isMe` is true (SP hero, MP/Career local seat). User noticed in SP; **likely same in MP/Career** (not SP-only).

Wager markers (`PlayerBetMarker`) are separate: they use `sm` (or `xs` when compact) **plus** an external `__amount` span — so bet amounts can still show even when discs are tiny.

### Safe fix options
1. Use `size="sm"` for local desktop/tablet (keep `xs` only on mobile if needed).
2. Keep `xs` but enable labels for xs (may be unreadable at 18px).
3. Pass `showExactLabel` on local `PlayerChipStack` (total amount under stack) instead of/in addition to per-disc labels.
4. Match bot sizing entirely for consistency.

### Recommended fix
**Option 1 (+ optional 3 for total):** local non-mobile → `sm` with on-chip denom labels, still `dense` if dock clearance needed. Align with chip-system goal that stacks communicate value visually.

### Regression risks
- Larger hero stack may crowd bottom felt / overlap dock or name pod (original reason for xs).
- Mobile opponents already use xs unlabeled — consistency policy needed.
- Cosmetic skins / transfer layer sizes unchanged if only `PlayerChipStack` size changes.

### Verification
SP + MP: local and opponent bankroll discs show denom text at desktop; mobile still readable; no overlap with YOUR MOVE or seat name.

---

## Issue 4 — “YOUR MOVE” panel breaks table visibility

### User-observed symptom
On local turn in SP, “Your move” / YOUR MOVE window pops up, covers part of the table and the local name display; top of table / bot area not fully visible.

### Exact component(s) and file path(s)

| Role | Path |
|------|------|
| Panel | `apps/web/components/game/GameActionPanel.tsx` — title `YOUR MOVE`, class `game-action-dock` |
| Mount (SP) | `TableGraphics.tsx` when `isMyTurn && up && !awaitingNext && phase === "Round"` inside `.game-stage-dock` |
| Mount (MP) | `MultiplayerTableGraphics.tsx` same pattern (+ bankrupt/spectator guards) |
| Layout CSS | `globals.css` `.game-viewport-shell`, `.game-stage`, `.game-stage-table-region` (`overflow: hidden`), `.game-stage-dock` (`z-index: 40`), `--game-chrome-h` (280 / 240 / 210) |
| Shell | `CasinoBackground.tsx` `lockViewport` |

### Data/state source
Turn gates from store (`currentIndex` / `playerId`, `turn.upcards`, `awaitNext`, `phase`). Not a false-positive render bug — panel correctly appears on turn.

### Current rendering path
Flex column: HUD → table region (flex 1, clipped) → dock (flex none, tall panel) → secondary log.  
Table max-height: `calc(100dvh - var(--game-chrome-h))` with a **static** chrome estimate.

### Root cause
**Confirmed — layout / viewport budget mismatch (not a floating modal bug).**

1. `GameActionPanel` is a large block (header, quick bets, slider, 4 actions, helpers) — often taller than the slack assumed by `--game-chrome-h`.
2. When dock mounts, table region shrinks; `overflow: hidden` on `.game-stage-table-region` **clips** top (bot) and/or bottom (hero name / chips).
3. Dock `z-index: 40` can visually dominate; even without absolute overlay, clipping + compression reads as “covering” the name/table.
4. Prior Post-A Phase 4 / `GAME_VIEWPORT_MANUAL_TEST.md` already flagged laptop heights as critical and left manual matrix unchecked.

Not primarily a single-player-only codepath — **shared stage CSS** — but SP always shows the full dock on human turns.

### Safe fix options
1. **Reserve real dock height** (measure or larger `--game-chrome-h` when dock visible) so table scales down instead of clipping.
2. **Compact `GameActionPanel`** on short viewports (collapse header “YOUR MOVE”, denser padding — partial CSS already under `max-height: 820px`).
3. **Two-row stage:** table always fully visible; actions in a dedicated below-table region with guaranteed min space (user direction).
4. Avoid `position: fixed` overlay for actions (would worsen overlap).

### Recommended fix
**Layout-first (1+2+3):** keep dock in document flow below table; increase chrome budget when dock mounted; further compress panel on short heights; ensure seat pods stay inside scaled surface. Prefer minimal CSS/composition changes over rewriting action logic.

### Regression risks
- **High touch area:** shared by SP/MP/Career.
- Shrinking table too far → seats/cards unreadable.
- Over-compacting actions → touch targets &lt; 44px (a11y).
- Secondary log already hides at ≤700px height — more chrome pressure worsens history access (ties to Issue 1 left panel).
- MP FABs (chat/emote/history) vs dock clearance.

### Verification
Viewport matrix from `GAME_VIEWPORT_MANUAL_TEST.md` with YOUR MOVE visible: full table + bot + hero name; no document scroll; actions usable.

---

## Cross-cutting: A–F checklist answers

### A. Center-table message system
- **Renderer:** `TableResultRibbon` (not PokerTable children, not toast, not GameResultBanner).
- **Shared** across modes via `TableFeedbackOverlays`.
- **History reuse:** yes — `TableEventLog` / `logEntries` / same copy pipeline.

### B. Bot-area extra block
- **Not a dedicated BotPanel.** Candidates: dealer banner, SP bot planned waiting copy, less likely HUD banner / SHISTRI badge.
- Move-cleanly to side panel: **yes** for text status; dealer banner is shared chrome.

### C. Legacy chips
- **Confirmed** decorative tray discs in `PokerTable`.
- Safe to remove without touching chip logic/state.

### D. Missing local chip numbers
- **Confirmed** `isLocal` → `xs` → `showLabel: false`.
- Shared local-hero behavior; verify MP/Career same.

### E. YOUR MOVE
- **`GameActionPanel`** in `.game-stage-dock`.
- Overlap/clip from flex + overflow + chrome budget, not a separate popup component.
- Fix: reserve space + compact + keep below table.

### F. Shared vs mode-specific

| Issue | SP | MP | Career |
|-------|----|----|--------|
| 1 Center ribbon | Shared | Shared | Shared (MP shell) |
| 1b Bot block | SP-specific candidates + shared dealer | Dealer only | Dealer only |
| 2 Legacy tray | Shared (visible under top seat) | Shared | Shared |
| 3 Local chip labels | Shared hero path | Shared | Shared |
| 4 YOUR MOVE layout | Shared stage | Shared | Shared |

---

## Regression risk summary (all fixes)

| Fix area | Risk | Why |
|----------|------|-----|
| Remove/relocate ribbon | Medium | Spec + tests + a11y live region |
| Left history panel | Medium–High | New layout chrome; mobile FAB; short-viewport rules |
| Remove dealer tray discs | Low | Ornament only |
| Local chip size/labels | Low–Medium | Possible dock/seat collision |
| Dock/viewport rebalance | **High** | Shared shell; easy to break MP FABs / touch targets |

**Do not naively:** rewrite `PokerTable` seat math, change game-core, or remove `TableFeedbackProvider` wholesale.

---

## Recommended fix strategy (product order)

1. Remove decorative dealer discs (Issue 2) — quick win, low risk.  
2. Fix local chip label sizing (Issue 3) — small, shared, easy to verify.  
3. Stop center ribbon; route emphasis to log / future left panel (Issue 1).  
4. Viewport/dock compaction so full table + seats remain visible with YOUR MOVE (Issue 4).  
5. Design/implement left-side history/status panel (Issue 1 + 1b) once placement rules are confirmed.

Detailed task breakdown: `docs/TABLE_UI_ISSUES_IMPLEMENTATION_PLAN.md`.

---

## Open questions for implementation

1. **Bot-area block:** Is it (a) the gold dealer banner (`WAITING` / `PASS` / …), (b) text like `Bot 1: Pass` / thinking near the cards, (c) something else? A screenshot crop would lock this.
2. **Center ribbon:** Prefer (a) remove entirely, (b) keep only as a non-center toast (e.g. under HUD / above dock), or (c) only show inside the new left panel with no ephemeral flash?
3. **Left panel scope:** Desktop-only always-visible rail, or also replace mobile FAB/sheet? Should it include live “Bot thinking…” / “Your turn” status or only resolution history?
4. **Dealer banner:** Keep calm tokens on felt, move to side panel, or remove?
5. **Local chip labels:** Must on-disc denom text match bots exactly, or is a total amount label under the hero stack acceptable?
6. **YOUR MOVE:** Accept a more compact action strip on short viewports (less padding / hide “YOUR MOVE” title), or must the current control density stay and only table scaling change?
7. **Target viewports for Issue 4:** Which size did you test on the Vercel deploy (phone / laptop height / desktop)? Critical for chrome budget numbers.
