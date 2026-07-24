/**
 * Client-side cosmetic visual definitions (keyed by server unlock / equip ids).
 */

import type { TableThemeId } from "@/lib/tableThemes";

export type CosmeticSlot =
  | "title"
  | "badge"
  | "frame"
  | "card_back"
  | "table_theme"
  | "seat_ring"
  | "chip_skin"
  | "emote";

export interface EquippedCosmetics {
  titleId: string | null;
  badgeId: string | null;
  frameId: string | null;
  cardBackId: string | null;
  tableThemeId: string | null;
  seatRingId: string | null;
  chipSkinId: string | null;
}

export const DEFAULT_EQUIPPED: EquippedCosmetics = {
  titleId: null,
  badgeId: null,
  frameId: "frame_default",
  cardBackId: "cardback_default",
  tableThemeId: "classic-green",
  seatRingId: "seat_ring_default",
  chipSkinId: "chipskin_default",
};

/** Map equipped table cosmetic id → TableThemeId */
export function resolveTableThemeId(cosmeticId: string | null | undefined): TableThemeId {
  const id = cosmeticId ?? "classic-green";
  if (id === "midnight-blue" || id === "royal-blue" || id === "woodland" || id === "classic-green") {
    return id;
  }
  return "classic-green";
}

export function getFrameStyle(frameId: string | null | undefined): { fill: string; border: string } {
  switch (frameId) {
    case "frame_onyx":
      return { fill: "rgba(8, 10, 14, 0.95)", border: "rgba(160, 160, 170, 0.75)" };
    case "frame_career_50":
      return { fill: "rgba(18, 12, 8, 0.95)", border: "rgba(212, 160, 80, 0.85)" };
    case "frame_s1_finale":
      return { fill: "rgba(12, 10, 28, 0.95)", border: "rgba(180, 140, 255, 0.8)" };
    case "frame_default":
    default:
      return { fill: "rgba(12, 16, 28, 0.92)", border: "rgba(212, 175, 55, 0.55)" };
  }
}

export function getSeatRingClass(seatRingId: string | null | undefined): string {
  switch (seatRingId) {
    case "seat_ring_classic":
      return "seat-ring--classic";
    default:
      return "seat-ring--default";
  }
}

export function getCardBackClass(cardBackId: string | null | undefined): string {
  switch (cardBackId) {
    case "cardback_classic_blue":
      return "playing-card-back--classic-blue";
    default:
      return "playing-card-kouppi-back";
  }
}

export function getChipSkinClass(chipSkinId: string | null | undefined): string {
  switch (chipSkinId) {
    case "chipskin_gold_edge":
      return "kouppi-poker-chip--gold-edge";
    default:
      return "";
  }
}

export function getTitleLabel(titleId: string | null | undefined): string | null {
  if (!titleId) return null;
  const map: Record<string, string> = {
    title_beginners_luck: "Beginner's Luck",
    title_table_regular: "Table Regular",
    title_first_win: "First Win",
    title_shistri: "SHISTRI",
  };
  return map[titleId] ?? titleId.replace(/^title_/, "").replace(/_/g, " ");
}

export function getBadgeLabel(badgeId: string | null | undefined): string | null {
  if (!badgeId) return null;
  const map: Record<string, string> = {
    badge_kouppi_exclusive: "KOUPPI",
    badge_10_wins: "10 Wins",
    badge_7day: "7-Day",
    badge_season1_24: "S1",
    fragment_generic: "✦",
  };
  return map[badgeId] ?? "★";
}

export function getUnlockedEmoteGlyphs(
  catalog: Array<{ id: string; slot: string; owned: boolean; emoteGlyph?: string }>
): string[] {
  return catalog
    .filter((c) => c.slot === "emote" && c.owned && c.emoteGlyph)
    .map((c) => c.emoteGlyph!);
}
