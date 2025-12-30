# Career Mode - Research & Implementation Plan

## Executive Summary

This document details the research findings and implementation plan for adding a **Career Mode** to Kouppi - a persistent game mode where players can create accounts, earn and save money, progress through trophy-based rankings, and compete in matchmade ranked games.

Career Mode should coexist with the existing game modes:

- **Single Player** - Practice against bots (unchanged)
- **Multiplayer** - Custom rooms with friends (unchanged)
- **How to Play** - Tutorial (unchanged)
- **Career Mode** - NEW: Persistent accounts + ranked matchmaking

---

## Table of Contents

1. [Research Findings](#research-findings)
   - [Clash Royale System Analysis](#clash-royale-system-analysis)
   - [Elo Rating System](#elo-rating-system)
   - [Colyseus Matchmaking Patterns](#colyseus-matchmaking-patterns)
   - [Database Patterns](#database-patterns)
2. [Career Mode Design](#career-mode-design)
   - [Account System](#account-system)
   - [Trophy/Rating System](#trophyrating-system)
   - [Arena Progression](#arena-progression)
   - [Matchmaking System](#matchmaking-system)
   - [Rewards System](#rewards-system)
3. [Implementation Plan](#implementation-plan)
   - [Phase 1: Database & Authentication](#phase-1-database--authentication)
   - [Phase 2: Player Profiles & Persistence](#phase-2-player-profiles--persistence)
   - [Phase 3: Trophy System](#phase-3-trophy-system)
   - [Phase 4: Matchmaking Queue](#phase-4-matchmaking-queue)
   - [Phase 5: UI Integration](#phase-5-ui-integration)
4. [Technical Details](#technical-details)
5. [Dependencies](#dependencies)

---

## Research Findings

### Clash Royale System Analysis

#### Arena/Trophy System

Clash Royale uses a trophy-based progression system with **28 arenas** spanning 0 to 12,000+ trophies:

| Arena             | Trophy Range | Notable Features    |
| ----------------- | ------------ | ------------------- |
| Training Camp     | 0            | Tutorial            |
| Goblin Stadium    | 0-299        | Starting arena      |
| Bone Pit          | 300-599      |                     |
| Barbarian Bowl    | 600-999      |                     |
| ...               | ...          | Progressive rewards |
| Legendary Arena   | 5000-5299    |                     |
| Arena 22-23       | 7500-8500    | Elite tiers         |
| Ultimate Champion | 9000+        | Highest fixed arena |

**Key Mechanics:**

- **Win = +30 trophies** (base, scales with arena)
- **Loss = -30 trophies** (base, scales with arena)
- **Trophy Gates**: Once you reach an arena threshold, you cannot drop below it
  - Example: If you hit 5000 trophies (Legendary Arena), you can never drop below 5000
  - This prevents frustration from losing streaks
- **Seasonal Reset**: Players above 10,000 trophies get reset at season end
  - Encourages continued play
  - Prevents rating inflation

#### Trophy Road Rewards

Clash Royale rewards players at specific trophy milestones:

- Gold/currency at thresholds (100, 200, 400 trophies, etc.)
- Special items at milestone arenas
- Creates motivation to push higher

#### Matchmaking

- Matches players with similar trophy counts (±200-400 range)
- Very fast queue times (usually < 10 seconds)
- No visible "rating" - just trophies (simple, understandable)

---

### Elo Rating System

The **Elo rating system** is the gold standard for skill-based matchmaking:

#### Core Formula

```
Expected Score: EA = 1 / (1 + 10^((RB - RA) / 400))

Rating Update: R'A = RA + K × (SA - EA)

Where:
- RA, RB = Current ratings of players A and B
- EA = Expected probability of player A winning
- SA = Actual score (1 for win, 0 for loss, 0.5 for draw)
- K = K-factor (determines rating volatility)
```

#### K-Factor Guidelines

| Player Type                 | K-Factor | Rationale                             |
| --------------------------- | -------- | ------------------------------------- |
| New player (< 30 games)     | 40       | Allows quick adjustment to true skill |
| Intermediate (30-100 games) | 24       | Moderate stability                    |
| Established (100+ games)    | 16-20    | Stable ratings                        |
| Top players (elite tier)    | 10       | Very stable, small changes            |

#### Rating Floors

- Prevents players from dropping below certain thresholds
- FIDE uses 1200 as the absolute minimum
- **Recommended for Kouppi**: Floor at 800-1000

#### Rating Classifications (FIDE example)

| Rating    | Classification |
| --------- | -------------- |
| 2800+     | World Elite    |
| 2500-2799 | Grandmaster    |
| 2200-2499 | Master         |
| 2000-2199 | Expert         |
| 1800-1999 | Class A        |
| 1600-1799 | Class B        |
| 1400-1599 | Class C        |
| 1200-1399 | Class D        |
| < 1200    | Beginner       |

---

### Colyseus Matchmaking Patterns

From analyzing the Colyseus game framework (which shares similarities with our Socket.IO setup):

#### Room-Based Matching

```typescript
// Define room types with filters
server.define("ranked_match", RankedRoom).filterBy(["rating", "arena"]); // Filter rooms by properties

// Client joins with filter criteria
client.joinOrCreate("ranked_match", { rating: 1500 });
```

#### Key Patterns:

1. **Seat Reservation System**
   - Reserve seats before full connection
   - Handle reconnection tokens
   - Timeout expired reservations

2. **Room Lifecycle**
   - `onCreate()` - Initialize room
   - `onJoin()` - Player joins
   - `onLeave()` - Player leaves
   - `onDispose()` - Cleanup

3. **Presence/Stats**
   - Track CCU (concurrent users)
   - Global room counts
   - Auto-persist statistics

---

### Database Patterns

For persistent game data, common patterns include:

#### User Account Schema

```typescript
interface UserAccount {
  id: string; // UUID
  username: string; // Unique username
  passwordHash: string; // bcrypt hash
  email?: string; // Optional email
  createdAt: Date;
  lastLoginAt: Date;

  // Persistent game data
  bankroll: number; // Current money
  rating: number; // Elo rating
  trophies: number; // Trophy count
  arena: number; // Current arena level

  // Statistics
  gamesPlayed: number;
  gamesWon: number;
  totalEarnings: number;
  highestTrophies: number;

  // Customization
  avatar: AvatarConfig;
}
```

#### Match History Schema

```typescript
interface MatchRecord {
  id: string;
  timestamp: Date;
  playerIds: string[];
  winnerId: string;

  // Rating changes
  ratingChanges: Record<string, number>;
  trophyChanges: Record<string, number>;

  // Match details
  rounds: number;
  duration: number;
  finalBankrolls: Record<string, number>;
}
```

---

## Career Mode Design

### Account System

#### Registration Flow

1. User provides username + password
2. Server validates:
   - Username: 3-20 characters, alphanumeric + underscore
   - Password: 6+ characters
   - Username not taken
3. Create account with:
   - Starting bankroll: 1000 chips
   - Starting rating: 1200 Elo
   - Starting trophies: 0
   - Arena: 1 (Bronze)

#### Login Flow

1. User provides username + password
2. Server validates credentials
3. Return session token (JWT)
4. Token used for all Career Mode actions

#### Guest Play

- Users can still play Single Player and custom Multiplayer as guests
- Career Mode requires account

---

### Trophy/Rating System

We'll use a **hybrid system** combining the simplicity of trophies with Elo rating accuracy:

#### Visible: Trophies

- Simple number displayed to users
- Win = +25-40 trophies (based on opponent rating)
- Loss = -15-35 trophies (floor applied)
- Gates every 500 trophies (cannot drop below)

#### Hidden: Elo Rating

- Used for matchmaking (more accurate)
- K-factor: 32 (new) → 16 (established)
- Range: 800 - 3000+

#### Trophy Calculation

```typescript
function calculateTrophyChange(
  playerRating: number,
  opponentRating: number,
  won: boolean
): number {
  const ratingDiff = opponentRating - playerRating;
  const base = 30;

  if (won) {
    // Win vs higher rated = more trophies
    const bonus = Math.floor(ratingDiff / 100) * 5;
    return Math.min(45, Math.max(20, base + bonus));
  } else {
    // Loss vs lower rated = more trophies lost
    const penalty = Math.floor(-ratingDiff / 100) * 5;
    return -Math.min(40, Math.max(10, base + penalty));
  }
}
```

---

### Arena Progression

| Arena | Trophies | Name           | Rewards           |
| ----- | -------- | -------------- | ----------------- |
| 1     | 0        | Bronze         | Starting arena    |
| 2     | 300      | Silver         | +100 chips bonus  |
| 3     | 600      | Gold           | +200 chips bonus  |
| 4     | 1000     | Platinum       | +500 chips bonus  |
| 5     | 1500     | Diamond        | +1000 chips bonus |
| 6     | 2000     | Champion       | Special avatar    |
| 7     | 2500     | Grand Champion | Exclusive border  |
| 8     | 3000     | Legend         | Hall of Fame      |

**Trophy Gates**: Once you reach an arena, you stay there (can't drop to previous arena)

---

### Matchmaking System

#### Queue Design

```typescript
interface QueueEntry {
  playerId: string;
  rating: number;
  trophies: number;
  queuedAt: Date;
  searchRadius: number; // Expands over time
}
```

#### Matching Algorithm

1. Player joins queue with their rating
2. Initial search: ±100 rating
3. Every 5 seconds, expand search by +50 rating
4. Maximum search: ±500 rating (after 40 seconds)
5. If match found:
   - Create ranked room
   - Move both players to room
   - Start countdown (10 seconds to ready up)
6. If no match after 60 seconds:
   - Offer bot match option

#### Match Creation

```typescript
interface RankedMatchConfig {
  startingBankroll: 100; // Fixed for fair play
  ante: 10; // Fixed
  roundsToWin: 3; // Best of 5 format
  turnTimeout: 30; // Strict timer
}
```

---

### Rewards System

#### Win Rewards

- Trophies: +25-40 (based on opponent)
- Chips: Keep winnings from match
- Rating: Elo update

#### Daily Rewards

- First match: +100 chips (win or lose)
- First win: +200 chips bonus
- 3 wins: +500 chips bonus

#### Season Rewards

- End of season (monthly):
  - Top 10%: 5000 chips + exclusive avatar
  - Top 25%: 2000 chips
  - Top 50%: 1000 chips
  - All players: 500 chips base

---

## Implementation Plan

### Phase 1: Database & Authentication

**Estimated Effort: 2-3 days**
**Dependencies: None**

#### Tasks:

1. **Add SQLite database**
   - `packages/database/` - New package
   - Prisma or better-sqlite3 for lightweight persistence
   - Schema: users, match_history, sessions

2. **Authentication endpoints**
   - POST `/api/auth/register` - Create account
   - POST `/api/auth/login` - Login, return JWT
   - POST `/api/auth/logout` - Invalidate session
   - GET `/api/auth/me` - Get current user (from token)

3. **JWT token handling**
   - Sign tokens with secret
   - Verify tokens on protected routes
   - Socket.IO auth middleware

#### Files to Create:

```
packages/database/
  src/
    schema.prisma      # Database schema
    client.ts          # Database client
    users.ts           # User CRUD operations
    matches.ts         # Match history operations

apps/server/src/
  auth/
    jwt.ts             # JWT utilities
    middleware.ts      # Auth middleware
    routes.ts          # Auth HTTP routes
```

---

### Phase 2: Player Profiles & Persistence

**Estimated Effort: 2 days**
**Dependencies: Phase 1**

#### Tasks:

1. **User profile management**
   - Get/update profile
   - Track bankroll persistently
   - Track statistics

2. **Profile endpoints**
   - GET `/api/profile` - Get my profile
   - GET `/api/profile/:id` - Get any profile
   - PATCH `/api/profile` - Update settings
   - GET `/api/leaderboard` - Top players

3. **Socket integration**
   - Authenticate socket connections
   - Link socket to user account
   - Update stats on game end

#### Files to Modify:

```
apps/server/src/
  serverFactory.ts     # Add profile routes
  types.ts             # Add authenticated session types

packages/protocol/src/
  payloads.ts          # Add auth payloads
```

---

### Phase 3: Trophy System

**Estimated Effort: 1-2 days**
**Dependencies: Phase 2**

#### Tasks:

1. **Trophy calculation**
   - Implement trophy change formula
   - Apply trophy gates
   - Track arena progression

2. **Elo rating**
   - Implement Elo formula
   - K-factor based on games played
   - Rating floors

3. **Career match end handling**
   - Update both players' ratings
   - Update trophies
   - Save match to history
   - Grant arena rewards

#### Files to Create:

```
packages/game-core/src/
  rating.ts            # Elo + trophy calculations

apps/server/src/
  career/
    trophies.ts        # Trophy system
    arenas.ts          # Arena definitions
    rewards.ts         # Reward handling
```

---

### Phase 4: Matchmaking Queue

**Estimated Effort: 2-3 days**
**Dependencies: Phase 3**

#### Tasks:

1. **Queue management**
   - In-memory queue (Map)
   - Add/remove players
   - Match finding algorithm

2. **Match creation**
   - Create ranked room when matched
   - Notify both players
   - Ready-up countdown

3. **Queue Socket events**
   - `joinQueue` - Start searching
   - `leaveQueue` - Cancel search
   - `matchFound` - Match notification
   - `queueUpdate` - Position/time updates

4. **Career room type**
   - Fixed config for fair play
   - Integrate with trophy system
   - No spectators in ranked

#### Files to Create:

```
apps/server/src/
  career/
    queue.ts           # Matchmaking queue
    rankedRoom.ts      # Ranked room logic
```

---

### Phase 5: UI Integration

**Estimated Effort: 3-4 days**
**Dependencies: Phase 4**

#### Tasks:

1. **Auth UI**
   - Login/Register modal
   - Login state in header
   - Protected routes

2. **Career Mode page**
   - `/play/career` route
   - Queue UI with timer
   - Profile summary card

3. **Profile page**
   - `/profile` and `/profile/:id`
   - Statistics display
   - Match history
   - Arena badge

4. **Leaderboard**
   - `/leaderboard` page
   - Top 100 players
   - Filter by arena

5. **Navigation updates**
   - Add Career Mode to play page
   - Show current trophies in header
   - Arena indicator

#### Files to Create:

```
apps/web/
  app/
    login/
      page.tsx         # Login page
    profile/
      page.tsx         # My profile
      [id]/page.tsx    # Other profiles
    leaderboard/
      page.tsx         # Leaderboard
    play/
      career/
        page.tsx       # Career mode / queue

  components/
    AuthModal.tsx      # Login/Register modal
    ProfileCard.tsx    # Profile summary
    TrophyBadge.tsx    # Trophy display
    QueueStatus.tsx    # Queue waiting UI
    MatchHistory.tsx   # Match history list
    LeaderboardTable.tsx

  store/
    authStore.ts       # Auth state
    careerStore.ts     # Career state
```

---

## Technical Details

### Database Choice: SQLite + better-sqlite3

**Why SQLite:**

- Zero configuration
- Single file database
- Perfect for < 10,000 concurrent users
- Can migrate to PostgreSQL later if needed

**Schema Preview:**

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  bankroll INTEGER DEFAULT 1000,
  rating INTEGER DEFAULT 1200,
  trophies INTEGER DEFAULT 0,
  highest_trophies INTEGER DEFAULT 0,
  arena INTEGER DEFAULT 1,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  total_earnings INTEGER DEFAULT 0,
  avatar_emoji TEXT DEFAULT '🎭',
  avatar_color TEXT DEFAULT '#6366f1',
  avatar_border TEXT DEFAULT '#4f46e5'
);

CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  player1_id TEXT NOT NULL,
  player2_id TEXT NOT NULL,
  winner_id TEXT,
  player1_rating_change INTEGER,
  player2_rating_change INTEGER,
  player1_trophy_change INTEGER,
  player2_trophy_change INTEGER,
  rounds_played INTEGER,
  duration_seconds INTEGER,
  FOREIGN KEY (player1_id) REFERENCES users(id),
  FOREIGN KEY (player2_id) REFERENCES users(id),
  FOREIGN KEY (winner_id) REFERENCES users(id)
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### JWT Token Structure

```typescript
interface JWTPayload {
  userId: string;
  username: string;
  iat: number; // Issued at
  exp: number; // Expires (24 hours)
}
```

### Reusing Existing Code

The following existing systems will be reused:

| Component            | Reuse From            | Modifications Needed |
| -------------------- | --------------------- | -------------------- |
| Room management      | `rooms.ts`            | Add `isRanked` flag  |
| Game state           | `@kouppi/game-core`   | None                 |
| Socket communication | `serverFactory.ts`    | Add auth middleware  |
| Protocol validation  | `@kouppi/protocol`    | Add auth schemas     |
| UI components        | Existing components   | Style consistency    |
| Player avatars       | Current avatar system | None                 |
| Turn timer           | Current timer system  | None                 |

---

## Dependencies

### New NPM Packages (Server)

```json
{
  "dependencies": {
    "better-sqlite3": "^9.4.0", // SQLite driver
    "bcrypt": "^5.1.1", // Password hashing
    "jsonwebtoken": "^9.0.2" // JWT tokens
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.9",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5"
  }
}
```

### No New Dependencies (Client)

- Store JWT in localStorage
- Axios/fetch for auth endpoints
- Existing Socket.IO for game

---

## Summary

Career Mode will transform Kouppi from a casual card game into a competitive experience with:

✅ **Persistent accounts** - Username/password authentication  
✅ **Saved progress** - Bankroll, stats, achievements  
✅ **Trophy system** - Clear progression with gates  
✅ **Arena progression** - Visual rank with rewards  
✅ **Matchmaking** - Fair, skill-based matching  
✅ **Leaderboards** - Compete globally

The implementation is designed to be:

- **Incremental** - Each phase is independently deployable
- **Non-breaking** - Existing modes remain unchanged
- **Reusable** - Leverages existing codebase heavily
- **Scalable** - SQLite → PostgreSQL migration path if needed

Total estimated effort: **10-14 days** for a single developer
