import { ItemHeightModel } from "./height-model-interface";

/** Height model for lists where every row has the exact same height. */
export class FixedHeightModel implements ItemHeightModel {
  hasMeasuredEstimate = true;

  constructor(
    public count: number,
    public estimatedHeight: number,
  ) {}

  rebuild(
    count: number,
  ): void {
    this.count = count;
  }

  setCount(count: number) {
    this.count = count;
  }

  /** Fixed rows ignore measured heights; all math is based on itemHeight. */
  setMeasuredHeight() {
    return false;
  }

  /** Returns the pixel offset at the start of an item index. */
  offsetOf(index: number) {
    const clamped = Math.min(this.count, Math.max(0, index));
    return clamped * this.estimatedHeight;
  }

  /** Returns the remaining height after an inclusive rendered end index. */
  tailHeightAfter(index: number) {
    const next = Math.min(this.count, Math.max(0, index + 1));
    return Math.max(0, this.offsetOf(this.count) - this.offsetOf(next));
  }

  /** Maps a scroll offset to the row occupying that offset. */
  indexAtOffset(offset: number) {
    if (this.count === 0 || offset <= 0) {
      return 0;
    }

    return Math.min(this.count - 1, (offset / this.estimatedHeight) | 0);
  }
}
