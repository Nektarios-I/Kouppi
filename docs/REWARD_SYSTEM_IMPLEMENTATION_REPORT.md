# Reward System — Implementation Report

**Status:** Done — product design + cosmetics apply + remote visibility (2026-07-23)  
**Design source:** `docs/REWARD_SYSTEM_DESIGN.md` (full product spec)

---

## Alignment pass (vs earlier reconstructed defaults)

| Area | Before | After (product design) |
|------|--------|------------------------|
| Daily streak | 50→500 chips | 100–600 chips + XP each day; day 7 + token |
| Soft streak reset | yes | yes + **lifetime best** exposed |
| Reset timer | missing | `nextDailyResetAt` / UI countdown |
| First win | 200 chips + 25 XP | **100 chips + 80 XP** |
| Match XP | 25 + 50 | **20 + 15 win + 10 Career** |
| Missions | Career-only pool | Play/win/bets/SHISTRI/Career/MP pools |
| Track | 10 chip levels | **30 levels**, cosmetic-heavy |
| Wheel | ad-hoc | **weights/1000** odds table |
| Tokens | wheel only | wheel + **mission reroll tokens** |
| Unlocks | none | `reward_unlocks` + `reward_equipped` + in-game apply |

---

## What works

- Daily claim / soft streak / first win / daily+weekly missions / 30-level track / token wheel / achievements
- Authoritative Career match hook; multiplayer session hook; in-match bets/SHISTRI progress for logged-in players
- Reward Center UI with reset countdown, currency strip, restrained panels
- **Cosmetics apply:** wardrobe equip API, auto-equip on grant, table theme / card back / frame / seat ring / chip skin / title / badge / emote wired into play + Career UI
- **Remote cosmetics:** titles/badges/frames/seat rings broadcast on casual + Career room updates; `syncCosmetics` after equip
- 17 automated reward tests passing (incl. equip ownership + public cosmetics)

---

## Known limitations / follow-ups

1. Limited-time event tracks deferred (per design launch order — “later”).
2. Multiplayer pot/win heuristics are coarse (session ranking); Career remains the strongest authoritative path.
3. Prefer Node 20–22 for native `better-sqlite3` without rebuild.

---

## Cosmetics visibility (complete)

| Cosmetic | Local apply | Visible to opponents |
|----------|-------------|----------------------|
| Title / badge | Seat + Career + WaitingRoom | Yes (room / career payload) |
| Avatar frame / seat ring | `PlayerAvatar` | Yes |
| Card back / chip skin / table theme | Local prefs | No (table-local) |
| Emotes | EmotePanel when unlocked | Broadcast as glyph |

Equipping in Reward Center calls `syncCosmetics` so roommates refresh without rejoin.

---

## Local commands

```bash
pnpm --filter @kouppi/database build
pnpm --filter @kouppi/database exec vitest run src/__tests__/rewardTime.test.ts src/__tests__/rewards.test.ts
pnpm --filter @kouppi/server build
pnpm --filter @kouppi/web build
pnpm --filter @kouppi/server dev
pnpm --filter @kouppi/web dev
# → http://localhost:3000/rewards
```
