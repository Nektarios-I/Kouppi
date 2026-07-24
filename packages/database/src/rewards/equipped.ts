/**
 * Equipped cosmetics persistence + ownership checks.
 */

import { getRawDb } from "../client.js";
import { listUnlocks } from "./unlocks.js";
import {
  EMPTY_EQUIPPED,
  EQUIP_SLOTS,
  getCosmeticById,
  getDefaultCosmeticId,
  type CosmeticSlot,
  type EquippedCosmetics,
} from "./cosmeticsCatalog.js";
import { RewardActionError } from "./errors.js";

function rowToEquipped(row: Record<string, unknown> | undefined): EquippedCosmetics {
  if (!row) return { ...EMPTY_EQUIPPED };
  return {
    titleId: row.title_id == null ? null : String(row.title_id),
    badgeId: row.badge_id == null ? null : String(row.badge_id),
    frameId: row.frame_id == null ? EMPTY_EQUIPPED.frameId : String(row.frame_id),
    cardBackId: row.card_back_id == null ? EMPTY_EQUIPPED.cardBackId : String(row.card_back_id),
    tableThemeId: row.table_theme_id == null ? EMPTY_EQUIPPED.tableThemeId : String(row.table_theme_id),
    seatRingId: row.seat_ring_id == null ? EMPTY_EQUIPPED.seatRingId : String(row.seat_ring_id),
    chipSkinId: row.chip_skin_id == null ? EMPTY_EQUIPPED.chipSkinId : String(row.chip_skin_id),
  };
}

export function ensureEquippedRow(userId: string): EquippedCosmetics {
  const existing = getEquippedCosmetics(userId);
  if (existing) return existing;
  const db = getRawDb();
  db.prepare(
    `INSERT INTO reward_equipped (
      user_id, title_id, badge_id, frame_id, card_back_id, table_theme_id, seat_ring_id, chip_skin_id, updated_at
    ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    EMPTY_EQUIPPED.frameId,
    EMPTY_EQUIPPED.cardBackId,
    EMPTY_EQUIPPED.tableThemeId,
    EMPTY_EQUIPPED.seatRingId,
    EMPTY_EQUIPPED.chipSkinId,
    Date.now()
  );
  return getEquippedCosmetics(userId)!;
}

export function getEquippedCosmetics(userId: string): EquippedCosmetics | null {
  const db = getRawDb();
  const row = db.prepare("SELECT * FROM reward_equipped WHERE user_id = ?").get(userId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToEquipped(row) : null;
}

function ownsCosmetic(userId: string, cosmeticId: string): boolean {
  const def = getCosmeticById(cosmeticId);
  if (!def) return false;
  if (def.isDefault) return true;
  const owned = listUnlocks(userId);
  return owned.some((u) => u.id === cosmeticId);
}

const SLOT_COLUMN: Record<CosmeticSlot, keyof EquippedCosmetics | null> = {
  title: "titleId",
  badge: "badgeId",
  frame: "frameId",
  card_back: "cardBackId",
  table_theme: "tableThemeId",
  seat_ring: "seatRingId",
  chip_skin: "chipSkinId",
  emote: null, // inventory only — always available when unlocked
};

/**
 * Equip a cosmetic into its slot. Pass null to clear title/badge.
 */
export function equipCosmetic(
  userId: string,
  slot: CosmeticSlot,
  cosmeticId: string | null
): EquippedCosmetics {
  if (!EQUIP_SLOTS.includes(slot) && slot !== "emote") {
    throw new RewardActionError("Invalid cosmetic slot", "COSMETIC_SLOT_INVALID");
  }
  if (slot === "emote") {
    throw new RewardActionError("Emotes are inventory-only", "COSMETIC_SLOT_INVALID");
  }

  ensureEquippedRow(userId);

  if (cosmeticId == null) {
    if (slot !== "title" && slot !== "badge") {
      const fallback = getDefaultCosmeticId(slot);
      if (!fallback) throw new RewardActionError("Cannot clear this slot", "COSMETIC_REQUIRED");
      cosmeticId = fallback;
    }
  } else if (!ownsCosmetic(userId, cosmeticId)) {
    throw new RewardActionError("Cosmetic not unlocked", "COSMETIC_LOCKED");
  } else {
    const def = getCosmeticById(cosmeticId)!;
    if (def.slot !== slot) {
      throw new RewardActionError("Cosmetic does not fit this slot", "COSMETIC_SLOT_MISMATCH");
    }
  }

  const col =
    slot === "title"
      ? "title_id"
      : slot === "badge"
        ? "badge_id"
        : slot === "frame"
          ? "frame_id"
          : slot === "card_back"
            ? "card_back_id"
            : slot === "table_theme"
              ? "table_theme_id"
              : slot === "seat_ring"
                ? "seat_ring_id"
                : "chip_skin_id";

  const db = getRawDb();
  db.prepare(`UPDATE reward_equipped SET ${col} = ?, updated_at = ? WHERE user_id = ?`).run(
    cosmeticId,
    Date.now(),
    userId
  );
  return getEquippedCosmetics(userId)!;
}

/**
 * After granting unlocks, auto-equip into empty/default slots for nicer first-time UX.
 */
export function autoEquipNewUnlocks(
  userId: string,
  unlockIds: string[]
): EquippedCosmetics {
  const equipped = ensureEquippedRow(userId);
  for (const id of unlockIds) {
    const def = getCosmeticById(id);
    if (!def || def.slot === "emote") continue;
    const field = SLOT_COLUMN[def.slot];
    if (!field) continue;
    const current = equipped[field];
    const defaultId = getDefaultCosmeticId(def.slot);
    const isEmptyOrDefault =
      current == null || current === defaultId || (def.slot === "title" && !current) || (def.slot === "badge" && !current);
    if (isEmptyOrDefault || def.slot === "title" || def.slot === "badge") {
      // Prefer newest title/badge; for other slots only replace default
      if (def.slot === "title" || def.slot === "badge" || current === defaultId || current == null) {
        try {
          Object.assign(equipped, equipCosmetic(userId, def.slot, id));
        } catch {
          // ignore
        }
      }
    }
  }
  return getEquippedCosmetics(userId) ?? equipped;
}

export function listOwnedCosmeticIds(userId: string): string[] {
  const defaults = DEFAULT_IDS();
  const unlocked = listUnlocks(userId).map((u) => u.id);
  return Array.from(new Set([...defaults, ...unlocked]));
}

function DEFAULT_IDS(): string[] {
  return ["cardback_default", "classic-green", "frame_default", "seat_ring_default", "chipskin_default"];
}

/** Cosmetics other players should see (titles/frames — not local table prefs). */
export interface PublicPlayerCosmetics {
  titleId: string | null;
  badgeId: string | null;
  frameId: string | null;
  seatRingId: string | null;
}

export function getPublicPlayerCosmetics(userId: string): PublicPlayerCosmetics {
  const equipped = ensureEquippedRow(userId);
  return {
    titleId: equipped.titleId,
    badgeId: equipped.badgeId,
    frameId: equipped.frameId,
    seatRingId: equipped.seatRingId,
  };
}
