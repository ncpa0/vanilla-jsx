import { ItemHeightModel } from "./height-model-interface";

/**
 * Height model for dynamic rows where each row is always the same height as all others.
 */
export class DynamicHomogeneousHeightModel implements ItemHeightModel {
  count;
  estimatedHeight = 0;
  hasMeasuredEstimate;

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
    if (measured.size > 0) {
      this.estimatedHeight = measured.get(measured.keys().next().value!)!;
      this.hasMeasuredEstimate = true;
    } else {
      this.estimatedHeight = estimatedHeight;
      this.hasMeasuredEstimate = false;
    }
  }

  rebuild(
    count: number,
    getMeasured: () => Map<number, number>,
  ): void {
    const measured = getMeasured();
    this.count = count;
    if (measured.size > 0) {
      this.estimatedHeight = measured.get(measured.keys().next().value!)!;
      this.hasMeasuredEstimate = true;
    } else {
      this.hasMeasuredEstimate = false;
    }
  }

  setCount(count: number) {
    if (this.count === count) {
      return;
    }

    this.count = count;
  }

  /** Records a row measurement and updates the delta tree when it changed. */
  setMeasuredHeight(index: number, height: number) {
    let changed = this.estimatedHeight != height;
    this.estimatedHeight = height;
    this.hasMeasuredEstimate = true;
    return changed;
  }

  /** Returns the estimated/measured pixel offset at the start of an index. */
  offsetOf(index: number) {
    const clamped = Math.min(this.count, Math.max(0, index));
    return clamped * this.estimatedHeight;
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

  indexAtOffset(offset: number) {
    if (this.count === 0 || offset <= 0) {
      return 0;
    }

    return Math.round(offset / this.estimatedHeight);
  }
}
