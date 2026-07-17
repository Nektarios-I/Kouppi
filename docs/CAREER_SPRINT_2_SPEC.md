# CAREER MODE SPRINT 2 SPECIFICATION

**Sprint Goal**: Implement rating-based matchmaking queue with low-concurrency fallback mechanisms

**Duration**: 1-2 weeks  
**Status**: Research Phase  
**Created**: 2026-07-16

---

## 1. Research Findings

### 1.1 Current Matchmaking Behavior (From Sprint 1)

**How It Works Now**:
- Player selects tier (e.g., "Gold") and ante (e.g., "gold-2")
- Server calls `findOrCreateRoom(anteId, player)`
- Finds first available room with matching `anteId` OR creates new room
- Room auto-starts after 30 seconds when 2+ players present
- **NO rating-based pairing** - any two players in same ante are matched
- **NO queue system** - instant room join/creation
- **NO fallback** - players wait indefinitely if alone in tier/ante

**Key Code Locations**:
- `careerSocketHandlers.ts` line 156: `findOrCreateRoom(payload.anteId, player, io)`
- `careerRoomManager.ts` line 169: `findOrCreateRoom()` function
- `queue.ts`: Exists but NOT USED by career handlers

**Problem**: At low concurrency, players in uncommon tier/ante combinations wait forever.

### 1.2 Existing Queue System (queue.ts)

**What's Already Built**:
```typescript
// queue.ts exports:
- joinQueue(entry: QueueEntry)
- leaveQueue(playerId: string)
- tryFindMatch(playerId: string)
- runMatchmaking()
- getQueueStatus(playerId: string)
- isMatchmakingCompatible(rating1, rating2, waitTime1, waitTime2)
- getMatchmakingRange(waitTimeSeconds): number
```

**Key Features**:
- Rating-based compatibility check
- Expanding search range: starts at ±100, expands to ±500 over time
- Wait time tracking
- Queue position tracking
- Match scoring (prioritizes closer rating matches)

**What's Missing**:
- No integration with career socket handlers
- No room creation after match found
- No UI feedback for queue status
- No cross-tier expansion logic
- No bot/AI fallback


### 1.3 Gap Analysis

**Current Flow (Sprint 1)**:
```
Player → career:joinAnte → findOrCreateRoom(anteId) → Instant room join → Wait 30s
```

**Target Flow (Sprint 2)**:
```
Player → career:joinQueue → joinQueue(entry) → Rating-based matching → 
  → Match found → Create room → Notify both players → Auto-start
  → OR after timeout → Fallback (expand search / bot / placement)
```

**Key Differences**:
1. **No instant room**: Players enter queue first
2. **Rating matters**: Queue finds compatible opponents by rating
3. **Expanding search**: If no match after 15s, widen rating range
4. **Fallback options**: After 30s+ without match, offer alternatives

**Integration Points**:
- Replace `career:joinAnte` logic with queue-based approach
- Add `career:joinQueue` event
- Add `career:leaveQueue` event
- Add `career:queueStatus` polling
- Implement periodic `runMatchmaking()` calls
- Handle match-found → room creation transition

### 1.4 Low-Concurrency Scenarios

**Scenario 1: Player alone in tier**
- Current: Waits forever
- Sprint 2 Solution: After 30s, allow cross-tier matching (±1 tier)

**Scenario 2: Wide rating gap**
- Current: N/A (no rating check)
- Sprint 2 Solution: Expand from ±100 to ±500 over 30 seconds

**Scenario 3: Very low concurrency (0-1 players online)**
- Current: Impossible to play
- Sprint 2 Solution Options:
  - Option A: Bot opponent (deferred - requires AI)
  - Option B: Placement matches vs any tier
  - Option C: "Quick match" mode (accept any opponent)
- **Decision for Sprint 2**: Implement Option C

**Scenario 4: Player disconnects while in queue**
- Current: N/A
- Sprint 2 Solution: Auto-remove from queue on socket disconnect

### 1.5 Integration Architecture Analysis

**Current Socket Events** (to be replaced/modified):
- `career:joinAnte` - Instant join/create room by ante ID → REPLACE with queue-based flow
- `career:leaveRoom` - Leave waiting room → EXTEND to also handle queue departure
- `career:getRoomInfo` - Get room state → EXTEND to also return queue state

**New Socket Events** (to be added):
```typescript
// Server → Client
"career:queueStatus" - Poll for queue position/wait time/search range
"career:matchFound" - Notify players when match is found
"career:queueUpdate" - Broadcast queue size changes

// Client → Server  
"career:joinQueue" - Enter matchmaking queue with rating/tier
"career:leaveQueue" - Exit queue before match found
"career:getQueueStatus" - Request current queue state
```

**Matchmaking Loop**:
- Periodic `runMatchmaking()` calls every 2 seconds
- Callback: `setOnMatchFound()` → triggers room creation
- Room creation reuses existing `triggerGameStart()` flow from Sprint 1

**Client-Side Changes**:
- `careerLobbyStore.ts`:
  - Add `queueState` with position, waitTime, searchRange
  - Add `joinQueue()` and `leaveQueue()` actions
  - Add polling for queue status updates
- `CareerLobby.tsx`:
  - Replace immediate "Join" button with "Find Match" → enters queue
  - Display queue status: position, wait time, expanding range
  - Show "Cancel Search" during queue wait
  - Animate transition: Queue → Match Found → Game Starting

**Server-Side Changes**:
- `careerSocketHandlers.ts`:
  - Keep `career:joinAnte` event name BUT change logic to queue-based
  - Add `career:leaveQueue` handler
  - Add `career:getQueueStatus` handler
- `careerRoomManager.ts`:
  - Add `handleMatchFound(match)` callback function
  - Call `triggerGameStart()` after creating room from match
- New matchmaking loop in server index:
  - `setInterval(() => runMatchmaking(), 2000)`
  - Configure `setOnMatchFound(handleMatchFound)`

### 1.6 Database Schema (No Changes Required)

Queue is **in-memory only** - no database changes needed for Sprint 2.

Rating and trophy calculations already exist in `packages/database/src/rating.ts`:
- `getMatchmakingRange(waitTimeSeconds)` - Expanding search ±100 → ±500
- `isMatchmakingCompatible(r1, r2, t1, t2)` - Check if match valid

### 1.7 Research Phase Complete

**Key Findings Summary**:
1. ✅ Queue system (queue.ts) is fully built and tested - just needs integration
2. ✅ Room creation (careerRoomManager.ts) works correctly - reuse triggerGameStart()
3. ✅ Rating functions exist and handle expanding search ranges
4. ⚠️ Socket handlers need significant refactoring (replace findOrCreateRoom with queue flow)
5. ⚠️ Client UI needs queue status display and polling logic
6. ✅ No database migrations required - queue is in-memory

**Next Phase**: Specification - Define exact requirements with acceptance criteria

---

## 2. Requirements & Acceptance Criteria

### REQ-1: Queue-Based Matchmaking Integration

**Description**: Replace instant room join/create with rating-aware queue system

**Acceptance Criteria**:
- [AC-1.1] Player clicking "Find Match" enters queue (not instant room)
- [AC-1.2] Queue uses `queue.ts` functions (`joinQueue`, `tryFindMatch`)
- [AC-1.3] Match compatibility checked via `isMatchmakingCompatible()`
- [AC-1.4] Rating range expands: ±100 at 0s → ±500 at 30s (per `getMatchmakingRange`)
- [AC-1.5] When match found, both players removed from queue automatically
- [AC-1.6] Match-found callback triggers room creation via `triggerGameStart()`
- [AC-1.7] Players cannot enter queue if already in queue or in active room

**Implementation Files**:
- `apps/server/src/career/careerSocketHandlers.ts` - Modify `career:joinAnte` logic
- `apps/server/src/career/careerRoomManager.ts` - Add `handleMatchFound()` callback
- `apps/server/src/index.ts` or similar - Add matchmaking loop

**Tests**:
- Queue join prevents duplicate entries
- Match compatibility expands over time
- Match found removes both players from queue
- Room creation triggered after match

---

### REQ-2: Queue Status UI & Polling

**Description**: Display real-time queue status to players (position, wait time, search range)

**Acceptance Criteria**:
- [AC-2.1] UI shows "In Queue" state with position (e.g., "#3 in queue")
- [AC-2.2] UI displays wait time in seconds (e.g., "Waiting 12s")
- [AC-2.3] UI shows current search range (e.g., "Rating ±150")
- [AC-2.4] UI updates every 1-2 seconds via polling or server push
- [AC-2.5] "Cancel Search" button removes player from queue
- [AC-2.6] Queue status cleared when match found or player leaves
- [AC-2.7] Visual indicator shows expanding search (e.g., progress bar)

**Implementation Files**:
- `apps/web/store/careerLobbyStore.ts` - Add queue state and polling
- `apps/web/components/CareerLobby.tsx` - Add queue status UI
- `apps/server/src/career/careerSocketHandlers.ts` - Add `career:getQueueStatus` handler

**Tests**:
- Queue status updates reflect actual queue state
- Cancel button removes player from queue
- Polling stops when player leaves queue

---

### REQ-3: Low-Concurrency Fallback Mechanisms

**Description**: Prevent indefinite waits when few players online

**Acceptance Criteria**:
- [AC-3.1] After 15s in queue: Expand rating to ±250 (instead of time-based expansion only)
- [AC-3.2] After 30s in queue: Allow cross-tier matching (±1 tier from player's current tier)
- [AC-3.3] After 45s in queue: "Quick Match" mode - accept any opponent regardless of tier/rating
- [AC-3.4] UI indicates fallback mode (e.g., "Searching all leagues..." after 30s)
- [AC-3.5] Fallback settings apply to matchmaking compatibility checks
- [AC-3.6] Players are notified when fallback modes activate

**Implementation Files**:
- `apps/server/src/career/queue.ts` - Add fallback logic to `isMatchmakingCompatible`
- `apps/web/store/careerLobbyStore.ts` - Track fallback state
- `apps/web/components/CareerLobby.tsx` - Display fallback indicators

**Tests**:
- Rating expansion triggers at 15s
- Cross-tier matching enabled at 30s
- Quick match mode enabled at 45s
- UI reflects fallback states

---

### REQ-4: Queue Disconnect Handling

**Description**: Clean up queue state when players disconnect

**Acceptance Criteria**:
- [AC-4.1] Player socket disconnect removes them from queue automatically
- [AC-4.2] Other players' queue positions updated after disconnect
- [AC-4.3] Match in progress (room created) not affected by disconnect
- [AC-4.4] Reconnect does NOT restore queue position (player must re-queue)
- [AC-4.5] No ghost entries remain in queue after disconnect

**Implementation Files**:
- `apps/server/src/career/careerSocketHandlers.ts` - Enhance disconnect handler
- `apps/server/src/career/queue.ts` - Ensure `leaveQueue` cleans up properly

**Tests**:
- Disconnect removes player from queue
- Queue positions recalculated
- No memory leaks from ghost entries

---

### REQ-5: Match Found Transition

**Description**: Smooth transition from queue → match found → game starting

**Acceptance Criteria**:
- [AC-5.1] When match found, both players receive `career:matchFound` event
- [AC-5.2] Room created with both players as members
- [AC-5.3] 30-second auto-start timer begins immediately (as in Sprint 1)
- [AC-5.4] UI shows "Match Found!" notification with opponent info
- [AC-5.5] Players automatically join room socket channel
- [AC-5.6] Transition animation from queue screen to room screen
- [AC-5.7] If either player disconnects before game starts, match cancelled and other player re-queues

**Implementation Files**:
- `apps/server/src/career/careerRoomManager.ts` - `handleMatchFound()` creates room
- `apps/web/store/careerLobbyStore.ts` - Handle `career:matchFound` event
- `apps/web/components/CareerLobby.tsx` - Display match found UI

**Tests**:
- Match found creates room with correct players
- Auto-start timer begins
- Disconnect before start cancels match

---

### REQ-6: Periodic Matchmaking Loop

**Description**: Server runs matchmaking checks periodically to find matches

**Acceptance Criteria**:
- [AC-6.1] Server calls `runMatchmaking()` every 2 seconds
- [AC-6.2] Matchmaking loop processes all queued players
- [AC-6.3] Multiple matches can be found in single iteration
- [AC-6.4] Loop continues running while server is active
- [AC-6.5] Performance: Loop completes in <50ms for up to 100 queued players
- [AC-6.6] Errors in matchmaking loop logged but don't crash server

**Implementation Files**:
- `apps/server/src/index.ts` - Add matchmaking interval on server start
- `apps/server/src/career/queue.ts` - Already has `runMatchmaking()`

**Tests**:
- Matchmaking loop runs periodically
- Multiple matches found in single iteration
- Server remains stable under load

---

## 3. Implementation Plan

### Phase 1: Server-Side Queue Integration (Day 1)

**Tasks**:
1. Add matchmaking loop to server startup (`apps/server/src/index.ts`)
   - `setInterval(() => runMatchmaking(), 2000)`
   - Import and configure queue callbacks
2. Create `handleMatchFound()` in careerRoomManager.ts
   - Extract players from match
   - Find ante option by tier/rating
   - Create career room with both players
   - Call `triggerGameStart()` with 30s delay
3. Configure `setOnMatchFound(handleMatchFound)` callback
4. Modify `career:joinAnte` handler in careerSocketHandlers.ts
   - Change logic: Instead of `findOrCreateRoom()`, call `joinQueue()`
   - Validate tier/ante/bankroll (keep existing checks)
   - Return queue confirmation with position
5. Add `career:leaveQueue` handler
   - Call `leaveQueue(socketId)`
   - Emit confirmation
6. Add `career:getQueueStatus` handler
   - Call `getQueueStatus(playerId)`
   - Return position, waitTime, searchRange, queueSize
7. Enhance disconnect handler
   - Add `leaveQueue(socketId)` call
   - Keep existing room cleanup logic

**Files Modified**:
- `apps/server/src/index.ts`
- `apps/server/src/career/careerRoomManager.ts`
- `apps/server/src/career/careerSocketHandlers.ts`

**Success Criteria**: Server accepts queue joins and periodically runs matchmaking

---

### Phase 2: Client-Side Queue State (Day 2)

**Tasks**:
1. Add queue state to careerLobbyStore.ts:
   ```typescript
   queueState: {
     inQueue: boolean;
     position: number;
     waitTime: number;
     searchRange: number;
     queueSize: number;
   } | null
   ```
2. Add `joinQueue()` action
   - Emit `career:joinAnte` with token + anteId (reuse event name)
   - Set local `queueState`
   - Start polling for queue status
3. Add `leaveQueue()` action
   - Emit `career:leaveQueue`
   - Clear `queueState`
   - Stop polling
4. Add queue status polling (every 2s)
   - Emit `career:getQueueStatus`
   - Update `queueState` from response
   - Stop when match found or queue left
5. Handle `career:matchFound` event
   - Clear `queueState`
   - Set `currentRoom` (as before)
   - Stop polling

**Files Modified**:
- `apps/web/store/careerLobbyStore.ts`

**Success Criteria**: Client can enter queue, poll status, and receive match notifications

---

### Phase 3: Queue UI Display (Day 2-3)

**Tasks**:
1. Add Queue Status Component to CareerLobby.tsx
   - Show position: "#3 in queue"
   - Show wait time: "Waiting 12s"
   - Show search range: "Rating ±150"
   - Show queue size: "5 players searching"
2. Add visual indicators
   - Animated spinner during search
   - Progress bar showing search range expansion
   - Pulsing effect during active search
3. Add "Cancel Search" button
   - Calls `leaveQueue()`
   - Returns to tier/ante selection
4. Replace "Join" button with "Find Match"
   - Triggers `joinQueue()` instead of `joinAnte()`
   - Disabled if already in queue or room
5. Add "Match Found!" transition screen
   - Show opponent info (username, rating, avatar)
   - Countdown to room ready
   - Smooth animation to room screen

**Files Modified**:
- `apps/web/components/CareerLobby.tsx`
- (Optional) Add CSS animations to global styles

**Success Criteria**: Players see live queue status and smooth transitions

---

### Phase 4: Low-Concurrency Fallback (Day 3)

**Tasks**:
1. Modify `isMatchmakingCompatible()` in queue.ts
   - Add fallback logic for 15s+ wait time
   - Add cross-tier check for 30s+ wait time
   - Add quick-match mode for 45s+ wait time
2. Emit `career:queueFallback` events from server
   - Notify when entering fallback modes
   - Include fallback level (expanded, cross-tier, quick)
3. Update client to display fallback indicators
   - "Expanding search..." at 15s
   - "Searching all leagues..." at 30s
   - "Quick match mode..." at 45s
4. Add tier compatibility check to handleMatchFound()
   - Ensure both players can afford the selected ante
   - Choose ante based on lower-rated player's tier

**Files Modified**:
- `apps/server/src/career/queue.ts`
- `apps/server/src/career/careerRoomManager.ts`
- `apps/web/store/careerLobbyStore.ts`
- `apps/web/components/CareerLobby.tsx`

**Success Criteria**: Players never wait more than 60s without getting matched or warned

---

### Phase 5: Testing & Validation (Day 4)

**Tasks**:
1. Create queue integration tests (`apps/server/tests/career/queueIntegration.test.ts`)
   - Test queue join/leave
   - Test matchmaking with 2+ players
   - Test rating expansion
   - Test disconnect handling
2. Create fallback mechanism tests (`apps/server/tests/career/queueFallback.test.ts`)
   - Test 15s expansion
   - Test 30s cross-tier
   - Test 45s quick match
3. Create UI interaction tests (manual or E2E)
   - Test queue status display
   - Test cancel search
   - Test match found transition
4. Run full test suite
   - `npm run test` in apps/server
   - `npm run test` in apps/web
5. Run TypeScript compilation
   - `npx tsc --noEmit` from repo root
6. Manual testing scenarios
   - Solo player (test fallback)
   - 2 players same tier (instant match)
   - 2 players different tiers (cross-tier at 30s)
   - Disconnect during queue
   - Disconnect during room wait

**Files Created**:
- `apps/server/tests/career/queueIntegration.test.ts`
- `apps/server/tests/career/queueFallback.test.ts`

**Success Criteria**: All tests pass, no TypeScript errors, manual scenarios work

---

### Phase 6: Documentation & Sprint Wrap-Up (Day 4)

**Tasks**:
1. Document Sprint 2 Results in this file
   - Summary of what was implemented
   - Which requirements met
   - Any deferred items
   - Known limitations
2. Update CAREER_MODE_SUMMARY.md with queue architecture
3. Create commit messages referencing Sprint 2 spec
4. Prepare demo notes for user testing

**Files Modified**:
- `docs/CAREER_SPRINT_2_SPEC.md`
- `docs/CAREER_MODE_SUMMARY.md`

**Success Criteria**: Sprint 2 fully documented and ready for Sprint 3

---

## 4. Sprint 2 Results

### Phase 1: Server-Side Queue Integration ✅ COMPLETE

**Completed (2026-07-16)**:
1. ✅ Added matchmaking loop to server.ts - runs every 2 seconds
2. ✅ Created `handleMatchFound()` in careerRoomManager.ts - creates room and starts auto-timer
3. ✅ Configured `setOnMatchFound(handleMatchFound)` callback
4. ✅ Modified `career:joinAnte` handler to use queue instead of instant room join
5. ✅ Added `career:leaveQueue` handler
6. ✅ Added `career:getQueueStatus` handler
7. ✅ Enhanced disconnect handler to remove from queue

**Files Modified**:
- `apps/server/src/server.ts`
- `apps/server/src/career/careerRoomManager.ts`
- `apps/server/src/career/careerSocketHandlers.ts`

**TypeScript Compilation**: ✅ PASSED

**Key Changes**:
- Matchmaking loop processes queue every 2 seconds with error handling
- Match found callback creates career room with both players immediately
- Room auto-start timer (30s) begins right after match found
- Players receive `career:matchFound` event with opponent info
- Queue system fully integrated with existing room management
- Disconnect cleanup prevents ghost queue entries

**Next Phase**: Phase 2 - Client-Side Queue State

---

### Phase 2: Client-Side Queue State ✅ COMPLETE

**Completed (2026-07-16)**:
1. ✅ Added `QueueState` and `MatchFoundData` interfaces
2. ✅ Added queue state to store: `queueState`, `isJoiningQueue`, `queuePollInterval`, `matchFound`
3. ✅ Added `authToken` storage for queue polling
4. ✅ Implemented `joinQueue()` action - emits career:joinAnte
5. ✅ Implemented `leaveQueue()` action - emits career:leaveQueue
6. ✅ Implemented queue status polling (every 2s) via `startQueuePolling()` and `stopQueuePolling()`
7. ✅ Added event listeners: `career:queueJoined`, `career:queueStatus`, `career:matchFound`
8. ✅ Polling starts automatically when queue joined
9. ✅ Polling stops when match found or queue left
10. ✅ Cleanup in disconnect and reset functions

**Files Modified**:
- `apps/web/store/careerLobbyStore.ts`

**TypeScript/Build**: ✅ PASSED

---

### Phase 3: Queue UI Display ✅ COMPLETE

**Completed (2026-07-16)**:
1. ✅ Added queue status screen with position, wait time, search range, queue size
2. ✅ Added "Match Found!" transition screen with opponent info
3. ✅ Changed "Join" button to "Find Match" button
4. ✅ Added "Cancel Search" button during queue
5. ✅ Added animated indicators for expanding search (after 10s, 15s, 30s)
6. ✅ Visual feedback with emojis and colors
7. ✅ Smooth transitions between states (tier selection → queue → match found → room)

**Files Modified**:
- `apps/web/components/CareerLobby.tsx`

**UI States Implemented**:
- **Tier Selection**: Choose league and ante
- **Queue Searching**: Shows position, wait time, search range, queue size
- **Match Found**: Shows opponent with avatar, username, rating
- **Room Waiting**: Existing room screen (from Sprint 1)
- **Game Transition**: Navigate to /room/[id]

**TypeScript/Build**: ✅ PASSED

**Next Phase**: Phase 4 - Low-Concurrency Fallback

---


### Phase 4: Low-Concurrency Fallback ✅ COMPLETE

**Completed (2026-07-16)**:
1. ✅ Enhanced `isMatchmakingCompatible()` with fallback logic:
   - After 15s: Expanded range to ±250
   - After 30s: Cross-tier matching (±400 rating / ~2 tiers)
   - After 45s: Quick match mode (accept any opponent)
2. ✅ Added `fallbackMode` field to queue status
3. ✅ Enhanced `handleMatchFound()` to select appropriate ante based on both players' ratings
4. ✅ Ante selection uses lower-rated player's tier to ensure affordability
5. ✅ UI displays fallback mode with clear explanations
6. ✅ Fallback indicators shown in queue status banner

**Files Modified**:
- `packages/database/src/rating.ts` (matchmaking compatibility logic)
- `apps/server/src/career/queue.ts` (fallback mode detection)
- `apps/server/src/career/careerRoomManager.ts` (smart ante selection)
- `apps/web/store/careerLobbyStore.ts` (fallback mode state)
- `apps/web/components/CareerLobby.tsx` (fallback UI indicators)

**Fallback Modes**:
- **Expanded** (15s): "🔎 Expanding Search Range" - ±250 rating
- **Cross-Tier** (30s): "📡 Searching All Leagues" - ±400 rating (~2 tiers)
- **Quick Match** (45s): "🌍 Quick Match Mode" - Accept any opponent

**TypeScript/Build**: ✅ PASSED (both server and client)

**Next Phase**: Phase 5 - Testing & Validation

---

## Phase 5 — QA Validation (2026-07-17)

Independent QA pass completed. See **`docs/CAREER_MODE_QA_VALIDATION_REPORT.md`** for full matrix, commands, and bug IDs.

**Summary:**
- Environment repaired with Node 20 portable + pnpm 9.7
- **14** database tests, **32** career server tests, **12** queue unit tests, **3** queue integration tests, **2** client store tests — **PASS**
- **6 bugs fixed** (matchmaking factory wiring, client queue regression, reconnect token, anteId, bankroll, queue refresh)
- **1 open High:** quick-match fairness at 45s (any opponent) — product decision required
- **Readiness:** READY FOR INTERNAL TESTING

**Defects fixed in validation:**
- CM-QA-001 through CM-QA-006 (see QA report)

**Corrected Sprint 2 claim:**
- Matchmaking loop must live in `serverFactory.ts`, not only `server.ts`

---

*(Phase 5 validation complete)*
