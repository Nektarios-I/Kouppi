# Deck Configuration Specification (Normalized)

## Goals

Introduce two authoritative per-table rules across KOUPPI:

1. **Card reuse / shuffle policy**
   - `RESET_EACH_ROUND` (UI: Fresh Deck Every Round)
   - `CONTINUOUS_SHOE` (UI: Continuous Shoe)
2. **Number of physical decks in shoe**
   - Allowed values: `[1, 3, 5, 7, 9]`

## Definitions

### Deck Shuffle Policy

- `RESET_EACH_ROUND`:
  - Build full shoe from `deckCount` physical decks at round start.
  - Shuffle that shoe.
  - Use only during that round.
  - Next round always starts from full freshly shuffled shoe.

- `CONTINUOUS_SHOE`:
  - Build full shoe from `deckCount` physical decks once when table starts.
  - Draw across rounds from remaining cards.
  - No drawn card returns until a reshuffle boundary.
  - If remaining cards are insufficient for the next round requirement, rebuild+shuffle full shoe **before that round starts**.
  - Never reshuffle mid-round.

### Number of Decks

- Strict allowed list for V1: `1, 3, 5, 7, 9`
- Values outside this list are invalid at runtime and API boundary.

## Authoritative ownership

- Multiplayer, auto-created tables, and Career: server authoritative.
- Single-player uses shared game-core deck engine; local authority remains as existing architecture, but rules are still enforced by shared reducer/engine.
- Client only submits intents and table-create config; draw/shuffle decisions are derived from authoritative state transitions.

## Type/schema design

## Core constants/types (game-core, exported)

- `ALLOWED_DECK_COUNTS = [1, 3, 5, 7, 9] as const`
- `type DeckCount = 1 | 3 | 5 | 7 | 9`
- `type DeckShufflePolicy = "RESET_EACH_ROUND" | "CONTINUOUS_SHOE"`
- Defaults:
  - `DEFAULT_DECK_COUNT = 1`
  - `DEFAULT_DECK_SHUFFLE_POLICY = "RESET_EACH_ROUND"`

## Card identity

- Extend internal card shape with unique physical identity:
  - `id: string` (stable, serializable, unique within shoe generation)
  - existing fields retained: `rank`, `suit`
- Identity format (implementation detail): deterministic string from deck instance + base card + copy index.
- Duplicate rank/suit cards across multi-deck shoes must still have distinct `id`.

## Shoe state (explicit)

Add state object to authoritative game state:

- `deckCount`
- `shufflePolicy`
- `baseDeckSize`
- `shoeSize` (baseDeckSize * deckCount)
- `remaining` (derived from active draw pile length)
- `generation` (increment each time full shoe is rebuilt+shuffled)
- `shuffleCount` (same as generation in V1 or separate counter)

For `CONTINUOUS_SHOE`, this persists across rounds.
For `RESET_EACH_ROUND`, generation increments per round initialization.

## Round card requirement / reshuffle threshold

Based on current KOUPPI flow:

- `determineStarter` currently consumes cards only once at game start.
- Every subsequent player turn consumes:
  - `2` upcards
  - optional `+1` reveal on bet/kouppi/shistri
- Current round ends when pot reaches 0; rounds can have variable turn counts.

V1 safety rule:

- In `CONTINUOUS_SHOE`, only reshuffle at **round boundary**.
- At start of new round, if remaining cards are below **minimum start buffer**, rebuild shoe.
- Minimum start buffer is derived from guaranteed per-turn needs and active players:
  - At least enough for one full orbit start-turn deal: `2 * activePlayers`
  - plus reveal safety for first actionable decision: `+1`
- No mid-round reshuffle; if extreme exhaustion occurs due unexpectedly long round, the engine must gracefully force boundary handling by pre-round thresholds and conservative checks.

## Lifecycle rules

### Game/table start

- Normalize incoming config (`deckCount`, `shufflePolicy`) with strict validation and defaults.
- Build initial shoe according to policy:
  - `RESET_EACH_ROUND`: can build initial shoe lazily on first round start.
  - `CONTINUOUS_SHOE`: build immediately before first round actions.

### Round start

- `RESET_EACH_ROUND`: always rebuild + shuffle full configured shoe.
- `CONTINUOUS_SHOE`: reuse remaining shoe; rebuild only if pre-round threshold check fails.

### In-round draw

- Draw only from current active shoe.
- No emergency discard reshuffle mid-round.
- Draw function errors/guards if impossible draw requested.

### Round end and reveal timing

- Keep dealt/revealed cards valid through result display phase.
- Discard bookkeeping happens after resolution logic without removing card identity from event payload.

### Reconnect

- State snapshot includes full authoritative deck/shoe state needed to continue exact remaining shoe.
- Reconnect must never trigger implicit fresh shoe.

### Game end / table reset

- Existing reset/start flows rebuild from config defaults or stored room config.
- Rules are immutable once game starts.

## Backward compatibility

- Any room/config payload missing new fields is normalized to:
  - `deckCount: 1`
  - `shufflePolicy: "RESET_EACH_ROUND"`
- Existing active rooms continue with normalized defaults; no crash on undefined fields.
- Protocol parsers accept omitted fields for older clients, but server defaults enforce canonical values.

## Mode policy matrix

### Single Player

- User-selectable before game start:
  - Fresh Deck Every Round / Continuous Shoe
  - Number of Decks: 1,3,5,7,9
- After start: read-only display only.

### Manual Multiplayer rooms

- Host-selectable at room creation only.
- Server validates values.
- Non-host cannot override.
- All players see summary in waiting and in-game info.

### Auto-created multiplayer tables

- Server-only centralized default policy:
  - `deckCount: 1`
  - `shufflePolicy: "RESET_EACH_ROUND"`
- No client override.

### Career mode

- Server-controlled policy only.
- V1 policy:
  - `deckCount: 1`
  - `shufflePolicy: "RESET_EACH_ROUND"`
- No player configurability in ranked fairness paths.

## UX requirements

- Player-facing labels must be:
  - **Fresh Deck Every Round**
  - **Continuous Shoe**
  - **Number of Decks**
- Descriptions:
  - Fresh Deck Every Round: “All cards return to the shoe and are shuffled before each new round.”
  - Continuous Shoe: “Played cards stay out until the shoe needs reshuffling.”
  - Deck count helper: “Choose how many full decks are combined into the shoe.”
- In-game read-only summary shows:
  - policy label
  - deck count

## Validation rules

- Deck count must be one of `[1,3,5,7,9]`.
- Shuffle policy must be one of enum values.
- Validation enforced in:
  - protocol payload parsing
  - server room creation
  - game-core config normalization
  - client forms (UI constraints only, not authoritative).

## Acceptance criteria

- Both policies functionally distinct and test-covered.
- Multi-deck shoes produce exact card counts and unique card ids.
- Continuous shoe never draws card outside remaining pool.
- No mid-round reshuffle in continuous mode.
- Reconnect preserves exact remaining shoe.
- Host-only settings are enforced server-side.
- Auto/Career tables do not depend on client-provided deck config.
- Old rooms/configs load with default compatibility.
