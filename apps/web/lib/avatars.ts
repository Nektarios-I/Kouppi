/**
 * Avatar system for player visual identity.
 *
 * Catalog source of truth: @kouppi/protocol (AVATAR_CATALOG).
 * To add a figure: drop PNG in public/assets/avatars/<id>.png and append id to AVATAR_CATALOG.
 */

import {
  AVATAR_CATALOG,
  AVATAR_FALLBACK_SRC,
  AVATAR_IDS,
  AVATAR_RING,
  DEFAULT_AVATAR_ID,
  avatarIdFromSeed,
  getAvatarSrc,
  isAvatarId,
  resolveAvatarId,
  type AvatarId,
} from "@kouppi/protocol";

export type AvatarConfig = {
  id: string;
};

export {
  AVATAR_CATALOG,
  AVATAR_FALLBACK_SRC,
  AVATAR_IDS,
  AVATAR_RING,
  DEFAULT_AVATAR_ID,
  avatarIdFromSeed,
  getAvatarSrc,
  isAvatarId,
  resolveAvatarId,
};
export type { AvatarId };

/** @deprecated Color swatches removed — ring is fixed premium gold */
export const AVATAR_COLORS = [
  { name: "Gold", value: AVATAR_RING.fill, border: AVATAR_RING.border },
] as const;

export function getAllAvatarIds(): readonly string[] {
  return AVATAR_IDS;
}

export function getDefaultAvatar(): AvatarConfig {
  return { id: DEFAULT_AVATAR_ID };
}

export function getRandomAvatar(): AvatarConfig {
  const id = AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
  return { id };
}

/** Deterministic bot persona for single-player seats */
export function getBotAvatar(botId: string): AvatarConfig {
  return { id: avatarIdFromSeed(`bot:${botId}`) };
}

/** Deterministic avatar from player ID */
export function getAvatarFromId(playerId: string): AvatarConfig {
  return { id: avatarIdFromSeed(playerId) };
}

/** Normalize any stored/network payload into AvatarConfig */
export function normalizeAvatarConfig(raw: unknown): AvatarConfig {
  return { id: resolveAvatarId(raw) };
}

export function avatarConfigFromProfile(avatarId: string | undefined | null): AvatarConfig {
  return { id: resolveAvatarId(avatarId ?? DEFAULT_AVATAR_ID) };
}
