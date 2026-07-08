/** Prefix-sum tree used to query measured-height deltas in O(log n). */
export class FenwickTree {
  private tree: number[] = [];

  reset(size: number) {
    this.tree = new Array(size + 1).fill(0);
  }

  /** Sets one index's delta value while preserving prefix-query performance. */
  set(index: number, value: number) {
    const previous = this.range(index, index + 1);
    const delta = value - previous;
    if (delta === 0) {
      return;
    }

    for (let i = index + 1; i < this.tree.length; i += i & -i) {
      this.tree[i] = (this.tree[i] ?? 0) + delta;
    }
  }

  /** Returns the sum of values in [0, endExclusive). */
  prefix(endExclusive: number) {
    const to = Math.min(this.tree.length - 1, Math.max(0, endExclusive));
    let sum = 0;

    for (let i = to; i > 0; i -= i & -i) {
      sum += this.tree[i]!;
    }

    return sum;
  }

  private range(start: number, end: number) {
    return this.prefix(end) - this.prefix(start);
  }
}
