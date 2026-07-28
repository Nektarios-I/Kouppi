# GAMEPLAY LIFECYCLE / ANTE / AVATAR SPEC

**Date:** 2026-07-26  
**Scope:** Result reveal delay, bankrupt→spectator, ante progression, avatar picker clipping  
**Modes:** Single Player, Multiplayer, Career

---

## 0. Architecture map (current)

| Concern | Authoritative owner | Key files |
|---------|---------------------|-----------|
| Rules / pot settlement | `@kouppi/game-core` reducer | `packages/game-core/src/reducer.ts`, `types.ts` |
| MP/Career room lifecycle | Server | `apps/server/src/rooms.ts`, `serverFactory.ts` |
| Stay/Leave | Server `Room.decision` + socket events | `serverFactory.ts` `handleRoundEnd` / `resolveDecisionPhase` |
| SP local game | Client Zustand + game-core | `apps/web/store/gameStore.ts`, `TableGraphics.tsx` |
| Protocol contracts | `@kouppi/protocol` | `packages/protocol/src/messages.ts` |
| Spectators | Server room list | `rooms.joinSpectator`, `SpectatorSession` |
| Avatar preference | Client + optional profile API | `AvatarPicker.tsx`, `remoteGameStore.setAvatar` |
| Career stakes | Server presets | `apps/server/src/career/tiers.ts` |

### Current pot-win → Stay/Leave sequence (MP/Career)

```
intent (bet|kouppi|shistri)
  → applyAction: settle chips, set lastResolution.reveal, pot<=0 → phase=RoundEnd
  → emitState (clients receive RoundEnd + lastResolution)
  → handleRoundEnd IMMEDIATELY
      → decision.active=true, roundDecisionStart
  → UI shows Stay/Leave overlay; center reveal path skipped (awaitNext=false)
```

Non-emptying resolves use `awaitNext=true` + server `scheduleFlowStep(1500ms)` — reveal works.

### Current bankrupt behavior

- Zero bankroll players remain seated; turns auto-pass (`reducer` startTurn).
- `Player.active` documented but never set false.
- Spectators exist but are **not** used for bankrupts.
- Minimum players: `<2` after Stay/Leave → no next round; all bankrolls ≤0 → `no_eligible_players` close.

### Current ante

- Flat `TableConfig.ante`; never changes mid-session.
- No `completedRounds` / progression config.
- Career: player picks server-preset `anteId`; cannot free-form ante.

### Current avatar clipping

- `WaitingRoom` → `LobbyCard` (`.lobby-card { overflow: hidden }`) → `AvatarPicker` popover (`position: absolute`).
- Structural clip; z-index cannot fix. Career/Settings already use `variant="inline"`.

---

## 1. ISSUE 1 — Result reveal before Stay/Leave

### Desired behavior

1. Resolve round authoritatively (unchanged settlement).
2. Keep result card(s) visible on the table.
3. Show normal result presentation (no Stay/Leave yet).
4. Wait `ROUND_RESULT_REVEAL_DELAY_MS` (default **3000**).
5. Then open Stay/Leave (MP/Career) or RoundEnd continue panel (SP).

### Ownership

| Layer | Responsibility |
|-------|----------------|
| **Server** | Single authoritative timer via existing `scheduleFlowStep` / `flowTimer`. After RoundEnd + emitState, schedule `handleRoundEnd` once. |
| **Shared constant** | `ROUND_RESULT_REVEAL_DELAY_MS = 3000` in `packages/game-core` (exported) so SP/server share one value. |
| **Client** | Render `lastResolution` reveal during RoundEnd when decision is not yet active. Do **not** start independent transition timers for Stay/Leave. |
| **game-core** | No duplicate settle; optionally keep `lastResolution` until `nextRound` (already true). |

### Sequence (MP/Career)

```
RoundEnd settled + emitState
  → mark revealPending (or reuse flowTimer only)
  → scheduleFlowStep(ROUND_RESULT_REVEAL_DELAY_MS)
      → if still RoundEnd && !decision.active → handleRoundEnd()
  → clients: show center cards from lastResolution while !roundDecision.active
  → roundDecisionStart → Stay/Leave UI
```

### Idempotency

- `handleRoundEnd` already returns if `room.decision?.active`.
- `scheduleFlowStep` clears prior `flowTimer` before scheduling.
- Reconnect during delay: receive `state` with RoundEnd + lastResolution; no Stay/Leave until server emits `roundDecisionStart`. On rejoin mid-decision, server must include decision snapshot in rejoin payload (fix if missing).
- Do not call `handleRoundEnd` from multiple sites without the delay wrapper once RoundEnd is reached via pot-empty (forced RoundEnd from attrition may keep delay for consistency).

### SP

- Delay showing `RoundEndPanel` by the same constant after local RoundEnd, while keeping center cards visible.
- Use one local timeout keyed to resolution identity; clear on unmount / new action.

### When Stay/Leave should NOT appear

- Non-emptying bet: continue using awaitNext + 1500ms next-player flow (unchanged).
- SP: never Stay/Leave; only delayed Continue/Exit panel.

### Acceptance

- [ ] Pot-empty win (normal bet / KOUPPI / SHISTRI): reveal visible ~3s before Stay/Leave (MP/Career) or Continue (SP).
- [ ] Single server timer; reconnect does not double-open decision.
- [ ] Constant configurable in one place.
- [ ] Table stable during delay (no nextRound yet).

---

## 2. ISSUE 2 — Automatic bankrupt removal at Stay/Leave

### Definition

**Bankrupt** = authoritative playable `bankroll <= 0` **after** pot settlement for the just-ended round.

- Do **not** remove before settlement.
- Winners who receive pot chips and become `> 0` stay eligible.
- Chips already in the pot are settled into bankrolls before this scan (game-core already does this synchronously).

### Timing

Run removal **after** reveal delay completes, **at the start of** `handleRoundEnd` (before Stay/Leave choices are offered to remaining actives), so bankrupts never get Stay/Leave.

Order:

1. Settlement (already done).
2. Reveal delay.
3. Scan & demote/remove bankrupts.
4. Start decision phase for remaining active players (≥0 bankroll).

### MP / Career behavior

For each bankrupt human:

1. Remove from `room.players` / game seats (`leaveRoom` + `syncGamePlayersToRoom`).
2. If `spectatorsAllowed` (or Career always allows watch): `joinSpectator` with same identity/socket.
3. Emit personal notice:  
   `"You have been removed from active play because you have no chips remaining. You may continue watching the game."`
4. Broadcast room update / system message that player is now spectating (or left if spectators not allowed).
5. Idempotent: skip if already spectator / already removed.

For bankrupt bots (SP only typically): remove from local player list; no spectator.

### Eligibility after demotion

- Not in Stay/Leave choices.
- Not charged ante, not dealt actionable turns, cannot bet.
- May observe via spectator UI if supported.

### Too few active players

Preserve existing rules:

- After demotions + Stay/Leave, if `< 2` actives → `roundDecisionEnd { started:false, reason:"not_enough_players" }` (no next round).
- If zero eligible bankrolls at turn start → `roomClosed` `no_eligible_players`.

### Single Player

- **Human bankrupt:** show clear out-of-chips message; primary actions Exit + optional “New table” (re-open Settings). No formal spectator model.
- **Bot bankrupt:** remove from active seats before next round continue; do not deal them.

### Career policy

- Reuse shared demote→spectator path (Career rooms share MP game sockets).
- Do **not** finalize Career trophies/rating on mid-match bankrupt; match accounting remains room-close / `handleCareerGameEnd`.
- Bankrupt spectator may watch until table ends.

### Acceptance

- [ ] Loser at 0 after settlement demoted before Stay/Leave.
- [ ] Winner paid above 0 not demoted.
- [ ] Multiple bankrupts handled; notifications idempotent.
- [ ] SP bots removed; SP human gets clear UX.
- [ ] Career progression not corrupted by mid-match demotion.

---

## 3. ISSUE 3 — Configurable ante progression

### Schema (authoritative, on `TableConfig`)

```ts
 AnteProgressionConfig = {
  enabled: boolean;              // default true
  intervalRounds: number;        // default 5, integer ≥ 1
  strategy: "MULTIPLY" | "ADD";  // default MULTIPLY
  multiplier: number;            // default 2 (MULTIPLY)
  incrementAmount: number | null;// default null (ADD uses positive int)
  maxAnte?: number | null;       // optional cap
  startingAnte: number;          // set at table create = chosen ante
}
```

Also store on `GameState`:

- `completedRounds: number` — incremented once when a round reaches RoundEnd (pot emptied / forced end).
- Derived display: `config.ante = deriveAnte(...)` immediately before each `ante` charge (and broadcast in state).

### Formula (deterministic, reconnect-safe)

```
completedIntervals = floor(completedRounds / intervalRounds)
MULTIPLY: ante = startingAnte * multiplier^completedIntervals
ADD:      ante = startingAnte + incrementAmount * completedIntervals
if maxAnte set: ante = min(ante, maxAnte)
ante = max(1, floor(ante))
```

Examples (enabled, interval 5, MULTIPLY×2, starting 10):

| completedRounds | intervals | ante |
|-----------------|-----------|------|
| 0–4 | 0 | 10 |
| 5–9 | 1 | 20 |
| 10–14 | 2 | 40 |

Round 6 (after 5 completed) uses doubled ante.

### Charge integration

Inside `applyAction({ type:"ante" })`:

1. Derive current ante from progression + `completedRounds`.
2. Write `state.config.ante` to derived value (broadcast consistency).
3. Charge each active player `min(bankroll, ante)` as today.

Increment `completedRounds` once when entering RoundEnd (reducer), not on reconnect/clicks.

### Mode UI

| Mode | Configurability |
|------|-----------------|
| **SP** | SettingsDialog: starting ante + progression on/off + presets (double every 5) + Advanced (interval, strategy, multiplier/increment, max). |
| **MP** | Host sets at CreateRoomDialog; lock after `started`; show summary in WaitingRoom + lobby listing (ante + progression blurb). Non-host cannot change (no mid-game API). |
| **Career** | **Server-controlled preset:** default progression `{ enabled:true, intervalRounds:5, strategy:MULTIPLY, multiplier:2 }` attached when building game config from `anteId`. Players cannot edit progression. UI may show read-only “Ante doubles every 5 hands”. |

### Players who cannot afford raised ante

Preserve current soft charge (`min(bankroll, ante)`). If bankroll becomes 0, Issue 2 removes them at next Stay/Leave boundary. Bots use same ante.

### Backward compatibility

- Missing progression → default enabled double-every-5 with `startingAnte = config.ante`.
- `enabled: false` → flat ante forever.
- Old Redis rooms: hydrate defaults on load.

### Acceptance

- [ ] Formula unit-tested; no compounding drift on reconnect.
- [ ] SP/MP creation UIs; Career locked preset.
- [ ] Host-only create-time config; locked after start.
- [ ] Bots pay same derived ante.

---

## 4. ISSUE 4 — Avatar picker clipping

### Desired UX

- Desktop: portaled anchored panel (escape overflow), keyboard accessible.
- Mobile (≤639px): portaled bottom sheet / full-width panel (HistoryDrawer pattern).
- Escape closes; focus returns to trigger; options scrollable; selection persists via existing `setAvatar` / preference path.

### Structural fix

Do **not** rely on z-index alone. Implement popover mode with `createPortal(..., document.body)` + fixed positioning (reuse `useOverlayDialog` + HistoryDrawer positioning). WaitingRoom may also use improved popover; Career/Settings remain inline.

### Acceptance

- [ ] Waiting room avatar options fully visible at 320/375/768/1024/1440.
- [ ] Keyboard + touch usable; Escape restores focus.
- [ ] Selection still persists.

---

## 5. Edge cases (cross-cutting)

| Case | Behavior |
|------|----------|
| Reconnect during reveal delay | See RoundEnd + cards; timer continues server-side; Stay/Leave when server fires |
| Duplicate RoundEnd signals | flowTimer replace + decision.active guard |
| Bankrupt winner edge | Impossible if settlement credited pot correctly |
| All players bankrupt after scan | Close / not_enough_players path |
| Ante progression disabled | Flat starting ante |
| Career mid-match spectator | Watch only; match end still accounts seated finishers per existing Career end logic — document if spectators excluded from standings |

---

## 6. Product decisions locked in this spec

1. **Career ante progression:** server-preset default (double every 5), not player-editable.  
2. **SP human zero bankroll:** Exit + New table; no spectator.  
3. **Too few actives after bankrupt demotion:** existing `<2` / `no_eligible_players` behavior.  
4. **Reveal delay owner:** server for MP/Career; shared constant for SP local delay.
