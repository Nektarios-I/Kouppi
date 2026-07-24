/**
 * Bounded dedupe for chip transfer event ids.
 * Prevents duplicate flies from Strict Mode, reconnect hydration, and double subscriptions.
 */

const DEFAULT_CAP = 64;

export class ChipTransferDedupeSet {
  private seen = new Set<string>();
  private order: string[] = [];
  private readonly cap: number;

  constructor(cap = DEFAULT_CAP) {
    this.cap = Math.max(8, cap);
  }

  has(id: string): boolean {
    return this.seen.has(id);
  }

  /** Returns true if newly added; false if already seen. */
  add(id: string): boolean {
    if (!id) return false;
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    this.order.push(id);
    while (this.order.length > this.cap) {
      const oldest = this.order.shift();
      if (oldest) this.seen.delete(oldest);
    }
    return true;
  }

  /** Add and return only ids that were not previously seen. */
  filterNew(ids: readonly string[]): string[] {
    return ids.filter((id) => this.add(id));
  }

  clear(): void {
    this.seen.clear();
    this.order = [];
  }

  get size(): number {
    return this.seen.size;
  }
}

/** Bound an in-flight transfer queue (drop oldest). */
export function boundTransferQueue<T>(queue: T[], max = 12): T[] {
  if (queue.length <= max) return queue;
  return queue.slice(queue.length - max);
}
