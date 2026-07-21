# Game Viewport Manual Test Matrix (Phase 4)

**Date:** 2026-07-20  
**Goal:** Core play (table + YOUR MOVE) fits without document scrolling.

## Layout model

| Region | CSS | Budget |
|--------|-----|--------|
| Shell | `.game-viewport-shell` → `100dvh`, `overflow: hidden` (**in-game only**; lobbies use `.lobby-viewport-shell` and may scroll) | Full viewport |
| Stage | `.game-stage` flex column | Remaining |
| HUD | `.game-stage-hud` | flex-none |
| Table | `.game-stage-table-region` + `max-height: calc(100dvh - var(--game-chrome-h))` | flex 1 |
| Dock | `.game-stage-dock` | flex-none, always visible |
| Secondary (log/host) | `.game-stage-secondary` | max-height; hidden ≤700px height |

`--game-chrome-h` defaults 280px; 240px ≤820px height; 210px ≤700px height.

## Pass/fail checklist

For each size × mode (SP / MP):

| Viewport | No page scroll | Table visible | YOUR MOVE visible | No FAB over dock | Notes |
|----------|----------------|---------------|-------------------|------------------|-------|
| 320×568 | ☐ | ☐ | ☐ | ☐ | |
| 375×667 | ☐ | ☐ | ☐ | ☐ | |
| 390×844 | ☐ | ☐ | ☐ | ☐ | |
| 414×896 | ☐ | ☐ | ☐ | ☐ | |
| 768×1024 | ☐ | ☐ | ☐ | ☐ | |
| 1024×768 | ☐ | ☐ | ☐ | ☐ | laptop critical |
| 1366×768 | ☐ | ☐ | ☐ | ☐ | laptop critical |
| 1440×900 | ☐ | ☐ | ☐ | ☐ | |
| 1920×1080 | ☐ | ☐ | ☐ | ☐ | |

## How to test

1. Run web + (for MP) local server.
2. Chrome DevTools device toolbar → exact sizes.
3. Enter active turn with YOUR MOVE dock visible.
4. Confirm `document.documentElement.scrollHeight <= window.innerHeight` (or no scrollbar).
5. Confirm action buttons ≥ 44×44 CSS px on touch sizes.

## Known automation limit

Playwright smoke exists but does not assert visual viewport fit. Do not treat CI as proof of Phase 4.
