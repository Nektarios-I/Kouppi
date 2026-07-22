/**
 * Shared avatar catalog.
 *
 * To add a new player figure later:
 * 1. Drop a transparent PNG at apps/web/public/assets/avatars/<id>.png
 * 2. Append { id: "<id>" } here
 * 3. Rebuild @kouppi/protocol
 *
 * Image URLs are convention-based: /assets/avatars/<id>.png
 */

export const AVATAR_CATALOG = [
  { id: "portrait-01" },
  { id: "portrait-02" },
  { id: "portrait-03" },
  { id: "portrait-04" },
  { id: "portrait-05" },
  { id: "portrait-06" },
  { id: "portrait-07" },
  { id: "portrait-08" },
  { id: "portrait-09" },
  { id: "portrait-10" },
  { id: "portrait-11" },
  { id: "portrait-12" },
  { id: "portrait-13" },
  { id: "portrait-14" },
  { id: "portrait-15" },
  { id: "portrait-16" },
  { id: "portrait-17" },
  { id: "portrait-18" },
  { id: "portrait-19" },
  { id: "portrait-20" },
  { id: "portrait-21" },
  { id: "portrait-22" },
  { id: "portrait-23" },
  { id: "portrait-24" },
] as const;

export type AvatarId = (typeof AVATAR_CATALOG)[number]["id"];

export const AVATAR_IDS: readonly AvatarId[] = AVATAR_CATALOG.map((a) => a.id);

export const DEFAULT_AVATAR_ID: AvatarId = "portrait-01";

export const AVATAR_FALLBACK_SRC = "/assets/avatars/fallback.svg";

/** Premium fixed ring used across all portrait avatars */
export const AVATAR_RING = {
  fill: "rgba(12, 16, 28, 0.92)",
  border: "rgba(212, 175, 55, 0.55)",
} as const;

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && (AVATAR_IDS as readonly string[]).includes(value);
}

export function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Deterministic catalog pick from any seed (player id, legacy emoji, etc.) */
export function avatarIdFromSeed(seed: string): AvatarId {
  if (!seed) return DEFAULT_AVATAR_ID;
  return AVATAR_IDS[hashSeed(seed) % AVATAR_IDS.length];
}

/**
 * Normalize legacy emoji configs / raw DB values into a catalog id.
 * Accepts:
 * - { id: "portrait-01" }
 * - { emoji: "😎", color, borderColor } (legacy)
 * - "portrait-01" | "😎" (raw string)
 */
export function resolveAvatarId(raw: unknown): AvatarId {
  if (typeof raw === "string") {
    return isAvatarId(raw) ? raw : avatarIdFromSeed(raw);
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (isAvatarId(obj.id)) return obj.id;
    if (typeof obj.id === "string") return avatarIdFromSeed(obj.id);
    if (typeof obj.emoji === "string") {
      return isAvatarId(obj.emoji) ? obj.emoji : avatarIdFromSeed(obj.emoji);
    }
  }
  return DEFAULT_AVATAR_ID;
}

export function getAvatarSrc(id: string): string {
  if (isAvatarId(id)) return `/assets/avatars/${id}.png`;
  return AVATAR_FALLBACK_SRC;
}
