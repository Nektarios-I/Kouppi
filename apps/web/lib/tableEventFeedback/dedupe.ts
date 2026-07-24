/**
 * Bounded seen-set for feedback event ids.
 * Prevents duplicate ribbon/log/animation from Strict Mode double-effects
 * and identical resolution re-delivery.
 */
export class FeedbackDedupeSet {
  private seen = new Set<string>();
  private order: string[] = [];

  constructor(private readonly maxSize = 64) {}

  has(id: string): boolean {
    return this.seen.has(id);
  }

  /** Returns true if newly recorded; false if already seen. */
  tryAdd(id: string): boolean {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    this.order.push(id);
    while (this.order.length > this.maxSize) {
      const old = this.order.shift();
      if (old) this.seen.delete(old);
    }
    return true;
  }

  clear(): void {
    this.seen.clear();
    this.order = [];
  }

  size(): number {
    return this.seen.size;
  }
}
