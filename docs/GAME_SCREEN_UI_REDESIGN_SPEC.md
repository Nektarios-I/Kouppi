# KOUPPI Game Screen UI Redesign — Specification

**Date:** 2026-07-24
**Status:** Implemented on `feat/game-screen-redesign`
**Scope:** In-game chrome for Single Player, Multiplayer, and Career.

## Outcome

The playable table remains the visual focus. The screen has three stable zones:

1. A compact utility bar with KOUPPI identity, a short mode label, one-tap mute,
   optional multiplayer timer/metadata, and Settings.
2. A protected table stage containing the existing `PokerTable`, seats, cards,
   pot, meaningful chips, dealer banner, and physical feedback.
3. An always-reserved action dock with active, waiting, next, spectator, and
   disabled states.

History is closed by default and always overlays. It never owns table width,
including at 1600px and wider.

## Preserved systems

- `PokerTable`, seat geometry, table themes, cards, pot, and meaningful chips.
- Single-player game-store dispatches and bot behavior.
- Multiplayer Socket.IO intents, timer, confirmations, reconnect/error UI,
  spectators, host operations, and round-end decisions.
- Career routing through `postRoomExitPath`.
- `ConfirmDialog`, `RoundEndPanel`, and physical table-feedback events.

## Utility and Settings

Utility layout is `[brand][mode] … [timer/metadata][mute][settings]`.

- Mute is an icon-only, one-tap control with `Mute`/`Unmute` accessible names.
- Settings contains table appearance, volume controls, table effects/sound,
  rules/help, leave/stop-watching, and multiplayer host controls.
- Theme and leave controls are not exposed in the utility bar.
- Leaving an active game requests confirmation.
- Multiplayer host kick and close-room tools live under Settings → Host tools.

## History Drawer

- Tabs: Actions, Hand / Round, and Table.
- Actions uses the existing `TableFeedbackProvider` `logEntries` and
  `activeRibbon`; no second event pipeline is introduced.
- Desktop uses a left-edge trigger and an overlay drawer.
- Mobile uses a bottom sheet positioned above the reserved action dock.
- Escape, close button, backdrop click, focus containment, and focus restoration
  are required.
- Generic pass/win/loss copy stays in Actions, never centered on the felt.

## Turn and action behavior

- Local turn: local seat cyan treatment plus `YOUR TURN`; dock helper says
  “Your turn — choose an action”.
- Opponents retain the compact `TURN` badge.
- Dealer remains labeled Dealer and uses calm phase tokens; local turns do not
  duplicate `YOUR TURN` in the dealer banner.
- `GameActionPanel` is a compact dock body. It has no modal/dialog semantics and
  no large `YOUR MOVE` title.
- The dock container remains mounted and reserves the same layout slot while
  waiting, acting, advancing, spectating, or disabled.
- SP preserves Pass, Bet, KOUPPI, SHISTRI, and Next Turn.
- MP/Career preserve the same intents and KOUPPI/SHISTRI confirmation behavior.

## Layout contract

`.game-screen` owns:

- `--gs-utility-h`
- `--gs-dock-h`
- `--gs-gutter`
- `--gs-table-max-h`

The table region is `flex: 1`, `min-height: 0`, and overflow-protected. The dock
is in normal flow with a fixed flex basis. New overlays use the intended layer
order: table/FX, dock, history, utility, settings, then blocking dialogs.

## Accessibility and motion

- Icon controls have accessible names and 44px targets.
- History and Settings are keyboard operable, close on Escape, contain Tab
  focus, and restore focus to their triggers.
- History tabs support arrow navigation.
- One polite feedback region is used in History rather than competing center
  announcements.
- New motion respects `prefers-reduced-motion`.

## Responsive acceptance matrix

Widths to verify: 320, 360, 375, 390, 414, 768, 1024, 1280, 1366, 1440, and
1600+. At each width verify waiting, local turn, opponent turn, resolution,
History, Settings, and leave confirmation in SP, MP, and Career.

Acceptance requires:

1. Full oval, seats, cards, pot, and chips remain visible without horizontal
   document overflow.
2. No large `YOUR MOVE` window exists.
3. Result sentences never occupy center felt.
4. Opening History does not resize the table.
5. Theme and leave are only in Settings; mute is one tap.
6. Leave confirmation appears where abandonment is possible.
7. Existing game actions, Socket.IO intents, and Career exits still work.
8. Keyboard and focus behavior works for overlays and dock actions.

## Non-goals

No game-core, protocol, seat-geometry, chip-denomination, lobby, matchmaking, or
Career-table fork changes are part of this redesign.
