/**
 * Server-authoritative UTC period helpers for the reward system.
 */

/** YYYY-MM-DD in UTC */
export function getDailyPeriodKey(nowMs: number = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** Previous UTC calendar day key */
export function getPreviousDailyPeriodKey(nowMs: number = Date.now()): string {
  return getDailyPeriodKey(nowMs - 24 * 60 * 60 * 1000);
}

/**
 * ISO week key YYYY-Www (week starts Monday UTC).
 */
export function getWeeklyPeriodKey(nowMs: number = Date.now()): string {
  const date = new Date(nowMs);
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const year = utc.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

export function isSameDailyPeriod(a: string | null | undefined, b: string): boolean {
  return !!a && a === b;
}

/** True if `lastClaimDate` was exactly yesterday relative to `todayKey`. */
export function isConsecutiveDailyClaim(lastClaimDate: string | null, todayKey: string): boolean {
  if (!lastClaimDate) return false;
  const yesterday = getPreviousDailyPeriodKey(Date.parse(`${todayKey}T00:00:00.000Z`));
  return lastClaimDate === yesterday;
}

/** Next UTC midnight after `nowMs` (daily reset). */
export function getNextDailyResetAt(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
}

/** Next Monday 00:00 UTC (weekly reset). */
export function getNextWeeklyResetAt(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  let add = (8 - day) % 7;
  if (add === 0) add = 7; // already Monday → next Monday
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add, 0, 0, 0, 0);
}
