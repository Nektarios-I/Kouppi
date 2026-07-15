type WindowBucket = { timestamps: number[] };

const buckets = new Map<string, WindowBucket>();

function prune(bucket: WindowBucket, windowMs: number, now: number): void {
  bucket.timestamps = bucket.timestamps.filter((t) => t > now - windowMs);
}

/** Sliding-window rate limit keyed by socket id + event name. */
export function checkEventRateLimit(
  socketId: string,
  event: string,
  maxPerMinute: number,
  minIntervalMs = 0
): { allowed: boolean; retryAfterMs?: number } {
  const key = `${socketId}:${event}`;
  const now = Date.now();
  const windowMs = 60_000;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  prune(bucket, windowMs, now);

  if (bucket.timestamps.length >= maxPerMinute) {
    const retryAfterMs = bucket.timestamps[0] + windowMs - now;
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  const last = bucket.timestamps[bucket.timestamps.length - 1];
  if (minIntervalMs > 0 && last && now - last < minIntervalMs) {
    return { allowed: false, retryAfterMs: minIntervalMs - (now - last) };
  }

  return { allowed: true };
}

export function recordEvent(socketId: string, event: string): void {
  const key = `${socketId}:${event}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  prune(bucket, 60_000, now);
  bucket.timestamps.push(now);
}

/** Remove all rate-limit buckets for a disconnected socket. */
export function clearRateLimitsForSocket(socketId: string): void {
  for (const key of Array.from(buckets.keys())) {
    if (key.startsWith(`${socketId}:`)) {
      buckets.delete(key);
    }
  }
}

/** Test helper — clear all buckets between tests. */
export function resetRateLimits(): void {
  buckets.clear();
}
