import { ClassComponent } from "../class-component";
import { StyleDict, WithSignals } from "../jsx-namespace/jsx.types";
import { ClassComponentInit, GetElement, jsx } from "../reconciler/reconciler";
import { bindSignal } from "../sig-proxy/_proxy";
import { ReadonlySignal, sig } from "../signals/signal";

export type VirtualListProps<T> = {
  data: JSX.Signal<readonly T[]>;
  /**
   * Don't add the default class name to the parent element.
   * (`vjsx-virt-list-container`)
   */
  noclass?: boolean;
  /**
   *  A function that will return the HTML element for each value in the data list provided.
   */
  render: (value: T, index: ReadonlySignal<number>) => GetElement;
  renderEmpty?: () => GetElement;
  getKey: (value: T) => string;
  containerProps?: Omit<JSX.IntrinsicElements["div"], "style" | "children"> & {
    style?: WithSignals<StyleDict>;
  };
  /** Number of items to render initially. */
  initialRender?: number;
  /** Number of items per page. Whenever a treshold is reached this number of elements will be added to the list. */
  pageSize?: number;
  /** (in pixels) Determines when to add the next page. */
  threshold?: number;
  /** Initial height estimate for dynamic-height items. Ignored when itemHeight is set. */
  estimateItemHeight?: number;
  /** Overscan before the viewport in pixels. Defaults to threshold. */
  overscanBefore?: number;
  /** Overscan after the viewport in pixels. Defaults to threshold. */
  overscanAfter?: number;
  /**
   * Height of a single item. Used to determine the the amount of margin needed to be added to keep the scroll view
   * height the same regardless which items are rendered or not before the actual height is known.
   *
   * `auto-first` will take the height of the first element and use that.
   */
  itemHeight?: number; // | "auto-first";
  /**
   * Number of children to keep in memory before and after the rendered window.
   *
   * Set to -1 to always keep all elements memoized.
   *
   * Example:
   * - 500 items
   * - list is scrolled into the middle so that
   * - first rendered element is #200
   * - last rendered element is #300
   * - memoRange is set to 32:
   *
   * => items 0-167 are not rendered nor kept in memory
   *
   * => items 168-199 are not rendered but kept in memory for future reuse
   *
   * => items 301-333 are not rendered but kept in memory for future reuse
   *
   * => items 334-500 are not rendered nor kept in memory
   *
   * @default 32
   */
  memoRange?: number;
  onscroll?: (ev: Event, topPos: number) => void;
  initialScroll?: number;
};

type VisibleRow<T> = {
  item: T;
  key: string;
  index: number;
};

function rangeEq(rangeA: [number, number], rangeB: [number, number]) {
  return rangeA[0] === rangeB[0] && rangeA[1] === rangeB[1];
}

export class VirtualList<T> extends ClassComponent<VirtualListProps<T>> {
  private visibleRange;
  private list!: HTMLDivElement & { VirtualList: VirtualList<T> };
  private entries = new VirtualListEntryMap<T>();
  private mountedKeys = new Set<string>();
  /**
   * Strategy object for all height math. Fixed-height lists use direct O(1)
   * arithmetic, dynamic lists use an estimate plus measured deltas.
   */
  private heightModel: ItemHeightModel;
  /**
   * Lightweight measurement cache that survives entry deletion. This lets a row
   * regain its known height when it is recreated after scrolling back to it.
   */
  private heightByKey = new Map<string, number>();
  /** Buckets entries by index so memo cleanup can skip whole regions quickly. */
  private entryBuckets = new Map<number, Set<string>>();
  private resizeObserver?: ResizeObserver;
  /** Latest ResizeObserver heights waiting for the next animation-frame commit. */
  private pendingResizeHeights = new Map<Element, number>();
  private resizeCommitScheduled = false;
  /** Maps row wrappers back to data keys for ResizeObserver callbacks. */
  private wrapperKeys = new WeakMap<Element, string>();
  private recalcScheduled = false;
  private cleanupTimer?: ReturnType<typeof setTimeout>;
  private scrollCounter = 0;
  private lastBounds?: [number, number];

  private topSpacer = document.createElement("div");
  private bottomSpacer = document.createElement("div");

  constructor(props: VirtualListProps<T>, init: ClassComponentInit) {
    super(props, init);

    this.heightModel = this.createHeightModel(props.data.get());

    this.visibleRange = sig<[number, number]>([
      0,
      (props.initialRender ?? this.pageSize) - 1,
    ], {
      compare: rangeEq,
    });

    props.data.add(data => {
      this.rebuildHeightModel(data);
      if (this.list) {
        this.lastBounds = undefined;
        this.recalculateRange(true);
        this.scheduleEntryCleanup();
        if (this.props.initialScroll != null) {
          this.list.scrollTop = this.props.initialScroll;
        }
      }
    });
  }

  private get pageSize() {
    return Math.max(2, this.props.pageSize ?? 32);
  }

  private get fixedItemHeight() {
    return this.props.itemHeight != null && this.props.itemHeight > 0
      ? this.props.itemHeight
      : undefined;
  }

  private get initialEstimatedHeight() {
    return Math.max(
      1,
      this.fixedItemHeight ?? this.props.estimateItemHeight ?? 32,
    );
  }

  private get overscanBefore() {
    return this.props.overscanBefore ?? this.props.threshold ?? 1000;
  }

  private get overscanAfter() {
    return this.props.overscanAfter ?? this.props.threshold ?? 1000;
  }

  private get entryBucketSize() {
    return Math.max(16, this.pageSize);
  }

  private keyFor(item: T) {
    return String(this.props.getKey(item));
  }

  private createHeightModel(data = this.props.data.get()): ItemHeightModel {
    if (this.fixedItemHeight != null) {
      return new FixedHeightModel(data.length, this.fixedItemHeight);
    }

    const measured = this.getMeasuredHeights(data);
    const previousEstimate = this.heightModel?.estimatedHeight;
    return new DynamicHeightModel({
      count: data.length,
      estimatedHeight: previousEstimate ?? this.initialEstimatedHeight,
      measured,
    });
  }

  /** Rebuilds the height strategy after data shape changes. */
  private rebuildHeightModel(data = this.props.data.get()) {
    this.heightModel.rebuild(
      data.length,
      () => this.getMeasuredHeights(data),
    );
  }

  /** Converts the key-based height cache into index-based measurements. */
  private getMeasuredHeights(data = this.props.data.get()) {
    const measured = new Map<number, number>();

    for (let i = 0; i < data.length; i++) {
      const height = this.heightByKey.get(this.keyFor(data[i]!));
      if (height != null) {
        measured.set(i, height);
      }
    }

    return measured;
  }

  /** Gets or creates the state object for a row and keeps its index signal fresh. */
  private getEntry(row: VisibleRow<T>) {
    const existing = this.entries.get(row.key);
    if (existing) {
      existing.update(row.item, row.index);
      this.trackEntryIndex(row.key, existing);
      return existing;
    }

    const entry = new VirtualListEntry(
      this.props.render,
      row.key,
      row.item,
      row.index,
    );
    this.entries.set(row.key, entry);
    this.trackEntryIndex(row.key, entry);
    return entry;
  }

  /** Applies current virtual padding and flex ordering to the spacer elements. */
  private syncSpacers() {
    const [start, end] = this.visibleRange.get();
    this.topSpacer.style.height = this.heightModel.offsetOf(start) + "px";
    this.bottomSpacer.style.height = this.heightModel.tailHeightAfter(end)
      + "px";
    this.topSpacer.style.order = "0";
    this.bottomSpacer.style.order = String(this.heightModel.count + 1);
  }

  /** Moves an entry between index buckets used by non-visible cache cleanup. */
  private trackEntryIndex(key: string, entry: VirtualListEntry<T>) {
    const prevBucket = entry.bucketIndex;
    const nextBucket = Math.floor(entry.index / this.entryBucketSize);
    if (prevBucket === nextBucket) {
      return;
    }

    if (prevBucket != null) {
      const bucket = this.entryBuckets.get(prevBucket);
      bucket?.delete(key);
      if (bucket?.size === 0) {
        this.entryBuckets.delete(prevBucket);
      }
    }

    entry.bucketIndex = nextBucket;
    let bucket = this.entryBuckets.get(nextBucket);
    if (!bucket) {
      bucket = new Set();
      this.entryBuckets.set(nextBucket, bucket);
    }
    bucket.add(key);
  }

  /** Calculates the render window from scroll bounds and current height model. */
  private recalculateRange(force = false) {
    const data = this.props.data.get();
    this.heightModel.setCount(data.length);

    if (data.length === 0) {
      this.visibleRange.dispatch([0, 0]);
      return;
    }

    if (
      !this.fixedItemHeight && !this.heightModel.hasMeasuredEstimate && !force
    ) {
      return;
    }

    const topBound = this.list.scrollTop;
    const bottomBound = topBound + this.list.clientHeight;

    const bailThreshold = Math.max(
      16,
      Math.max(this.overscanBefore, this.overscanAfter) / 4,
    );
    if (
      force === false && this.lastBounds
      && Math.abs(this.lastBounds[0] - topBound) < bailThreshold
      && Math.abs(this.lastBounds[1] - bottomBound) < bailThreshold
    ) {
      return;
    }

    this.lastBounds = [topBound, bottomBound];

    const overscanTop = Math.max(0, topBound - this.overscanBefore);
    const overscanBottom = Math.max(0, bottomBound + this.overscanAfter);

    let start = this.heightModel.indexAtOffset(overscanTop);
    let end = this.heightModel.indexAtOffset(overscanBottom);

    start = Math.floor(start / this.pageSize) * this.pageSize;
    end = Math.min(
      data.length - 1,
      Math.ceil((end + 1) / this.pageSize) * this.pageSize - 1,
    );

    const minEnd = Math.min(data.length - 1, start + this.pageSize - 1);
    if (end < minEnd) {
      end = minEnd;
    }

    this.visibleRange.dispatch([start, end]);
  }

  /** Batches scroll-driven range recalculation to one animation frame. */
  private scheduleRecalculate(force = false) {
    if (force) {
      this.recalculateRange(true);
      return;
    }

    if (this.recalcScheduled) {
      return;
    }

    this.recalcScheduled = true;
    requestAnimationFrame(() => {
      this.recalcScheduled = false;
      this.recalculateRange();
    });
  }

  /** Collects ResizeObserver updates and defers height-model mutation to rAF. */
  private onResize(entries: ResizeObserverEntry[]) {
    for (let i = 0; i < entries.length; i++) {
      const elem = entries[i]!.target;
      this.pendingResizeHeights.set(elem, this.resizeEntryHeight(entries[i]!));
    }

    if (this.resizeCommitScheduled) {
      return;
    }

    this.resizeCommitScheduled = true;
    requestAnimationFrame(() => this.commitResizeMeasurements());
  }

  /** Returns the wrapper border-box block size reported by ResizeObserver. */
  private resizeEntryHeight(entry: ResizeObserverEntry) {
    const borderSize = entry.borderBoxSize[0];
    return borderSize?.blockSize ?? entry.contentRect.height;
  }

  /** Commits all pending row-size changes as one height-model update batch. */
  private commitResizeMeasurements() {
    this.resizeCommitScheduled = false;

    let changed = false;
    for (const [elem, height] of this.pendingResizeHeights) {
      const key = this.wrapperKeys.get(elem);
      const entry = key == null ? undefined : this.entries.get(key);
      if (!entry || height <= 0 || Math.abs(entry.lastHeight - height) < 0.5) {
        continue;
      }

      entry.lastHeight = height;
      this.heightByKey.set(entry.key, height);
      changed = this.heightModel.setMeasuredHeight(entry.index, height)
        || changed;
    }

    this.pendingResizeHeights.clear();

    if (changed) {
      this.syncSpacers();
      this.scheduleRecalculate(true);
    }
  }

  /**
   * Ensures visible rows have wrappers in the DOM. Visual ordering comes from
   * flex-order, so existing wrappers do not need to be moved for every reorder.
   */
  private mountRows(rows: VisibleRow<T>[]) {
    if (this.mountedKeys.size === 0) {
      this.list.replaceChildren(this.topSpacer, this.bottomSpacer);
    }

    const visibleKeys = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      visibleKeys.add(row.key);

      const entry = this.getEntry(row);
      const wrapper = entry.renderWrapper();
      wrapper.style.order = String(row.index + 1);
      this.wrapperKeys.set(wrapper, row.key);

      if (!wrapper.isConnected) {
        this.list.insertBefore(wrapper, this.bottomSpacer);
      }

      if (!this.mountedKeys.has(row.key)) {
        this.resizeObserver?.observe(wrapper);
        this.mountedKeys.add(row.key);
      }
    }

    const keys = Array.from(this.mountedKeys);
    let key: string;
    for (let i = 0; i < keys.length; i++) {
      key = keys[i]!;
      if (visibleKeys.has(key)) {
        continue;
      }

      const entry = this.entries.get(key);
      if (entry?.wrapper) {
        this.resizeObserver?.unobserve(entry.wrapper);
        entry.wrapper.remove();
      }
      this.mountedKeys.delete(key);
    }

    this.syncSpacers();
    this.scheduleEntryCleanup();
  }

  /** Switches the container into the empty-state DOM shape. */
  private renderEmpty(list: HTMLDivElement) {
    this.mountedKeys.clear();
    this.topSpacer.style.height = "0px";
    this.bottomSpacer.style.height = "0px";

    const emptyElem = this.props.renderEmpty?.();
    if (emptyElem) {
      list.replaceChildren(this.topSpacer, emptyElem, this.bottomSpacer);
    } else {
      list.replaceChildren(this.topSpacer, this.bottomSpacer);
    }
  }

  /** Reconciles the derived visible rows with mounted wrapper elements. */
  private bindRows(
    list: HTMLDivElement,
    { rows, empty }: { rows: Array<VisibleRow<T>>; empty: boolean },
  ) {
    if (empty) {
      this.renderEmpty(list);
      return;
    }

    if (!this.topSpacer.isConnected || !this.bottomSpacer.isConnected) {
      list.replaceChildren(this.topSpacer, this.bottomSpacer);
    }

    this.mountRows(rows);
  }

  /** Debounces memo-range cleanup so rapid scroll events do not scan buckets. */
  private scheduleEntryCleanup() {
    if (this.cleanupTimer != null) {
      return;
    }

    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = undefined;
      this.deleteFarEntries();
    }, 500);
  }

  /** Deletes cached entries in buckets that are outside the configured memo range. */
  private deleteFarEntries() {
    const memoRange = this.props.memoRange ?? 32;
    if (memoRange < 0) {
      return;
    }

    const [start, end] = this.visibleRange.get();
    const minIndex = Math.max(0, start - memoRange);
    const maxIndex = end + memoRange;
    const minBucket = Math.floor(minIndex / this.entryBucketSize);
    const maxBucket = Math.floor(maxIndex / this.entryBucketSize);

    const bucketEntries = Array.from(this.entryBuckets);
    let bucketIndex: number;
    let keys: Set<string>;
    for (let i = 0; i < bucketEntries.length; i++) {
      [bucketIndex, keys] = bucketEntries[i]!;
      if (bucketIndex >= minBucket && bucketIndex <= maxBucket) {
        continue;
      }

      for (const key of keys) {
        const entry = this.entries.get(key);
        if (!entry) {
          continue;
        }

        if (entry.wrapper) {
          this.resizeObserver?.unobserve(entry.wrapper);
          entry.wrapper.remove();
        }

        this.mountedKeys.delete(key);
        this.entries.delete(key);
      }

      this.entryBuckets.delete(bucketIndex);
    }
  }

  render() {
    const visibleRows = sig.derive(
      this.props.data,
      this.visibleRange,
      (data, [start, end]) => {
        this.heightModel.setCount(data.length);

        const to = Math.min(end + 1, data.length);
        const rows = new Array<VisibleRow<T>>(Math.max(0, to - start));

        for (let i = start; i < to; i++) {
          const item = data[i]!;
          rows[i - start] = {
            item,
            key: this.keyFor(item),
            index: i,
          };
        }

        return {
          rows,
          empty: data.length === 0,
        };
      },
    );

    this.list = (
      <div
        {...this.props.containerProps}
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          overflowAnchor: "none",
          scrollBehavior: "smooth",
          contain: "layout paint style",
          ...this.props.containerProps?.style,
        }}
      >
        {this.topSpacer}
        {this.bottomSpacer}
      </div>
    ) as HTMLDivElement & { VirtualList: VirtualList<T> };
    this.list.VirtualList = this;

    this.topSpacer.style.flexShrink = "0";
    this.bottomSpacer.style.flexShrink = "0";
    this.rebuildHeightModel(this.props.data.get());

    if (!this.fixedItemHeight) {
      this.resizeObserver = new ResizeObserver(entries =>
        this.onResize(entries)
      );
    }

    bindSignal(
      visibleRows,
      this.list,
      (list, data) => this.bindRows(list, data),
    );

    if (this.props.noclass !== true) {
      this.list.classList.add("vjsx-virt-list-container");
    }

    this.list.addEventListener("scroll", (ev) => {
      this.scheduleEntryCleanup();

      this.scrollCounter++;
      if (this.scrollCounter % 3 === 0) {
        this.scrollCounter = 0;
        this.scheduleRecalculate();
      }

      this.props.onscroll?.(ev, this.list.scrollTop);
    }, { passive: true });

    queueMicrotask(() => {
      this.scheduleRecalculate(true);
      if (this.props.initialScroll != null) {
        this.list.scrollTop = this.props.initialScroll;
      }
    });

    return this.list;
  }
}

interface ItemHeightModel {
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

/** Height model for lists where every row has the exact same height. */
class FixedHeightModel implements ItemHeightModel {
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

    return Math.min(this.count - 1, Math.floor(offset / this.estimatedHeight));
  }
}

/**
 * Height model for dynamic rows. Unknown rows use one estimate; measured rows
 * are stored as deltas from that estimate in a Fenwick tree.
 */
class DynamicHeightModel implements ItemHeightModel {
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
      const mid = Math.floor((low + high) / 2);
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

/** Prefix-sum tree used to query measured-height deltas in O(log n). */
class FenwickTree {
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

/** Keyed cache of row entries, separated so cleanup bookkeeping is explicit. */
class VirtualListEntryMap<T> {
  entriesMap = new Map<string, VirtualListEntry<T>>();
  keys = new Set<string>();

  get(k: string) {
    return this.entriesMap.get(k);
  }

  set(k: string, entry: VirtualListEntry<T>) {
    this.entriesMap.set(k, entry);
    this.keys.add(k);
  }

  delete(k: string) {
    const e = this.entriesMap.get(k);
    if (e) {
      this.entriesMap.delete(k);
      this.keys.delete(k);
    }
  }
}

/** Holds a row's render output, wrapper, index signal, and last measured size. */
class VirtualListEntry<T> {
  element?: GetElement;
  wrapper?: HTMLDivElement;
  bucketIndex?: number;
  indexSignal;
  lastHeight = 0;

  constructor(
    public readonly renderFn: (
      value: T,
      index: ReadonlySignal<number>,
    ) => GetElement,
    public readonly key: string,
    public item: T,
    public index: number,
  ) {
    this.indexSignal = sig(index);
  }

  update(item: T, index: number) {
    if (this.item !== item) {
      this.element = undefined;
      this.item = item;
    }

    if (this.index !== index) {
      this.index = index;
      this.indexSignal.dispatch(index);
    }
  }

  /**
   * Creates a controlled wrapper around user content. The flow-root wrapper
   * contains user margins so ResizeObserver measures the full row footprint.
   */
  renderWrapper() {
    const wrapper = this.wrapper ?? document.createElement("div");
    wrapper.style.display = "flow-root";
    wrapper.style.flexShrink = "0";
    wrapper.style.contain = "layout style paint";

    if (this.wrapper == null) {
      this.wrapper = wrapper;
    }

    const elem = this.render();
    if (!elem.isConnected || elem.parentNode !== wrapper) {
      wrapper.replaceChildren(elem);
    }

    return wrapper;
  }

  /** Lazily renders user content while preserving the stable index signal. */
  render() {
    if (this.element != null) {
      return this.element;
    }

    const elem = this.renderFn(this.item, this.indexSignal);
    this.element = elem;
    return elem;
  }
}
