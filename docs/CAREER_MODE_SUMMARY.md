# KOUPPI Career Mode Summary

## Document Purpose

This document synthesizes the findings from `CAREER_MODE_TECHNICAL_REPORT.md` with an understanding of the improved multiplayer architecture. It serves as the foundation for Sprint 1 and subsequent Career Mode implementation sprints.

**Created**: 2026-07-16  
**Based on**: CAREER_MODE_TECHNICAL_REPORT.md (8 sections)

---

## 1. Current Architecture Overview

### 1.1 Career Mode Components

**Server (`apps/server/src/career/`)**:
- `careerRoomManager.ts` - Career-specific room tracking and game-end handling
- `careerSocketHandlers.ts` - Socket.IO handlers for career lobby events
- `queue.ts` - Queue management per tier/ante
- `tiers.ts` - 6-tier system (Bronze → Master) with trophy requirements
- `profileRoutes.ts` - REST API for profiles, leaderboards, match history
- `rating.ts` (in @kouppi/database) - Elo calculations

**Client (`apps/web/`)**:
- `app/career/page.tsx` - Career lobby page
- `components/CareerLobby.tsx` - UI for tier/ante selection and waiting room
- `store/careerLobbyStore.ts` - Career lobby state management
- `store/careerStore.ts` - Player profile/stats/trophies state

**Database (`packages/database/`)**:
- `schema.ts` - users, matches, sessions tables
- `rating.ts` - Elo rating calculations
- SQLite with JWT auth


### 1.2 Career Flow (Current Implementation)

**Player Entry**:
1. User navigates to `/career`
2. JWT auth verification (must be logged in)
3. `careerLobbyStore` loads player profile from `careerStore`
4. Displays current tier, trophies, rating

**Tier/Ante Selection**:
1. Player selects tier (must unlock via trophies)
2. Player selects ante (affects rewards/risk)
3. Clicks "Join Queue"
4. Socket event: `career:joinAnte` → server adds player to queue

**Matchmaking (Current)**:
- Server maintains separate queues per `tier-ante` combination
- When 2+ players in same tier-ante queue → creates career game
- Room ID: `career-game-{uuid}`
- Auto-starts after 30s or when ready
- NO fallback if insufficient players in tier/ante

**Game Transition**:
1. Server emits `career:transitionToGame` with `roomId`
2. Client navigates to `/room/{roomId}`
3. Special handling: `subscribeToCareerRoom` instead of `joinRoom`
4. Game uses `/room/[id]/page.tsx` and `MultiplayerTableGraphics`

**Game End**:
1. `serverFactory.ts` detects career game via `isCareerGame(roomId)`
2. Calls `handleCareerGameEnd()` in `careerRoomManager.ts`
3. Updates ratings, trophies, match records in DB
4. Emits `career:gameEnd` to players with results


---

## 2. Current Behavior Analysis

### 2.1 Tier System

**6 Tiers** (defined in `tiers.ts`):
1. **Bronze** - 0 trophies (starting)
2. **Silver** - 300 trophies
3. **Gold** - 800 trophies
4. **Platinum** - 1,500 trophies
5. **Diamond** - 2,500 trophies
6. **Master** - 4,000 trophies

**Ante System**:
- Each tier supports multiple ante levels (10, 25, 50, 100)
- Higher ante = higher stakes, more trophies at risk

### 2.2 Rating & Progression

**Elo System**:
- Initial rating: 1000
- K-factor: 32 (rating volatility)
- Win/loss adjusts rating via `calculateRatingChange()`
- Rating displayed but NOT used for matchmaking currently

**Trophy System**:
- Win: +X trophies (based on ante/tier)
- Loss: -Y trophies
- Trophies determine tier unlock
- NO trophy floor enforcement (players can drop below tier gates)


### 2.3 Matchmaking Behavior

**Current Logic** (`queue.ts`):
- Separate queue per `{tierId}-{ante}` key
- When queue has 2+ players → immediate match
- 30-second auto-start timer after match creation
- Players leave queue if they disconnect or cancel

**Problems**:
- **No cross-tier pairing**: Player stuck if tier/ante has 0-1 other players
- **No rating-based pairing**: All players in tier paired equally
- **No fallback**: Low concurrency = indefinite wait
- **No bot fallback**: Unlike single-player mode

### 2.4 Identity & Auth

**Current State**:
- Career Mode REQUIRES JWT auth (enforced at `/career` page)
- Uses `authStore` for token and user profile
- Socket handlers verify token via `verifyToken()`
- Player identity = DB user.id (not sessionStorage id)

**Inconsistency**:
- Casual multiplayer supports both logged-in and guest players
- Career Mode only supports logged-in players
- Socket identity verification happens server-side on career events


---

## 3. Critical Issues (from Technical Report)

### 3.1 CRITICAL: No Low-Concurrency Fallback

**Problem**: If a tier/ante has 0-1 players online, matchmaking never triggers.

**Impact**:
- Early game launch = most players wait indefinitely
- Tier fragmentation = higher tiers unplayable
- Ante fragmentation = only popular antes work

**Evidence**:
- `queue.ts` only matches within exact `{tier}-{ante}`
- No timer to widen search
- No bot opponent option
- No cross-tier pairing logic

**Severity**: CRITICAL - makes Career Mode unusable at low concurrency

---

### 3.2 CRITICAL: Career Games Bypass Improved Multiplayer

**Problem**: Career games use separate room creation flow, missing recent multiplayer fixes.

**What's Missing**:
- ✗ `joinRoom()` with join-after-start guard
- ✗ `joinAsSpectator()` support
- ✗ Password/private room support
- ✗ Reconnection token validation
- ✗ Socket identity binding on game start
- ✗ Host controls (kick, transfer, close)
- ✗ Chat moderation (mute, ban)

**Current Flow**:
- Career room created via `careerRoomManager.createCareerRoom()`
- Players use `subscribeToCareerRoom` (not `joinRoom`)
- No join session token validation
- No spectator support

**Evidence**:
- `careerSocketHandlers.ts` defines custom `subscribeCareerRoom` handler
- Does NOT call `createRoomWithCreator()` or `joinRoom()` from `rooms.ts`
- Missing security checks added in recent multiplayer improvements

**Severity**: CRITICAL - security, UX, and feature gap


---

### 3.3 HIGH: Trophy Floor Not Enforced

**Problem**: Players can drop below tier unlock thresholds.

**Example**:
- Player reaches 800 trophies → unlocks Gold tier
- Plays Gold tier, loses → drops to 750 trophies
- Still allowed to play Gold tier (should drop to Silver)

**Impact**:
- Tier unlocks become meaningless
- Lower-skilled players trapped in higher tiers
- Unfair matchmaking (wide skill variance in same tier)

**Severity**: HIGH - undermines ladder integrity

---

### 3.4 HIGH: Socket Identity Not Verified

**Problem**: Career game transitions don't verify socket ownership.

**Attack Vector**:
1. Attacker observes `career:transitionToGame` event with `roomId`
2. Attacker calls `subscribeToCareerRoom` with victim's `playerId`
3. Attacker joins game as victim if socket identity not verified

**Current State**:
- `subscribeToCareerRoom` checks playerId exists in career game
- Does NOT verify socket.id matches DB user's active session
- No join session token validation

**Severity**: HIGH - identity spoofing risk


---

### 3.5 MEDIUM: Code Duplication

**Problem**: Career Mode reimplements room management instead of reusing `rooms.ts`.

**Duplicated Logic**:
- Room state tracking (`careerRoomManager` vs `rooms.ts`)
- Player join/leave handling
- Game end processing
- Socket event handling

**Impact**:
- Bug fixes in `rooms.ts` don't apply to Career Mode
- Career Mode missing features (spectators, reconnection, etc.)
- Maintenance burden (two codebases for similar functionality)

**Severity**: MEDIUM - technical debt

---

### 3.6 MEDIUM: Matchmaking Always Same Tier/Ante

**Problem**: No cross-tier or rating-based pairing.

**Current**:
- Only pairs players in exact `{tier}-{ante}` bucket
- Elo rating calculated but unused for pairing

**Desired**:
- Expand search after X seconds (e.g., allow ±1 tier)
- Use Elo for fair pairing within expanded range
- Placement matches for new players

**Severity**: MEDIUM - hurts UX at low concurrency


---

## 4. How Improved Multiplayer Works

### 4.1 Room Creation & Join Flow

**Casual Multiplayer (Current Best Practice)**:

1. **Room Creation**:
   - Client calls `createRoom()` with `CreateRoomPayload`
   - Server validates creator identity (JWT auth optional)
   - Calls `createRoomWithCreator()` in `rooms.ts`
   - Returns `joinSessionToken` for reconnection
   - Room added to in-memory map with unique ID

2. **Room Join**:
   - Client calls `joinRoom()` with `JoinRoomPayload`
   - Server resolves room by ID or code
   - Validates password if private room
   - Validates `joinSessionToken` if reconnecting
   - Calls `joinRoom()` in `rooms.ts` with join guards:
     - ✓ Room not full
     - ✓ Game not started (unless reconnecting)
     - ✓ Player not banned
     - ✓ Slot not taken
   - Returns snapshot + room data

3. **Spectator Join**:
   - Client calls `joinAsSpectator()`
   - Server validates room allows spectators
   - Adds spectator to `room.spectators` array
   - Spectator receives state but cannot send intents


### 4.2 Security & Identity Features

**Join Session Tokens**:
- Generated per player when joining room
- Stored in client `sessionStorage`
- Validates reconnection attempts
- Prevents slot hijacking

**Password Protection**:
- Room creator sets optional password
- Server hashes password (bcrypt)
- Join requires correct password
- Applies to both players and spectators

**Socket Identity Binding**:
- Player's socketId tracked in `room.players[].socketId`
- Intent validation checks socket matches player slot
- Disconnect grace period allows reconnection
- Promotes new host if current host disconnects

**Rate Limiting**:
- `checkEventRateLimit()` per socket per event
- Prevents spam (createRoom, joinRoom, chat, emotes)
- Configurable limits per event type

**Sanitization**:
- Display names sanitized (profanity filter, length limits)
- Chat messages sanitized
- Emotes validated


### 4.3 Reconnection & Disconnect Handling

**Disconnect Grace Period**:
- When player disconnects, starts `RECONNECT_GRACE_MS` timer (60s)
- Player's slot reserved during grace period
- Broadcasts "X disconnected" to room
- If player reconnects with valid token → rejoins seamlessly
- If timer expires → player removed, game continues

**Spectator Disconnect**:
- Similar grace period for spectators
- Spectators can rejoin without affecting game state

**AFK Tracking**:
- Turn timer triggers timeout if player doesn't act
- `incrementAfkCount()` tracks consecutive AFKs
- After 3 AFKs → player auto-kicked
- Prevents games from stalling

### 4.4 Host Controls

**Host Privileges** (from improved multiplayer):
- Start game (when all ready)
- Kick player (except during their turn)
- Transfer host to another player
- Close room (ends session for all)
- Mute/unmute chat (entire room or specific player)
- Ban player (prevents rejoin)

**Career Mode Gap**:
- Currently NO host controls in Career games
- All Career games auto-start on timer
- No kick/ban/mute features


### 4.5 Game UI & State Management

**Room Page (`/room/[id]/page.tsx`)**:
- Used by BOTH casual and career games
- Detects career game via `roomId.startsWith("career-game-")`
- Handles:
  - Identity setup (name, avatar)
  - Waiting room (pre-game lobby)
  - Password modal (private rooms)
  - Spectator option (if room full/started)
  - Game rendering via `MultiplayerTableGraphics`

**MultiplayerTableGraphics**:
- Renders game table with `PokerTable` + `CenterCards`
- Handles intents (bet, pass, kouppi, shistri)
- Displays turn timer, pot, player bankrolls
- Chat, emotes, sounds
- Round-end screen with standings
- Session summary stats (hands played, MVP, biggest pot)
- Host controls UI (if host)

**RemoteGameStore**:
- Single source of truth for multiplayer state
- Socket.IO event handlers (state, roomUpdate, chatMessage, etc.)
- Methods: `createRoom()`, `joinRoom()`, `subscribeToCareerRoom()`, `sendIntent()`, etc.
- Syncs with `sessionStorage` for reconnection


---

## 5. How Career Mode Should Reuse Improved Multiplayer

### 5.1 Room Creation (Server-Side)

**Current Career Flow**:
```
careerRoomManager.createCareerRoom(players, config) 
→ Manual room object construction
→ Store in career-specific map
```

**Proposed**:
```
createRoomWithCreator(roomId, creator, config, seed, password?, code?, metadata)
→ Reuse rooms.ts logic
→ Add metadata: { careerTier, careerAnte, matchType: "career" }
→ Store in unified room map
```

**Benefits**:
- Join guards (full, started, banned) automatically enforced
- Join session tokens for reconnection
- Host promotion on disconnect
- Spectator support
- Chat moderation features

---

### 5.2 Room Join (Client-Side)

**Current Career Flow**:
```
subscribeToCareerRoom(roomId) 
→ Custom socket handler
→ No join validation
```

**Proposed**:
```
joinRoom(roomId, password?, joinSessionToken?)
→ Standard join flow
→ Server validates: player in matched pair, room exists, token valid
→ Returns snapshot + room data + new token
```

**Benefits**:
- Consistent UX with casual multiplayer
- Password support for private career tournaments (future)
- Reconnection token validation


---

### 5.3 What Career Mode Must Keep Distinct

**Matchmaking Logic**:
- Career-specific queue management (`queue.ts`)
- Tier/ante-based pairing (with expansion for low concurrency)
- Elo rating calculations

**Game End Processing**:
- Trophy/rating updates (`handleCareerGameEnd`)
- Match history recording (`matches` table)
- Leaderboard updates
- Reward distribution (future)

**Entry/Exit Flow**:
- `/career` lobby page (tier selection, stats display)
- Trophy-based tier unlocks
- Trophy floor enforcement
- Season progress tracking (future)

**Auth Requirements**:
- JWT auth mandatory (no guest players)
- User profile integration (`careerStore`)
- Persistent identity across sessions

---

### 5.4 Recommended Architecture Changes

**Phase 1 (Sprint 1): Stabilize & Reuse**
1. Career rooms created via `createRoomWithCreator()` with career metadata
2. Players join via `joinRoom()` with career-specific validation
3. Remove `subscribeToCareerRoom` handler (redundant)
4. Add trophy floor checks to matchmaking
5. Verify socket identity on career game join
6. Implement reconnection tokens for career games

**Phase 2 (Sprint 2): Matchmaking**
7. Enhanced queue with cross-tier expansion after timeout
8. Bot opponent fallback for low concurrency
9. Placement matches for new players (first 10 games)

**Phase 3 (Sprint 3): Progression**
10. Trophy rewards based on ante/tier
11. Season system with reset schedule
12. Arena milestones (every X trophies in tier)
13. Leaderboard improvements (per tier, global)

**Phase 4 (Sprint 4): Polish**
14. Anti-cheat: rate limiting, behavior analysis
15. Match replays (save game history)
16. Career-specific emotes/badges
17. Tournament mode (future)


---

## 6. High-Level Requirements (Clash Royale-Style Ladder)

### 6.1 Core Ladder Mechanics

**Trophy System**:
- Win/loss adjusts trophy count
- Trophy floors at tier gates (can't drop below unlock threshold)
- Trophy-based matchmaking range (±100 trophies, expanding if no match)

**Arena/Tier Progression**:
- 6 tiers (Bronze → Master) with trophy requirements
- Each tier unlocks higher ante games and better rewards
- Visual progression (badges, arena themes)

**Season System**:
- Season duration: 4 weeks
- Season-end rewards based on peak trophies
- Partial trophy reset at season start (drop to tier floor + 50%)
- Leaderboard resets each season

### 6.2 Matchmaking Requirements

**Low Concurrency Handling**:
- **Tier expansion**: After 15s, allow ±1 tier matches
- **Bot fallback**: After 30s with no match, offer bot opponent
- **Placement matches**: First 10 games pair with other placements or Bronze players

**Fair Pairing**:
- Primary: Trophy range (±100, expanding to ±200 after 15s)
- Secondary: Elo rating (within trophy range, prefer close rating)
- Avoid: Recent opponents (don't rematch same player within 5 games)


### 6.3 Progression & Rewards

**Trophy Rewards**:
- Win: Base trophies (ante × 2) + streak bonus
- Loss: -Base trophies (ante × 1.5)
- Trophy floor prevents dropping below tier unlock

**Elo Rating**:
- Separate from trophies (matchmaking only)
- K-factor: 32 (standard chess)
- Displayed in profile but not primary ranking

**Rewards (Future)**:
- Daily/weekly quests
- Season-end rewards (emotes, badges, titles)
- Milestone chests (every 100 trophies)

### 6.4 Security & Anti-Cheat

**Identity Verification**:
- JWT auth required for Career Mode
- Socket identity verified on join
- Join session tokens prevent hijacking

**Rate Limiting**:
- Queue join: max 10/min
- Game actions: inherit from multiplayer
- Report spam prevention

**Behavior Monitoring**:
- Detect rapid win/loss (sandbagging)
- Track disconnect rate (rage quit detection)
- Flag suspicious Elo swings


---

## 7. Sprint 1 Preparation (Next Steps)

### 7.1 Files to Review for Sprint 1

**Critical Reading**:
- `apps/server/src/career/careerRoomManager.ts` - Room creation and tracking
- `apps/server/src/career/careerSocketHandlers.ts` - Socket events
- `apps/server/src/career/queue.ts` - Matchmaking queue logic
- `apps/web/store/careerLobbyStore.ts` - Client lobby state
- `apps/web/components/CareerLobby.tsx` - Lobby UI
- `packages/database/src/schema.ts` - DB tables
- `packages/database/src/rating.ts` - Elo calculations

**Reference Files** (improved multiplayer):
- `apps/server/src/rooms.ts` - Room management API
- `apps/server/src/serverFactory.ts` - Socket handlers and game end logic
- `apps/web/store/remoteGameStore.ts` - Client multiplayer state
- `apps/web/app/room/[id]/page.tsx` - Room page (already used by career)

### 7.2 Sprint 1 Goals

**Focus**: Stabilize existing Career Mode and align with improved multiplayer

**Key Tasks**:
1. Document bypass points (where career doesn't use `rooms.ts`)
2. Implement trophy floor enforcement
3. Verify socket identity on career game join
4. Migrate career room creation to use `createRoomWithCreator()`
5. Migrate career join to use `joinRoom()` with career validation
6. Add reconnection token support
7. Remove code duplication between `careerRoomManager` and `rooms.ts`

**Deliverables**:
- `docs/CAREER_SPRINT_1_SPEC.md` (detailed implementation plan)
- Updated career socket handlers
- Integration tests
- Verification: `tsc --noEmit` passes, all tests green


---

## 8. Key Architecture Decisions

### 8.1 Single Room Map vs Separate Career Rooms

**Decision**: Use single unified room map in `rooms.ts`

**Rationale**:
- Eliminates code duplication
- Career games inherit all multiplayer improvements
- Simplifies server maintenance
- Enables future features (spectators, replays) with no extra work

**Implementation**:
- Add `metadata: { matchType: 'career' | 'casual', careerTier?, careerAnte? }` to Room type
- Filter career rooms in `roomsInfo()` (don't show in casual lobby)
- Career-specific logic only in game end handler

---

### 8.2 JWT Auth Requirement

**Decision**: Keep JWT auth mandatory for Career Mode

**Rationale**:
- Persistent identity needed for ratings/trophies
- Prevents rating manipulation via guest accounts
- Enables cross-device progression
- Simplifies anti-cheat

**Impact**:
- Guest players redirected to signup from `/career`
- Casual multiplayer remains guest-friendly

---

### 8.3 Trophy Floor Enforcement

**Decision**: Enforce trophy floors at tier unlock thresholds

**Rationale**:
- Matches Clash Royale UX (can't drop tiers)
- Prevents skill mismatches
- Makes tier progression feel permanent

**Implementation**:
- On match loss, clamp trophies to `max(currentTrophies - loss, tierMinTrophies)`
- Display "Trophy Floor Protected" message when clamped


---

## 9. Testing Requirements

### 9.1 Unit Tests (Sprint 1)

**Trophy Floor**:
- Player at tier threshold loses → trophies clamped to floor
- Player above threshold loses → trophies decrease normally
- Edge case: Player at 0 trophies (Bronze floor)

**Socket Identity**:
- Valid career player joins with correct token → success
- Invalid token → rejected
- Wrong playerId → rejected

**Room Integration**:
- Career room created via `createRoomWithCreator()` → appears in room map
- Career room has correct metadata (matchType, tier, ante)
- Career room NOT listed in casual lobby

### 9.2 Integration Tests

**Matchmaking**:
- 2 players in same tier/ante → matched immediately
- 1 player alone → waits (no fallback yet in Sprint 1)
- Player disconnects from queue → removed from queue

**Game Flow**:
- Career game creation → player transition → game start → game end → DB update
- Reconnection: player disconnects → rejoins with token → resumes game
- Game end: trophies updated, match recorded, rating adjusted

### 9.3 Manual Testing

- Login → select tier → join queue → match → play → verify trophy update
- Disconnect during game → reconnect → verify resume works
- Lose at tier threshold → verify trophies don't drop below floor


---

## 10. Summary Checklist for Sprint 1

- [ ] Read all career server files (`careerRoomManager`, `careerSocketHandlers`, `queue`)
- [ ] Read all career client files (`CareerLobby`, `careerLobbyStore`, `careerStore`)
- [ ] Identify all locations where career bypasses `rooms.ts`
- [ ] Create `CAREER_SPRINT_1_SPEC.md` with detailed task breakdown
- [ ] Implement trophy floor enforcement
- [ ] Implement socket identity verification on career join
- [ ] Migrate career room creation to `createRoomWithCreator()`
- [ ] Migrate career join to `joinRoom()` with career-specific guard
- [ ] Add reconnection token support for career games
- [ ] Write unit tests for trophy floor and identity verification
- [ ] Write integration tests for career game flow
- [ ] Run `tsc --noEmit` and all test suites
- [ ] Manual test: full career game from queue → play → result
- [ ] Commit changes with clear messages: "Sprint 1: [task description]"
- [ ] Document any blockers or deviations in sprint notes

---

## Document End

**Next Action**: Begin Sprint 1 Research Phase
- Scan career implementation files
- Document bypass points and duplication
- Create Sprint 1 specification document

