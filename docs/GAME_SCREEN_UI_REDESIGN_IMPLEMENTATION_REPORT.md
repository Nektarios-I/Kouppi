# KOUPPI Game Screen UI Redesign — Implementation Report

**Branch:** `feat/game-screen-redesign`
**Date:** 2026-07-24

## Delivered architecture

Both active game shells now compose:

```text
CasinoBackground
└─ GameScreen
   ├─ GameUtilityBar
   │  └─ GameSettingsMenu
   ├─ HistoryDrawer (overlay)
   ├─ protected PokerTable + physical feedback
   └─ GameActionDock
      └─ compact GameActionPanel / Next / status
```

`TableGraphics` remains the SP adapter over `gameStore`.
`MultiplayerTableGraphics` remains the shared MP/Career adapter over
`remoteGameStore`. No mode fork or new gameplay state was introduced.

## New production modules

- `apps/web/components/game/GameScreen.tsx` — stable three-zone layout slots.
- `apps/web/components/game/GameUtilityBar.tsx` — compact identity, mode,
  timer/metadata, one-tap mute, and Settings slot.
- `apps/web/components/game/GameSettingsMenu.tsx` — appearance, advanced audio
  and effects, help, session exit, and optional host tools.
- `apps/web/components/game/HistoryDrawer.tsx` — overlay tabs for Actions,
  Hand/Round, and Table.
- `apps/web/components/game/GameActionDock.tsx` — waiting, active, next,
  spectator, and disabled state container.
- `apps/web/components/game/useOverlayDialog.ts` — shared Escape, focus
  containment, and trigger-focus restoration behavior.

## Updated integration files

- `apps/web/components/TableGraphics.tsx`
  - uses the shared shell
  - feeds existing feedback data to History
  - keeps all SP dispatch paths and bot behavior
  - keeps Next Turn in the stable dock
  - confirms Settings leave
- `apps/web/components/MultiplayerTableGraphics.tsx`
  - uses the shared shell for MP and Career
  - keeps timer, intents, pending state, spectators, errors, and confirmations
  - moves kick/close controls into Settings → Host tools
  - keeps Career exit helpers unchanged
- `apps/web/components/game/GameActionPanel.tsx`
  - removes legacy `YOUR MOVE` window title/region
  - retains amount controls and action callbacks
- `apps/web/components/game/PlayerSeat.tsx`
  - local current player gets `YOUR TURN`
  - opponents retain `TURN`
- `apps/web/lib/tableEventFeedback/copy.ts`
  - dealer local-turn copy remains calm `KOUPPI`
- `apps/web/app/play/single/page.tsx`
- `apps/web/app/room/[id]/page.tsx`
  - remove the redundant page-corner `SoundControl`
- `apps/web/app/globals.css`
  - adds centralized screen tokens and responsive surfaces
  - reserves dock height
  - adds overlay, focus, mobile-sheet, and reduced-motion styling
  - prevents the obsolete desktop side rail from claiming width

## Behavior retained

- PokerTable and seat geometry
- cards, pot, bets, meaningful chip decomposition/travel
- table themes and rewards-aware selector
- SP bot planning and store dispatch
- MP Socket.IO intents and pending intent behavior
- KOUPPI and SHISTRI confirmation
- host kick/close semantics
- spectator read-only behavior
- turn timer and connection/error banners
- Career routing through `postRoomExitPath`
- RoundEnd and ConfirmDialog blocking behavior
- Chat and Emote page integrations

## Tests

Added:

- `apps/web/__tests__/gameScreen.redesign.test.tsx`
- `apps/web/__tests__/gameScreen.integrations.test.ts`

Updated:

- `apps/web/__tests__/PlayerSeat.test.tsx`
- `apps/web/__tests__/gameActionPanel.shistri.test.tsx`
- `apps/web/__tests__/tableEventFeedback.normalize.test.ts`

TDD red states were observed for missing new modules, local-turn badge copy,
dealer duplication, compact action chrome, and shared shell integration before
the corresponding production changes.

Final results:

- focused: 6 files / 48 tests passed
- full web: 29 files / 201 tests passed
- production web build: passed

See `GAME_SCREEN_UI_REDESIGN_MANUAL_TEST.md` for exact commands and warnings.

## React/accessibility review

- Hooks are top-level and dependencies are stable.
- Overlay close callbacks are memoized.
- No inline component definitions were added.
- Derived dock state is calculated during render rather than mirrored in state.
- No new `any` types were introduced.
- Icon-only controls have accessible names and 44px targets.
- History and Settings implement Escape, focus containment, close controls,
  backdrop close, and trigger focus restoration.
- History tabs expose tab semantics and arrow-key navigation.
- New transitions honor reduced motion.

## Known limitations

1. Real-browser verification passed for default Single Player at all required
   widths (plus 640×700), including active controls, History, Settings, overflow,
   table/seat bounds, and dock clearance. Multiplayer player/spectator and
   Career browser rows remain unverified because they require a running server
   and populated rooms; shared wiring remains covered by automated tests.
2. The old `GameHUD`, `SoundControl`, and `TableEventLog` modules remain in the
   repository for compatibility with existing tests or non-game uses, but active
   SP/MP/Career game shells no longer mount them.
3. Legacy `.game-stage` CSS remains as compatibility styling; its desktop side
   width is forced to zero and active shells use only `.game-screen`.
4. History uses an overlay at all widths by product decision; no 1600px docked
   variant exists.
5. Node 25 is outside the repository engine range. Tests/build passed with the
   expected warning, but supported CI Node remains the authoritative runtime.

Browser screenshots are listed in `GAME_SCREEN_UI_REDESIGN_MANUAL_TEST.md`.
