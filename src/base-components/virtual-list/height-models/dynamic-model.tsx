import { FenwickTree } from "../fenwick-tree";
import { ItemHeightModel } from "./height-model-interface";

/**
 * Height model for dynamic rows. Unknown rows use one estimate; measured rows
 * are stored as deltas from that estimate in a Fenwick tree.
 */
export class DynamicHeightModel implements ItemHeightModel {
  count;
  estimatedHeight;
  hasMeasuredEstimate;
  private measured = new Map<number, number>();
  private deltas = new FenwickTree();

  constructor({
    count,
    estimatedHeight,
    measured,
  }: {
    count: number;
    estimatedHeight: number;
    measured: Map<number, number>;
  }) {
    this.count = count;
    this.estimatedHeight = estimatedHeight;
    this.hasMeasuredEstimate = measured.size > 0;
    this.measured = measured;
    this.rebuildDeltas();
  }

  rebuild(
    count: number,
    measured: () => Map<number, number>,
  ): void {
    this.count = count;
    this.measured = measured();
    this.rebuildDeltas();
  }

  setCount(count: number) {
    if (this.count === count) {
      return;
    }

    this.count = count;
    for (const index of this.measured.keys()) {
      if (index >= count) {
        this.measured.delete(index);
      }
    }
    this.rebuildDeltas();
  }

  /** Records a row measurement and updates the delta tree when it changed. */
  setMeasuredHeight(index: number, height: number) {
    if (index < 0 || index >= this.count) {
      return false;
    }

    let changed = false;
    if (!this.hasMeasuredEstimate) {
      this.hasMeasuredEstimate = true;
      this.estimatedHeight = height;
      this.rebuildDeltas();
      changed = true;
    }

    const previous = this.measured.get(index);
    if (previous != null && Math.abs(previous - height) < 0.5) {
      return changed;
    }

    this.measured.set(index, height);
    this.deltas.set(index, height - this.estimatedHeight);
    return true;
  }

  /** Returns the estimated/measured pixel offset at the start of an index. */
  offsetOf(index: number) {
    const clamped = Math.min(this.count, Math.max(0, index));
    return clamped * this.estimatedHeight + this.deltas.prefix(clamped);
  }

  /** Returns the remaining height after an inclusive rendered end index. */
  tailHeightAfter(index: number) {
    const next = Math.min(this.count, Math.max(0, index + 1));
    return Math.max(0, this.totalHeight() - this.offsetOf(next));
  }

  /** Returns the estimated total scrollable height. */
  totalHeight() {
    return this.offsetOf(this.count);
  }

  /** Binary-searches offsets because dynamic rows are non-uniform. */
  indexAtOffset(offset: number) {
    if (this.count === 0 || offset <= 0) {
      return 0;
    }

    let low = 0;
    let high = this.count - 1;
    while (low < high) {
      const mid = ((low + high) * 0.5) | 0;
      if (this.offsetOf(mid + 1) <= offset) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  /** Rebuilds measured deltas after data length or estimate changes. */
  private rebuildDeltas() {
    this.deltas.reset(this.count);
    for (const [index, height] of this.measured) {
      if (index < this.count) {
        this.deltas.set(index, height - this.estimatedHeight);
      }
    }
  }
}
