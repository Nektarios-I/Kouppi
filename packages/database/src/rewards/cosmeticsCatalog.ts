/**
 * Cosmetic catalog — maps unlock IDs to slots and default free cosmetics.
 * Visual rendering details live on the web client; this package owns ownership rules.
 */

import type { RewardUnlockKind } from "./types.js";

export type CosmeticSlot =
  | "title"
  | "badge"
  | "frame"
  | "card_back"
  | "table_theme"
  | "seat_ring"
  | "chip_skin"
  | "emote";

export interface CosmeticDefinition {
  id: string;
  kind: RewardUnlockKind;
  slot: CosmeticSlot;
  label: string;
  /** Free for all players (no unlock required) */
  isDefault?: boolean;
  /** Optional mapping to an existing table theme id */
  tableThemeId?: string;
  /** Emote glyph when kind=emote */
  emoteGlyph?: string;
}

/** Free defaults always available */
export const DEFAULT_COSMETICS: CosmeticDefinition[] = [
  {
    id: "cardback_default",
    kind: "card_back",
    slot: "card_back",
    label: "Classic KOUPPI Back",
    isDefault: true,
  },
  {
    id: "classic-green",
    kind: "table_theme",
    slot: "table_theme",
    label: "Classic Green",
    isDefault: true,
    tableThemeId: "classic-green",
  },
  {
    id: "frame_default",
    kind: "frame",
    slot: "frame",
    label: "Gold Ring",
    isDefault: true,
  },
  {
    id: "seat_ring_default",
    kind: "seat_ring",
    slot: "seat_ring",
    label: "Standard Seat",
    isDefault: true,
  },
  {
    id: "chipskin_default",
    kind: "chip_skin",
    slot: "chip_skin",
    label: "Standard Chips",
    isDefault: true,
  },
];

/** Unlockable cosmetics referenced by season track / achievements / wheel */
export const UNLOCKABLE_COSMETICS: CosmeticDefinition[] = [
  {
    id: "title_beginners_luck",
    kind: "title",
    slot: "title",
    label: "Beginner's Luck",
  },
  {
    id: "title_table_regular",
    kind: "title",
    slot: "title",
    label: "Table Regular",
  },
  {
    id: "title_first_win",
    kind: "title",
    slot: "title",
    label: "First Win",
  },
  {
    id: "title_shistri",
    kind: "title",
    slot: "title",
    label: "SHISTRI",
  },
  {
    id: "badge_kouppi_exclusive",
    kind: "table_badge",
    slot: "badge",
    label: "Exclusive KOUPPI Table Badge",
  },
  {
    id: "badge_10_wins",
    kind: "badge",
    slot: "badge",
    label: "10 Wins Badge",
  },
  {
    id: "badge_7day",
    kind: "badge",
    slot: "badge",
    label: "7-Day Streak Badge",
  },
  {
    id: "badge_season1_24",
    kind: "badge",
    slot: "badge",
    label: "Season 1 Contender",
  },
  {
    id: "cardback_classic_blue",
    kind: "card_back",
    slot: "card_back",
    label: "Classic Blue Card Back",
  },
  {
    id: "midnight-blue",
    kind: "table_theme",
    slot: "table_theme",
    label: "Midnight Felt",
    tableThemeId: "midnight-blue",
  },
  {
    id: "royal-blue",
    kind: "table_theme",
    slot: "table_theme",
    label: "Royal Blue Felt",
    tableThemeId: "royal-blue",
  },
  {
    id: "woodland",
    kind: "table_theme",
    slot: "table_theme",
    label: "Brass Rail / Woodland",
    tableThemeId: "woodland",
  },
  {
    id: "seat_ring_classic",
    kind: "seat_ring",
    slot: "seat_ring",
    label: "Classic Seat Ring",
  },
  {
    id: "chipskin_gold_edge",
    kind: "chip_skin",
    slot: "chip_skin",
    label: "Gold-Edge Chips",
  },
  {
    id: "frame_onyx",
    kind: "frame",
    slot: "frame",
    label: "Onyx Avatar Frame",
  },
  {
    id: "frame_career_50",
    kind: "frame",
    slot: "frame",
    label: "Premium Career Frame",
  },
  {
    id: "frame_s1_finale",
    kind: "frame",
    slot: "frame",
    label: "Season 1 Finale Frame",
  },
  {
    id: "emote_nod",
    kind: "emote",
    slot: "emote",
    label: "Respectful Nod Emote",
    emoteGlyph: "🫡",
  },
  {
    id: "fragment_generic",
    kind: "cosmetic_fragment",
    slot: "badge",
    label: "Cosmetic Fragment",
  },
];

export const ALL_COSMETICS: CosmeticDefinition[] = [...DEFAULT_COSMETICS, ...UNLOCKABLE_COSMETICS];

export function getCosmeticById(id: string): CosmeticDefinition | undefined {
  return ALL_COSMETICS.find((c) => c.id === id);
}

export function getDefaultCosmeticId(slot: CosmeticSlot): string | null {
  return DEFAULT_COSMETICS.find((c) => c.slot === slot)?.id ?? null;
}

export const EQUIP_SLOTS: CosmeticSlot[] = [
  "title",
  "badge",
  "frame",
  "card_back",
  "table_theme",
  "seat_ring",
  "chip_skin",
];

export interface EquippedCosmetics {
  titleId: string | null;
  badgeId: string | null;
  frameId: string | null;
  cardBackId: string | null;
  tableThemeId: string | null;
  seatRingId: string | null;
  chipSkinId: string | null;
}

export const EMPTY_EQUIPPED: EquippedCosmetics = {
  titleId: null,
  badgeId: null,
  frameId: "frame_default",
  cardBackId: "cardback_default",
  tableThemeId: "classic-green",
  seatRingId: "seat_ring_default",
  chipSkinId: "chipskin_default",
};
