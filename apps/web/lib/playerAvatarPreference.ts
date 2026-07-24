/**
 * Shared player avatar preference for SP / MP / Career guests.
 * Auth users also persist via PATCH /api/profile (callers handle that).
 */

import { getDefaultAvatar, normalizeAvatarConfig, type AvatarConfig } from "@/lib/avatars";
import { getServerUrl } from "@/lib/serverUrl";

export const PLAYER_AVATAR_STORAGE_KEY = "kouppi_player_avatar";

function readFromStore(store: Storage): AvatarConfig | null {
  try {
    const raw = store.getItem(PLAYER_AVATAR_STORAGE_KEY);
    if (!raw) return null;
    return normalizeAvatarConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Load guest/shared preference: session first, then local, else default. */
export function loadPlayerAvatarPreference(): AvatarConfig {
  if (typeof window === "undefined") return getDefaultAvatar();
  return (
    readFromStore(sessionStorage) ??
    readFromStore(localStorage) ??
    getDefaultAvatar()
  );
}

/** Persist to both session + local so SP and MP share the same guest choice. */
export function savePlayerAvatarPreference(avatar: AvatarConfig): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(normalizeAvatarConfig(avatar));
  try {
    sessionStorage.setItem(PLAYER_AVATAR_STORAGE_KEY, json);
  } catch {
    /* ignore quota / private mode */
  }
  try {
    localStorage.setItem(PLAYER_AVATAR_STORAGE_KEY, json);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Persist avatar on the career/auth profile when logged in. */
export async function patchProfileAvatar(
  token: string,
  avatar: AvatarConfig
): Promise<boolean> {
  try {
    const response = await fetch(`${getServerUrl()}/api/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ avatar: { id: normalizeAvatarConfig(avatar).id } }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
