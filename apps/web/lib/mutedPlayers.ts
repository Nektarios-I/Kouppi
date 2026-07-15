const MUTED_KEY = "kouppi_muted_players";

export function getMutedPlayerIds(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(MUTED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function isPlayerMuted(playerId: string): boolean {
  return getMutedPlayerIds().has(playerId);
}

export function mutePlayer(playerId: string): void {
  if (typeof localStorage === "undefined") return;
  const ids = getMutedPlayerIds();
  ids.add(playerId);
  localStorage.setItem(MUTED_KEY, JSON.stringify([...ids]));
}

export function unmutePlayer(playerId: string): void {
  if (typeof localStorage === "undefined") return;
  const ids = getMutedPlayerIds();
  ids.delete(playerId);
  localStorage.setItem(MUTED_KEY, JSON.stringify([...ids]));
}
