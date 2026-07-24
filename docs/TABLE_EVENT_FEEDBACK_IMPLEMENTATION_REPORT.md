# Table Event Feedback — Implementation Report

**Date:** 2026-07-23  
**Status:** Done (manual browser matrix still required)  
**Specs:** [`TABLE_EVENT_FEEDBACK_AUDIT_AND_SPEC.md`](./TABLE_EVENT_FEEDBACK_AUDIT_AND_SPEC.md), [`TABLE_EVENT_FEEDBACK_MANUAL_TEST.md`](./TABLE_EVENT_FEEDBACK_MANUAL_TEST.md)

---

## Implementation status

Shared three-layer in-table feedback is implemented for Single Player, Multiplayer, and Career (Career uses the same `MultiplayerTableGraphics` + `remoteGameStore` path). Normal win/loss/KOUPPI/SHISTRI no longer use full-screen celebration/confetti or the large HUD result banner. Round-end / stay-leave / refill / play-again still use `RoundEndPanel`.

---

## Files changed / added

### Added
- `apps/web/lib/tableEventFeedback/types.ts`
- `apps/web/lib/tableEventFeedback/copy.ts`
- `apps/web/lib/tableEventFeedback/normalize.ts`
- `apps/web/lib/tableEventFeedback/dedupe.ts`
- `apps/web/lib/tableEventFeedback/queue.ts`
- `apps/web/lib/tableEventFeedback/index.ts`
- `apps/web/store/tableEffectsStore.ts`
- `apps/web/hooks/usePrefersReducedMotion.ts`
- `apps/web/components/tableFeedback/TableEventFeedbackRoot.tsx`
- `apps/web/components/tableFeedback/TablePhysicalFeedbackLayer.tsx`
- `apps/web/components/tableFeedback/TableResultRibbon.tsx`
- `apps/web/components/tableFeedback/TableEventLog.tsx`
- `apps/web/__tests__/tableEventFeedback.normalize.test.ts`
- `apps/web/__tests__/tableEventFeedback.components.test.tsx`
- `docs/TABLE_EVENT_FEEDBACK_AUDIT_AND_SPEC.md`
- `docs/TABLE_EVENT_FEEDBACK_MANUAL_TEST.md`
- `docs/TABLE_EVENT_FEEDBACK_IMPLEMENTATION_REPORT.md` (this file)

### Modified
- `apps/web/components/TableGraphics.tsx` — remove Celebration/ChipFly/GameResultBanner; wire provider
- `apps/web/components/MultiplayerTableGraphics.tsx` — same for MP/Career
- `apps/web/components/PokerTable.tsx` — `data-pot-anchor`, `surfaceRef`
- `apps/web/components/game/TableSeatLayout.tsx` — `data-seat-id`
- `apps/web/components/SoundControl.tsx` — Table effects + Table sound controls
- `apps/web/app/globals.css` — ribbon / chip travel / log / seat FX styles

### Retained (unused for normal outcomes)
- `apps/web/components/Confetti.tsx` (`Celebration`) — no longer mounted from table shells
- `ChipFlyAnimation` — no longer mounted from table shells (component remains for potential reuse)
- `GameResultBanner` — still exported; table shells no longer pass resolution banners
- `GameLog` — replaced at table by `TableEventLog` (component remains)

---

## Old behaviors removed or retained

| Behavior | Disposition |
|----------|-------------|
| Full-screen `Celebration` + confetti on local win | **Removed** from SP/MP shells |
| Loud `sounds.win` / `sounds.lose` on every resolution | **Removed**; optional subtle chip cues via table sound |
| Random `ChipFlyAnimation` from screen bottom | **Replaced** by seat↔pot Layer 1 travel |
| Large `GameResultBanner` above table | **Replaced** by Layer 2 ribbon |
| Shouting dealer `WIN!` / `LOSS` | **Restyled** via `calmDealerMessage` |
| Raw `GameLog` from `history[]` under table | **Replaced** by bounded deduped `TableEventLog` |
| `RoundEndPanel` (pot empty / stay-leave / refill) | **Retained** (major / decision) |
| `ConfirmDialog` (KOUPPI/SHISTRI/kick/close) | **Retained** (explicit confirm) |
| `ConnectionStatusBanner` | **Retained** |
| Lobby/meta toasts | **Retained** (not used for pot results) |

---

## New shared architecture

```
lastResolution (game-core)
        │
        ▼
normalizeResolutionEvent + FeedbackDedupeSet
        │
        ▼
TableFeedbackProvider ──► ribbon queue + log history + physical queue
        │
        ├── TablePhysicalFeedbackLayer (Layer 1)
        ├── TableResultRibbon (Layer 2)
        └── TableEventLog (Layer 3)
```

Single Player and Multiplayer/Career both wrap with `TableFeedbackProvider` and mount overlays inside `.game-stage-table-region`.

---

## Event sources per mode

| Mode | Shell | Identity | Resolution source |
|------|-------|----------|-------------------|
| Single Player | `TableGraphics` | `players[0].id` | `gameStore.state.lastResolution` |
| Multiplayer | `MultiplayerTableGraphics` | `remoteGameStore.playerId` | remote `GameState.lastResolution` |
| Career | same MP shell | same | same (+ RoundEnd / career room exit paths unchanged) |

Dedupe key: `res|{playerId}|{kind}|{win}|{amount}|{reveal}|{historyLength}`  
**Limitation:** no server event IDs; remount clears the in-memory seen-set.

SHISTRI declare is not a separate protocol event — badge + copy derive from `kind === "shistri"` on resolution.

---

## Layer behavior summary

- **Layer 1:** Chip travel seat↔pot when anchors exist; win highlight ~900ms; loss dim ~450ms; SHISTRI badge ~1.5s; respects Full/Reduced/Off + `prefers-reduced-motion`.
- **Layer 2:** One ribbon; low replaces low; queue max 3; auto-dismiss; `aria-live="polite"`; no dialog.
- **Layer 3:** Desktop collapsible dock; mobile 44×44 FAB above emote; history 16 mobile / 28 desktop; no forced scroll-away.

---

## Match-end behavior

`phase === "RoundEnd"` / MP `roundEnded` still renders `RoundEndPanel` (blocking, intentional). Normal resolution feedback does not replace this panel.

---

## Sound / effects settings

Persisted in zustand `kouppi-table-effects`:
- Table effects: Full | Reduced | Off
- Table sound: On | Off  

Exposed in `SoundControl`. Master mute still applies via existing `lib/sounds.ts`.  
`prefers-reduced-motion` forces visual level ≤ Reduced.

---

## Accessibility

- Ribbon: `role="status"`, polite live region, text labels for win/loss/SHISTRI
- Log FAB/toggle: labels, focus-visible, 44×44 mobile targets
- Seat FX: outline/opacity, not color-only messaging

---

## Tests added

- `__tests__/tableEventFeedback.normalize.test.ts` (15)
- `__tests__/tableEventFeedback.components.test.tsx` (7)

### Commands run

```text
pnpm --filter @kouppi/web exec vitest run __tests__/tableEventFeedback.normalize.test.ts __tests__/tableEventFeedback.components.test.tsx
→ 22 passed

pnpm --filter @kouppi/web test -- --run
→ 25 files, 129 passed
```

### Build

```text
pnpm --filter @kouppi/web build
→ Compiled successfully
→ Failed typecheck on pre-existing: store/remoteGameStore.ts:315 Property 'code' does not exist
  (not introduced by this change; table feedback files typechecked in the Next build pass before that error)
```

Package filter note: workspace name is `@kouppi/web` / `@kouppi/game-core` (not `kouppiweb`).

---

## Manual checks performed

- Automated unit/component coverage for normalize, queue, ribbon, log, provider dismiss.
- Full browser matrix (SP/MP/Career/settings/widths) **not** executed in this session — follow `TABLE_EVENT_FEEDBACK_MANUAL_TEST.md`.

---

## Remaining issues / limitations

1. No stable server event IDs → possible rare duplicate feedback after hard remount/reconnect.
2. SHISTRI declaration cannot be shown before reveal (atomic in reducer).
3. Amounts shown as chip integers (no currency inventing).
4. Chip travel skipped gracefully if seat/pot DOM anchors missing.
5. `Celebration` / `ChipFlyAnimation` source files retained but unused by table shells.
6. Production `next build` still blocked by pre-existing `remoteGameStore` `result.code` typing.
7. Desktop `game-stage-secondary` still hidden at very short viewports (`max-height: 700px`); mobile log FAB covers history in that case.
