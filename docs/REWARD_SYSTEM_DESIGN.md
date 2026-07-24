# KOUPPI Reward System Design

**Status:** Product source of truth (provided 2026-07-23)  
**Implementation:** Aligned in `@kouppi/database` reward domain + `/rewards` UI

---

## Philosophy

Three-horizon reward system for KOUPPI’s realistic casino style:

1. **Short-term habit** — Daily claim + first win of day  
2. **Mid-term activity** — Daily / weekly missions  
3. **Long-term progression / status** — Seasonal reward track + achievements  

The **token-based wheel is secondary excitement**, not the core loop.

---

## Five connected systems

| System | Purpose | Priority |
|--------|---------|----------|
| Daily Claim | Bring players back every day | High |
| Daily / Weekly Missions | Drive repeat play & mode variety | High |
| Seasonal Reward Track | Long-term progression | High |
| Daily Wheel (token) | Variable-reward excitement | Medium |
| Achievements | Permanent accomplishment / identity | Medium |

---

## Economy (v1 — three currencies)

| Currency | Use |
|----------|-----|
| **Chips** | Soft currency for play / economy |
| **XP** | Season track only |
| **Reward Tokens** | Wheel spins; mission reroll tokens are a related inventory |

No hard currency / IAP in v1.

---

## Daily claim (7-day streak)

- One claim per **UTC calendar day**
- Soft-reset on miss → Day 1; keep **lifetime best streak**
- UI shows: streak day, next reward, **next reset timer**

| Day | Reward |
|-----|--------|
| 1 | 100 chips + 40 XP |
| 2 | 150 chips + 40 XP |
| 3 | 200 chips + 50 XP |
| 4 | 250 chips + 50 XP |
| 5 | 300 chips + 60 XP |
| 6 | 400 chips + 60 XP |
| 7 | 600 chips + 100 XP + 1 Wheel Token |

---

## First win of day

- Career win: **+100 chips + 80 XP**, once per UTC day
- Idempotent under reconnect / replay

---

## Missions

- **3 daily** (1 free reroll/day + optional reroll tokens), refresh daily  
- **3 weekly**, larger rewards, refresh Monday 00:00 UTC  
- Mix play / win / skill (SHISTRI, bets); Career does not dominate the pool  
- Progress from **authoritative** match / intent results  

See `packages/database/src/rewards/config.ts` for exact pools.

---

## Season track

- Season ≈ **6–8 weeks**, **30 levels**
- Cosmetic-heavy (titles, card backs, frames, table themes, etc.) + chips / wheel / reroll tokens
- XP from claims, missions, first win, match participation — **wheel not required** to finish

---

## Wheel

- **Token-based** only  
- Transparent odds in config (weights / 1000)  
- Mostly low–mid chips; tiny jackpot; occasional cosmetic fragment  

---

## Achievements

Permanent milestones (wins, SHISTRI, streak, Career volume, track, etc.) with titles / badges / frames and small one-time grants.

---

## Anti-abuse

- Server timestamps (UTC)
- Authoritative completion / intents
- Ledger idempotency for claims, first win, track, wheel, achievements
- No duplicate grants on reconnect

---

## UX

- Compact Reward Center (not spammy popups)
- Subtle claim feedback
- Track + claim visible from Career / home entry points

---

## Launch order (done in foundation)

1. Daily claim streak  
2. First win of day  
3. Daily missions  
4. Weekly missions  
5. Seasonal track  
6. Token wheel  
7. Achievements  
8. Limited-time events — **later**
