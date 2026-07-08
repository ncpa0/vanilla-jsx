export interface ItemHeightModel {
  count: number;
  estimatedHeight: number;
  hasMeasuredEstimate: boolean;
  setCount(count: number): void;
  setMeasuredHeight(index: number, height: number): boolean;
  offsetOf(index: number): number;
  tailHeightAfter(index: number): number;
  indexAtOffset(offset: number): number;
  rebuild(
    count: number,
    getMeasured: () => Map<number, number>,
  ): void;
}
