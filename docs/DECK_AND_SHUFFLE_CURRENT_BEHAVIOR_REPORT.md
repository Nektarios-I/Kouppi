# KOUPPI Current Deck and Shuffle Behavior Report

## Scope and method

This report is based on direct code inspection across `packages/game-core`, `apps/server`, `packages/protocol`, `apps/web`, and current tests. It documents **current behavior only** (pre-implementation for new deck options).

## 1) What is a KOUPPI deck today?

- **Base deck size is 52 cards**, not 56.
- Deck creation is in `packages/game-core/src/deck.ts`:
  - `fullDeck()` builds suits `["S","H","D","C"]`.
  - For each suit, ranks `1..13` are created.
  - Total = `4 * 13 = 52`.
- Card type is in `packages/game-core/src/types.ts`:
  - `Card = { rank: Rank; suit: Suit }`.
  - No card instance id / no physical deck instance id.
- There are no jokers, specials, or extra cards in deck construction.

## 2) How cards are currently created

- Initial game creation occurs in `packages/game-core/src/reducer.ts`:
  - `initGame()` creates RNG via `makeRng(seed)`.
  - Deck is initialized as `shuffle(fullDeck(), rng)`.
- Lifecycle today is **single running deck + discard pile**:
  - `GameState` has `deck: Card[]` and `discard: Card[]` (`types.ts`).
  - Cards are moved from deck to discard during play.
  - No per-round fresh deck construction exists.
- `TableConfig.deckPolicy` currently exists in types, but only one value:
  - `"single_no_reshuffle_until_empty"` (`types.ts`, protocol schema).
  - It is effectively placeholder/legacy naming; there is no second policy behavior implemented.

## 3) How cards are currently shuffled

- Shuffle algorithm is in `packages/game-core/src/deck.ts`:
  - `shuffle(cards, rand)` uses Fisher-Yates/Knuth style backward swap loop.
  - This is an unbiased algorithm when `rand` is uniform.
- RNG source:
  - `packages/game-core/src/rng.ts` implements deterministic `mulberry32`.
  - `initGame()` uses `makeRng(seed)`; production seeds are server/client provided per mode.
- Ownership:
  - Multiplayer/Career authoritative state is server-side (`apps/server/src/rooms.ts`, `serverFactory.ts`).
  - Single-player is browser-local authoritative store (`apps/web/store/gameStore.ts`).
- Security/strength:
  - Shuffle algorithm is good.
  - RNG is deterministic PRNG, not cryptographically secure.
  - Seeds are generated with `Math.random()` in several places (server room seed, single player seed), so randomness is not cryptographic.
- No `array.sort(() => random - 0.5)` found in game-core deck paths.

## 4) How cards are drawn/removed/reset today

- Draw helper in `packages/game-core/src/deck.ts`:
  - `draw(deck, n)` returns top `n` and remaining deck.
- Card usage in reducer (`packages/game-core/src/reducer.ts`):
  - `determineStarter`: draws 1 card per player, then pushes those cards to discard.
  - `startTurn`: draws 2 upcards.
  - `pass`: pushes upcards to discard.
  - `bet/kouppi/shistri`: draws reveal card, then pushes all 3 cards to discard.
- Exhaustion behavior:
  - `ensureDraw(state, need)` checks if deck has enough cards.
  - If insufficient and discard has cards, it reshuffles `discard` into new `deck` immediately.
  - This can happen mid-turn (before upcards or reveal draw), so current behavior permits emergency reshuffle during action flow.
- Round reset behavior:
  - `nextRound` resets pot/turn indexes, but does **not** rebuild a fresh deck.
  - Deck/discard continue across rounds unless emergency reshuffle occurs when deck runs low.
- Reconnect behavior:
  - Multiplayer/Career room state includes full `GameState` in memory and is rebroadcast (`buildStatePayload` in `apps/server/src/rooms.ts`).
  - Reconnect receives current `deck`/`discard` arrays as part of state snapshot.
  - In distributed mode, room snapshot hydration is via store abstraction (`apps/server/src/stores/*`), with game state included.

## 5) Current behavior by mode

### Single Player (bots)

- Authoritative logic runs in client store `apps/web/store/gameStore.ts`.
- `configureSinglePlayer()` always sets `deckPolicy: "single_no_reshuffle_until_empty"`.
- `initGame()` called in browser with seed `Math.floor(Math.random() * 1e9)`.
- Round flow in `apps/web/components/TableGraphics.tsx` dispatches reducer actions locally.
- Uses same game-core deck/draw/discard behavior as multiplayer, but not server-authoritative.

### Manual Multiplayer rooms

- Room creation via socket `createRoom` (`apps/server/src/serverFactory.ts`).
- Config merged with server defaults in `createRoomWithCreator()` (`apps/server/src/rooms.ts`).
- Game starts with `startRoom()` -> `initGame()` server-side.
- Draw/shuffle/discard and lifecycle are server-authoritative using game-core reducer.
- Clients only send intents (`pass`, `bet`, `kouppi`, `shistri`) and render snapshots.

### Auto-created multiplayer / matchmaking tables

- Career matchmaking and waiting-room flows auto-create game rooms in `apps/server/src/career/careerRoomManager.ts` (`triggerGameStart`).
- Uses `createRoomWithCreator()` and fixed `gameConfig` with `deckPolicy: "single_no_reshuffle_until_empty"`.
- Seeds generated with `Math.random()` server-side.
- Same authoritative reducer deck lifecycle.
- No separate non-career auto-matchmaker path found for casual multiplayer.

### Career Mode

- Career waiting/matchmaking is server-controlled (`careerSocketHandlers.ts`, `careerRoomManager.ts`).
- Final game room uses standard multiplayer room/game-core state and server authority.
- Deck config is server-fixed in `triggerGameStart()` to single policy value.

## 6) Exact integration points

### Game-core

- Deck construction/shuffle/draw: `packages/game-core/src/deck.ts`
- RNG: `packages/game-core/src/rng.ts`
- State/config/card types: `packages/game-core/src/types.ts`
- Lifecycle and draw/discard calls: `packages/game-core/src/reducer.ts`

### Server / rooms

- Room defaults and config merge: `apps/server/src/rooms.ts` (`defaultConfig`, `createRoomWithCreator`)
- Game startup: `apps/server/src/rooms.ts` (`startRoom`)
- Socket create/join/start flow: `apps/server/src/serverFactory.ts`
- Career auto room creation: `apps/server/src/career/careerRoomManager.ts` (`triggerGameStart`)

### Multiplayer events and sync

- Intent handling and authoritative apply: `apps/server/src/rooms.ts` (`handleClientIntent`, `applySystemIntent`)
- State broadcast: `apps/server/src/rooms.ts` (`buildStatePayload`)
- Socket events: `apps/server/src/serverFactory.ts`

### Client stores

- Multiplayer client state and room create payload: `apps/web/store/remoteGameStore.ts`
- Single-player local reducer authority: `apps/web/store/gameStore.ts`
- Career waiting/matchmaking UI state: `apps/web/store/careerLobbyStore.ts`

### Single-player setup UI

- Settings form: `apps/web/components/SettingsDialog.tsx`
- Single-page flow: `apps/web/app/play/single/page.tsx`

### Multiplayer room creation UI

- Host create dialog: `apps/web/components/CreateRoomDialog.tsx`
- Room page/waiting room display: `apps/web/app/room/[id]/page.tsx`, `apps/web/components/game/WaitingRoom.tsx`

### Career configuration

- Socket handlers for career flows: `apps/server/src/career/careerSocketHandlers.ts`
- Career game config at transition to real table: `apps/server/src/career/careerRoomManager.ts`

### Tests touching current behavior

- Game-core flow/reducer invariants: `packages/game-core/tests/*`
- Room and socket integration: `apps/server/tests/rooms.test.ts`, `apps/server/tests/socket.test.ts`, plus career tests.

## 7) Current risks relevant to requested feature

- **Card identity collisions for multi-deck shoes**: card objects are rank+suit only; duplicates across decks cannot be uniquely represented.
- **Randomness strength**: deterministic mulberry32 and `Math.random()` seeding are not cryptographically secure.
- **Mid-turn reshuffle risk**: `ensureDraw()` can reshuffle discard during action flow when deck is short.
- **Policy mismatch risk**: `deckPolicy` type exists but behavior is single path; UI labels could imply options that engine does not enforce.
- **Single-player authority split**: single-player is client-authoritative today, unlike multiplayer/career.
- **Reconnect/restore assumptions**: reconnect currently restores deck/discard arrays, but no explicit shoe metadata (generation counter, deck count, policy) exists.
- **Serialization/keying assumptions**: UI/components/tests assume card shape without card id; adding id must preserve rendering/rules.
- **Protocol schema lock-in**: `RoomConfig.deckPolicy` only allows one literal value (`packages/protocol/src/messages.ts`), so new policies require protocol updates.
- **Validation gaps**: deck count is not modeled anywhere today; no centralized allowed value set exists.

## Summary

KOUPPI currently runs a 52-card single-deck-equivalent lifecycle with a shared deck+discard model, Fisher-Yates shuffle, deterministic seeded PRNG, and emergency reshuffle from discard whenever draw demand exceeds remaining deck. The authoritative server controls multiplayer/career draws, while single-player runs locally in browser state. There is no implemented fresh-deck-per-round policy, no true continuous-shoe metadata model, no multi-deck support, and no unique physical card identity required for duplicate cards across multiple decks.
