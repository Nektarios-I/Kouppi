# Table Event Feedback — Audit & Spec

**Date:** 2026-07-23  
**Scope:** UI feedback, animation, sound, state mapping, and tests only. No game-rule, protocol, bankroll, SHISTRI math, or matchmaking changes.  
**Modes:** Single Player (`TableGraphics`), Multiplayer + Career (`MultiplayerTableGraphics` via shared remote store).

---

## 1. Current feedback inventory

| Item | Path / symbol | Trigger | Visual | Sound | Modes | Classification |
|------|---------------|---------|--------|-------|-------|----------------|
| Full-screen celebration + confetti | `components/Confetti.tsx` → `Celebration` | Local player win via `lastResolution` (`TableGraphics`, `MultiplayerTableGraphics`) | `fixed inset-0` giant gradient text (`🎉 WIN!`, `🎰 KOUPPI!`, `⭐ SHISTRI!`) + confetti z-50 | Paired with `sounds.win()` | SP / MP / Career | **remove** for normal outcomes |
| Confetti particles | `Confetti` default export | Same as above | Full-viewport particles | — | All | **remove** for normal outcomes |
| Chip fly (decorative) | `ChipFlyAnimation` in `ChipAnimation.tsx` | Local bet / kouppi / shistri click | Random X from bottom → up; not seat/pot anchored | `sounds.bet` / `sounds.chips` | All | **replace** with Layer 1 seat↔pot travel |
| HUD result banner | `GameResultBanner` in `GameHUD.tsx` | `awaitingNext && lastResolution` | Large colored banner above table (not safe-zone ribbon) | — | All | **replace** with Layer 2 ribbon |
| Dealer banner shout | `dealerMessage` in both table shells | `awaitingNext` | `BET - WIN!` / `KOUPPI - LOSS` etc. | — | All | **keep but restyle** (calm labels; detail in ribbon) |
| Round end modal | `RoundEndPanel` in `GamePanels.tsx` | `phase === RoundEnd` / `roundEnded` + stay-leave / play-again | Full-screen blocking dialog | — | SP (refill), MP/Career (stay/leave, host reset) | **retain only for major / decision** (requires Stay/Leave / Continue / Leave) |
| Confirm dialogs | `ConfirmDialog` | Kouppi/Shistri confirm, kick, close room | Blocking modal | — | MP/Career | **retain** (explicit player confirmation) |
| Connection banner | `ConnectionStatusBanner` | Disconnect | Top fixed bar | — | MP/Career | **retain** (critical connectivity) |
| Toast | `components/game/Toast.tsx` | Lobby/chat/friends/errors | Stacked top toasts | — | Lobby/meta | **keep** for meta UX; **do not** use for table pot/round results |
| Existing GameLog | `GameLog` in `GamePanels.tsx` | Renders `state.history` strings | Collapsible under table; hidden at short viewports | — | All | **replace** with Layer 3 `TableEventLog` (bounded, deduped, mobile FAB) |
| Win/lose SFX | `lib/sounds.ts` `GameSounds.win/lose` | Every resolved bet with reveal | — | Loud CDN win/lose on every resolution | All | **replace** with gated optional cues via table sound setting |
| Turn/deal SFX | `yourTurn`, `deal`, `flip`, `timerTick` | Turn changes / timer | — | Existing | All | **keep but restyle** (respect master mute + table sound Off) |
| Sound FAB | `SoundControl.tsx` | Manual | Volume/mute UI | In-memory mute (not persisted) | Global | **keep**; **extend** with table effects + table sound |
| Theme persist | `store/uiThemeStore.ts` | Theme pick | — | zustand `persist` → `kouppi-ui-theme` | All | **reuse pattern** for effects prefs |

### Not found / out of scope

- No separate Career-only victory overlay beyond shared `RoundEndPanel` + career lobby `career:gameFinished` (clears session; not an in-table win popup).
- No Pixi/Phaser chip engine.
- No dedicated match-won/promotion modal beyond round-end standings when pot empties.

---

## 2. State / event mapping

### Authoritative sources

| Event class | Source | Fields available | Notes |
|-------------|--------|------------------|-------|
| Action resolved (bet/kouppi/shistri/pass) | `GameState.lastResolution` (`packages/game-core` `Resolution`) | `kind`, `playerId`, `upcards`, `reveal?`, `amount`, `win` | Set atomically with bankroll/pot updates. SHISTRI declare+resolve are **one** action (no separate pre-reveal declare state). |
| Human-readable history | `GameState.history: string[]` | Free-form log lines from reducer | Unbounded server-side; UI must bound display. Not ideal for dedupe keys. |
| Await UX | `awaitNext` | boolean | Cards stay visible; Next Turn (SP) or auto (MP). |
| Round / session end | `phase === "RoundEnd"`, MP `roundEnded`, `roundDecision`, `sessionSummary` | Standings, stay/leave, handsPlayed, biggestPot, mvp | **Major** — keep `RoundEndPanel`. |
| Local identity | SP: `players[0].id`; MP/Career: `remoteGameStore.playerId` | | |
| Names | `players[].name`, `isBot` | | |
| Current stake marker | `turn.betAmount` + `turn.playerId` while turn live | Cleared when resolution committed | Use for optimistic local chip-to-pot only. |
| Career match end | `careerLobbyStore` / `career:gameFinished` | Clears session; table uses same RoundEnd path | Do not invent promotion/relegation UI without payload. |

### Missing / must not invent

- Separate “declared SHISTRI” timestamp before reveal — **unavailable**. Layer 1 SHISTRI badge + Layer 2 copy use `lastResolution.kind === "shistri"` only.
- Currency symbol — history/UI use bare chip numbers; copy uses amounts without inventing `€` unless product already shows it (it does not in table HUD). Use bare numbers.
- Stable server event IDs — **none**. Client dedupe key: `${playerId}|${kind}|${win}|${amount}|${reveal.rank}-${reveal.suit}|${historyLength}` (or hash of those).

### Mode differences

| Concern | Single Player | Multiplayer / Career |
|---------|---------------|----------------------|
| Store | `gameStore` | `remoteGameStore` |
| Shell | `TableGraphics.tsx` | `MultiplayerTableGraphics.tsx` |
| Round end | Refill & Continue modal | Stay/Leave or host Play Again |
| Spectator | N/A | Read-only; same feedback, no actions |
| Optimistic chip on click | Yes | Yes for local intent; remotes via `lastResolution` only |

---

## 3. Layering / z-index map

### Current (relevant)

| Layer | Approx z | Notes |
|-------|----------|-------|
| Background props | 1 | |
| Dealer / pot | 5–10 | Inside table surface |
| Center cards | 20 | |
| Bet markers | 15 | |
| Seats | 25 | |
| Action dock | 40 | `game-stage-dock` |
| ChipFly / Celebration | 40–50 fixed inset | **Intrusive** |
| Confirm / RoundEnd | 50–60 | Allowed for major |
| Toast / connection | 100 | Meta |
| Conduct gate | 200 | |

### Proposed

| Layer | z / placement | Rule |
|-------|---------------|------|
| Physical chip travel | absolute inside `.poker-table-surface`, z ≈ 18 | Below seats (25), above pot chrome; `pointer-events: none` |
| Seat highlight | on seat wrapper | Soft gold outline; no cyan conflict |
| SHISTRI badge | near bet/safe zone, z ≈ 22 | Non-blocking |
| Result ribbon | central safe zone under dealer, above cards gap (~42–48% Y), z ≈ 22 | Never cover action dock |
| Event log desktop | `game-stage-secondary` / docked left | Max-height scroll |
| Event log mobile FAB | `fixed` left, **above** emote (`bottom ≈ 5.5rem`), z-45 | 44×44; sheet opens upward |
| Chat FAB | bottom-right z-50 | Unchanged |
| Emote FAB | bottom-left z-50 | Unchanged |
| RoundEnd / Confirm | z ≥ 50 | Major only |
| Celebration/confetti for normal wins | **gone** | |

---

## 4. Architecture proposal

### Shared modules (`apps/web`)

```
lib/tableEventFeedback/
  types.ts          — discriminated unions
  copy.ts           — ribbon/log copy builders
  normalize.ts      — lastResolution → TableFeedbackEvent
  dedupe.ts         — stable keys + seen-set
  queue.ts          — bounded ribbon queue + history
  index.ts

store/tableEffectsStore.ts   — effects: full|reduced|off; sound: on|off (zustand persist)

hooks/usePrefersReducedMotion.ts
hooks/useTableFeedbackFromGame.ts  — watches lastResolution + optional stake pulses

components/tableFeedback/
  TableEventFeedbackRoot.tsx       — provider + layers mount
  TablePhysicalFeedbackLayer.tsx
  TableResultRibbon.tsx
  TableEventLog.tsx
  TableEffectsControls.tsx         — wired into SoundControl
```

### Integration

- Both table shells wrap table region with `TableEventFeedbackRoot` and pass:
  - `lastResolution`, `players`, `localPlayerId`, `history`, `phase`
  - `tableSurfaceSelector` / container ref for anchor queries (`data-seat-id`, `data-pot-anchor`)
- Remove `Celebration` usage and `GameResultBanner` for resolutions.
- Replace bottom `GameLog` with `TableEventLog`.
- Gate `sounds.win/lose` behind table sound On + effects ≠ Off; prefer subtle chip cues.
- `prefers-reduced-motion` forces reduced visuals even if Full.

### Dedupe / lifecycle

- Seen-set of event keys (cap 64).
- Ribbon: one visible; priority replace; queue max 3.
- History: desktop 30 / mobile 16.
- Clear timers on unmount; ignore stale RAF if unmounted; Strict Mode: key-based idempotency not effect double-fire of animations with same key.

### Anchors

- `PokerTable` pot node: `data-pot-anchor="true"`.
- `TableSeatLayout` seat wrappers: `data-seat-id={player.id}`.

---

## 5. Replacement matrix

| Existing | Trigger | Replacement | Action | Test |
|----------|---------|-------------|--------|------|
| `Celebration` + Confetti | Local win | Layer 1 seat highlight + chip collect + Layer 2 ribbon | Delete usage (keep file unused or slim) | Integration: no full-screen text |
| `ChipFlyAnimation` random | Local bet | Layer 1 seat→pot | Replace | Normalize + physical intent |
| `GameResultBanner` | awaitNext | `TableResultRibbon` | Replace | Ribbon copy + timers |
| Shouting dealer message | awaitNext | Calm dealer label | Modify | Copy unit |
| `GameLog` / raw history dump | Always | `TableEventLog` | Replace | Bound + dedupe |
| `sounds.win/lose` always | Resolution | Optional table sound | Modify | Effects prefs tests |
| `RoundEndPanel` | RoundEnd / decisions | Same panel | Retain | Still shows on RoundEnd only |
| `ConfirmDialog` | Explicit confirms | Same | Retain | — |
| Toast for pot results | (not currently) | N/A | Do not add | — |

---

## 6. Acceptance criteria (verifiable)

1. Normal bet/win/loss/KOUPPI/SHISTRI never mounts `fixed inset-0` celebration or blocking dialog.
2. One compact ribbon max for normal events; auto-dismisses; no OK button.
3. Chip travel uses seat/pot anchors when DOM available; otherwise fades without teleport invention.
4. SHISTRI uses warm gold badge/ribbon; no confetti/shake/flash.
5. Event log bounded; no duplicate from same resolution key / Strict Mode remount of identical key.
6. Effects Full/Reduced/Off + sound On/Off persist via zustand; `prefers-reduced-motion` ≤ Reduced visuals.
7. Sound Off never calls win/lose playback helpers.
8. RoundEnd stay/leave / refill / play-again still uses `RoundEndPanel`.
9. Same feedback root used by Single Player and Multiplayer/Career shells.
10. Unit + component tests added; `pnpm --filter @kouppi/web test` focused suite passes; typecheck/build run and reported.
11. Manual script documented in `TABLE_EVENT_FEEDBACK_MANUAL_TEST.md`.

---

## Limitations documented for implementers

- No stable server event IDs → client composite keys only; reconnect may re-show if key fields identical but session remounts with cleared seen-set (seen-set is in-memory per mount).
- SHISTRI declaration is not a separate protocol event.
- Amounts displayed as chip integers (no currency).
- CDN sounds remain optional; no new copyrighted assets downloaded.
