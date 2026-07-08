import { ClassComponent } from "../class-component";
import { StyleDict, WithSignals } from "../jsx-namespace/jsx.types";
import { ClassComponentInit, GetElement, jsx } from "../reconciler/reconciler";
import { bindSignal } from "../sig-proxy/_proxy";
import { type ReadonlySignal, sig } from "../signals/signal";
import throttle from "../utils";

export type VirtualListProps<T> = {
  data: JSX.Signal<readonly T[]>;
  /**
   * Don't add the default class name to the parent element.
   * (`vjsx-virt-list-container`)
   */
  noclass?: boolean;
  /**
   * A function that will return the HTML element for each value in the data
   * list provided.
   *
   * The element is created exactly once per visible slot. When the slot is
   * recycled to display a different item, only the `value` and `index` signals
   * are dispatched - the element itself is never recreated.
   */
  render: (
    value: ReadonlySignal<T>,
    index: ReadonlySignal<number>,
  ) => GetElement;
  renderEmpty?: () => GetElement;
  getKey: (value: T) => string;
  containerProps?: Omit<JSX.IntrinsicElements["div"], "style" | "children"> & {
    style?: WithSignals<StyleDict>;
  };
  /** Number of items to render initially. */
  initialRender?: number;
  /** Number of items per page. Range boundaries are aligned to this value. */
  pageSize?: number;
  /**
   * Minimum amount of scrolled pixels to trigger the recalculate of the visible pages.
   *
   * Defaults to a 1/4 of max(overscanTrailing, overscanLeading)
   */
  bailThreshold?: number;
  /** (in pixels) Determines when to add the next page. Default: 1000px */
  threshold?: number;
  /** Initial height estimate for dynamic-height items. Ignored when itemHeight is set. */
  estimateItemHeight?: number;
  /** Overscan for items before the viewport in the scroll direction (behind). Defaults to threshold. */
  overscanTrailing?: number;
  /** Overscan for items after the viewport in the scroll direction (ahead). Defaults to threshold. */
  overscanLeading?: number;
  /** Default: 32 (ms) */
  scrollThrottle?: number;
  /**
   * Height of a single item in pixels (only set if known and guaranteed ahead of time). Used to determine
   * the the amount of margin needed to be added to keep the scroll view height the same regardless
   * which items are rendered or not before the actual height is known.
   *
   * If height is dynamic but always the same for all rows set to `homogeneous`.
   */
  itemHeight?: number | "homogeneous";
  onscroll?: (ev: Event, topPos: number) => void;
  initialScroll?: number;
};

export class VirtualList<T> extends ClassComponent<VirtualListProps<T>> {
  private list!: HTMLDivElement & { VirtualList: VirtualList<T> };
  /**
   * Strategy object for all height math. Fixed-height lists use direct O(1)
   * arithmetic, dynamic lists use an estimate plus measured deltas.
   */
  private heightModel: ItemHeightModel;
  /**
   * Lightweight measurement cache that survives slot recycling. This lets a
   * row regain its known height when it is recycled back into an item that was
   * measured before.
   */
  private heightByKey = new Map<string, number>();
  private resizeObserver?: ResizeObserver;
  /** Latest ResizeObserver heights waiting for the next animation-frame commit. */
  private pendingResizeHeights = new Map<Element, number>();
  private resizeCommitScheduled = false;
  /** Maps row wrappers back to their owning slot for ResizeObserver callbacks. */
  private slotByElement = new WeakMap<Element, Slot<T>>();
  private recalcScheduled = false;
  private lastBounds?: [number, number];

  /**
   * The active pool of recycled slots. Slots are never destroyed while
   * scrolling - they are reassigned to new indices and have their `value` and
   * `index` signals dispatched instead. The pool only shrinks when the visible
   * window shrinks (e.g. data length decreased or viewport grew smaller).
   */
  private slots: Slot<T>[] = [];
  private isEmpty = false;

  private topSpacer = document.createElement("div");
  private bottomSpacer = document.createElement("div");

  /** Current render window [start, end] inclusive, page-aligned. */
  private range: [number, number] = [0, -1];
  /**
   * Last observed scroll direction: `1` for downward, `-1` for upward, `0`
   * until the first scroll. Used to swap which overscan prop applies to the
   * leading vs. trailing edge of the viewport.
   */
  private scrollDirection = 0;
  /** Last observed `scrollTop`, used to derive scroll direction. */
  private lastScrollTop = 0;

  constructor(props: VirtualListProps<T>, init: ClassComponentInit) {
    super(props, init);

    this.heightModel = this.createHeightModel(props.data.get());

    this.range = [0, (props.initialRender ?? this.pageSize) - 1];
  }

  private get pageSize() {
    return Math.max(2, this.props.pageSize ?? 32);
  }

  private get fixedItemHeight() {
    return this.props.itemHeight != null
        && typeof this.props.itemHeight === "number"
        && this.props.itemHeight > 0
      ? this.props.itemHeight
      : undefined;
  }

  private get initialEstimatedHeight() {
    return Math.max(
      1,
      this.fixedItemHeight ?? this.props.estimateItemHeight ?? 32,
    );
  }

  private get overscanTrailing() {
    return this.props.overscanTrailing ?? this.props.threshold ?? 1000;
  }

  private get overscanLeading() {
    return this.props.overscanLeading ?? this.props.threshold ?? 1000;
  }

  private keyFor(item: T) {
    return this.props.getKey(item);
  }

  private createHeightModel(data = this.props.data.get()): ItemHeightModel {
    if (this.fixedItemHeight != null) {
      return new FixedHeightModel(data.length, this.fixedItemHeight);
    }

    const measured = this.getMeasuredHeights(data);
    const previousEstimate = this.heightModel?.estimatedHeight;

    if (this.props.itemHeight === "homogeneous") {
      return new DynamicHomogeneousHeightModel({
        count: data.length,
        estimatedHeight: previousEstimate ?? this.initialEstimatedHeight,
        measured,
      });
    }

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

  /** Applies current virtual padding and flex ordering to the spacer elements. */
  private syncSpacers() {
    const [start, end] = this.range;
    this.topSpacer.style.height = this.heightModel.offsetOf(start) + "px";
    this.bottomSpacer.style.height = this.heightModel.tailHeightAfter(end)
      + "px";
    this.topSpacer.style.order = "0";
    this.bottomSpacer.style.order = String(this.heightModel.count + 1);
  }

  private bailThreshold() {
    return Math.max(
      16,
      this.props.bailThreshold
        ?? Math.max(this.overscanTrailing, this.overscanLeading) / 4,
    );
  }

  /** Calculates the render window from scroll bounds and current height model. */
  private recalculateRange(force = false) {
    const data = this.props.data.get();
    this.heightModel.setCount(data.length);

    if (data.length === 0) {
      this.range = [0, -1];
      this.reconcileRange();
      return;
    }

    // While row heights are unknown, only render the initial batch so the
    // ResizeObserver can measure it. Scroll-driven recalcs are ignored entirely
    // until a measurement lands; forced recalcs (initial mount, data change)
    // are clamped to the initial batch instead of extrapolating from the
    // default estimate, which would inflate the slot pool far beyond the
    // steady-state window.
    if (!this.fixedItemHeight && !this.heightModel.hasMeasuredEstimate) {
      if (!force) {
        return;
      }
      const initialEnd = Math.min(
        data.length - 1,
        (this.props.initialRender ?? this.pageSize) - 1,
      );
      this.range = [0, initialEnd];
      this.reconcileRange();
      return;
    }

    const topBound = this.list.scrollTop;
    const bottomBound = topBound + this.list.clientHeight;

    // Direction defaults to "down" (>= 0) before the first scroll, so the
    // initial window uses overscanBefore for the top and overscanAfter for the
    // bottom. Once the user scrolls, the leading edge (in the direction of
    // travel) gets overscanAfter and the trailing edge gets overscanBefore.
    const leadingIsBottom = this.scrollDirection >= 0;
    const topOverscan = leadingIsBottom
      ? this.overscanTrailing
      : this.overscanLeading;
    const bottomOverscan = leadingIsBottom
      ? this.overscanLeading
      : this.overscanTrailing;

    const bailThreshold = this.bailThreshold();
    if (
      force === false && this.lastBounds
      && Math.abs(this.lastBounds[0] - topBound) < bailThreshold
      && Math.abs(this.lastBounds[1] - bottomBound) < bailThreshold
    ) {
      return;
    }

    this.lastBounds = [topBound, bottomBound];

    const overscanTop = Math.max(0, topBound - topOverscan);
    const overscanBottom = Math.max(0, bottomBound + bottomOverscan);

    let start = this.heightModel.indexAtOffset(overscanTop);
    let end = this.heightModel.indexAtOffset(overscanBottom);

    start = ((start / this.pageSize) | 0) * this.pageSize;
    end = Math.min(
      data.length - 1,
      Math.ceil((end + 1) / this.pageSize) * this.pageSize,
    );

    if (force || this.range[0] !== start || this.range[1] !== end) {
      this.range = [start, end];
      this.reconcileRange();
    }
  }

  /**
   * Reconciles the current render window with the slot pool. Existing slots
   * whose index is still in range are left in place (their key is refreshed if
   * the underlying data moved). Slots that left the window are recycled into
   * the newly required indices; surplus slots are detached (kept alive for
   * future reuse, never destroyed).
   */
  private reconcileRange() {
    const data = this.props.data.get();
    this.heightModel.setCount(data.length);

    if (data.length === 0) {
      this.renderEmpty();
      return;
    }

    if (this.isEmpty) {
      this.exitEmptyState();
    }

    let [start, end] = this.range;
    end = Math.min(end, data.length - 1);
    if (start > end) {
      start = Math.max(0, Math.min(start, data.length - 1));
      end = start;
    }
    this.range = [start, end];

    // Build the set of indices that must be visible.
    const needed = new Set<number>();
    for (let i = start; i <= end; i++) {
      needed.add(i);
    }

    // Partition existing slots into "still in use" and "free".
    const free: Slot<T>[] = [];
    for (let s = 0; s < this.slots.length; s++) {
      const slot = this.slots[s]!;
      const idx = slot.currentIndex;
      if (idx >= 0 && idx < data.length && needed.has(idx)) {
        needed.delete(idx);
        const item = data[idx]!;
        const key = this.keyFor(item);
        if (key !== slot.currentKey || slot.item !== item) {
          slot.assign(item, idx, key);
        }
        slot.mount(this.list, this.bottomSpacer);
      } else {
        free.push(slot);
      }
    }

    // Recycle free slots into the remaining needed indices, creating new slots
    // only when the pool is exhausted. The pool never shrinks during normal
    // scrolling - surplus slots are merely detached so they can be reused
    // without re-running the user's render function.
    for (const idx of needed) {
      const item = data[idx]!;
      const key = this.keyFor(item);
      const slot = free.pop() ?? this.createSlot(item, idx, key);
      slot.assign(item, idx, key);
      slot.mount(this.list, this.bottomSpacer);
    }

    for (let i = 0; i < free.length; i++) {
      free[i]!.unmount();
    }

    this.syncSpacers();
  }

  private createSlot(item: T, index: number, key: string): Slot<T> {
    const slot = new Slot(this.props.render, item, index, key);
    this.slots.push(slot);
    this.slotByElement.set(slot.wrapper, slot);
    this.resizeObserver?.observe(slot.wrapper);
    return slot;
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

    // Detect the transition out of the "heights unknown" state: the initial
    // batch was clamped to pageSize, so once the first real measurement lands
    // we must force a recalc to expand the window and fill the viewport
    // instead of waiting for the next scroll event.
    const wasUnmeasured = !this.heightModel.hasMeasuredEstimate;

    let changed = false;
    for (const [elem, height] of this.pendingResizeHeights) {
      const slot = this.slotByElement.get(elem);
      if (!slot || height <= 0 || Math.abs(slot.lastHeight - height) < 0.5) {
        continue;
      }

      slot.lastHeight = height;
      if (slot.currentKey) {
        this.heightByKey.set(slot.currentKey, height);
      }
      if (slot.currentIndex >= 0) {
        changed = this.heightModel.setMeasuredHeight(
          slot.currentIndex,
          height,
        ) || changed;
      }
    }

    this.pendingResizeHeights.clear();

    const justMeasured = wasUnmeasured && this.heightModel.hasMeasuredEstimate;
    if (changed || justMeasured) {
      this.syncSpacers();
      this.scheduleRecalculate(true);
    }
  }

  /** Switches the container into the empty-state DOM shape. */
  private renderEmpty() {
    if (this.isEmpty) {
      return;
    }
    this.isEmpty = true;

    // Detach every slot but keep the Slot objects around so they can be reused
    // (without re-running render) when data comes back.
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i]!.unmount();
    }

    this.topSpacer.style.height = "0px";
    this.bottomSpacer.style.height = "0px";

    const emptyElem = this.props.renderEmpty?.();
    if (emptyElem) {
      this.list.replaceChildren(this.topSpacer, emptyElem, this.bottomSpacer);
    } else {
      this.list.replaceChildren(this.topSpacer, this.bottomSpacer);
    }
  }

  /** Restores the spacer-only container shape after leaving the empty state. */
  private exitEmptyState() {
    this.isEmpty = false;
    this.list.replaceChildren(this.topSpacer, this.bottomSpacer);
  }

  /**
   * Returns the pixel offset of the top edge of the item at the given data
   * index, measured from the top of the scrollable content. Uses the current
   * height model (measured where known, estimated otherwise).
   *
   * Out of range indexes return -1
   */
  getItemPosition(idx: number): number {
    const data = this.props.data.get();
    if (idx < 0 || idx >= data.length) {
      return -1;
    }
    return this.heightModel.offsetOf(idx);
  }

  /**
   * Scrolls the list so that the item at the given data index is visible.
   *
   * If the item is already rendered, its wrapper is scrolled into view via
   * the native `scrollIntoView`, which honors `block`/`inline`/`behavior`.
   * If it is outside the rendered window, the container is first jumped to the
   * item's estimated offset and a forced recalc renders it; `scrollIntoView`
   * is then invoked for precise alignment.
   */
  scrollToItem(idx: number, options?: ScrollIntoViewOptions) {
    const data = this.props.data.get();
    if (idx < 0 || idx >= data.length) {
      return;
    }

    const slot = this.findMountedSlot(idx);
    if (slot) {
      slot.wrapper.scrollIntoView(options ?? { block: "start" });
      return;
    }

    // Item is outside the rendered window: jump to its estimated offset first
    // so the forced recalc below renders it.
    this.list.scrollTo({
      top: this.heightModel.offsetOf(idx),
      behavior: options?.behavior,
    });
    this.lastBounds = undefined;
    this.recalculateRange(true);

    const mounted = this.findMountedSlot(idx);
    if (mounted) {
      mounted.wrapper.scrollIntoView(options ?? { block: "start" });
    }
  }

  private findMountedSlot(idx: number): Slot<T> | undefined {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i]!;
      if (slot.currentIndex === idx && slot.wrapper.isConnected) {
        return slot;
      }
    }
    return undefined;
  }

  render() {
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

    if (this.props.noclass !== true) {
      this.list.classList.add("vjsx-virt-list-container");
    }

    const onscroll = throttle(this.props.scrollThrottle ?? 32, () => {
      this.scheduleRecalculate();
    });

    this.list.addEventListener("scroll", (ev) => {
      const prevDir = this.scrollDirection;

      const top = this.list.scrollTop;
      if (top > this.lastScrollTop) {
        this.scrollDirection = 1;
      } else if (top < this.lastScrollTop) {
        this.scrollDirection = -1;
      }

      if (this.scrollDirection != prevDir) {
        this.scheduleRecalculate(true);
      } else {
        onscroll();
      }

      this.lastScrollTop = top;

      this.props.onscroll?.(ev, this.list.scrollTop);
    }, { passive: true });

    queueMicrotask(() => {
      this.recalculateRange(true);
      if (this.props.initialScroll != null) {
        this.list.scrollTop = this.props.initialScroll;
      }
    });

    bindSignal(this.props.data, this.list, (list, data) => {
      this.rebuildHeightModel(data);
      if (list) {
        this.lastBounds = undefined;
        this.recalculateRange(true);
        if (this.props.initialScroll != null) {
          list.scrollTop = this.props.initialScroll;
        }
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

    return Math.min(this.count - 1, (offset / this.estimatedHeight) | 0);
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

/**
 * Height model for dynamic rows where each row is always the same height as all others.
 */
class DynamicHomogeneousHeightModel implements ItemHeightModel {
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

/**
 * A recycled row slot. The wrapper and the user-rendered element are created
 * exactly once and then reused for many different data items over the lifetime
 * of the list. Only the `data` and `index` signals are dispatched when the slot
 * is reassigned, so the user's render tree stays mounted and reactive.
 */
class Slot<T> {
  readonly wrapper: HTMLDivElement;
  readonly element: GetElement;
  readonly dataSignal;
  readonly indexSignal;
  /** The data item currently bound to this slot. */
  item: T;
  currentIndex = -1;
  currentKey = "";
  lastHeight = 0;
  /** Whether the wrapper is currently inserted into the list container. */
  private mounted = false;

  constructor(
    renderFn: (
      value: ReadonlySignal<T>,
      index: ReadonlySignal<number>,
    ) => GetElement,
    item: T,
    index: number,
    key: string,
  ) {
    this.item = item;
    this.dataSignal = sig(item);
    this.indexSignal = sig(index);
    this.currentIndex = index;
    this.currentKey = key;

    this.wrapper = document.createElement("div");
    this.wrapper.style.display = "flow-root";
    this.wrapper.style.flexShrink = "0";
    this.wrapper.style.contain = "layout style paint";
    this.wrapper.style.order = String(index + 1);

    this.element = renderFn(
      this.dataSignal.readonly(),
      this.indexSignal.readonly(),
    );
    this.wrapper.appendChild(this.element);
  }

  /** Inserts the wrapper into the container if it is not already there. */
  mount(container: Node, before: Node) {
    if (this.mounted) {
      return;
    }
    container.insertBefore(this.wrapper, before);
    this.mounted = true;
  }

  /** Removes the wrapper from the DOM without destroying the slot. */
  unmount() {
    if (!this.mounted) {
      return;
    }
    this.wrapper.remove();
    this.mounted = false;
  }

  /** Repoints the slot at a new data item and index, updating visuals via signals. */
  assign(item: T, index: number, key: string) {
    this.currentIndex = index;
    this.currentKey = key;

    if (this.item !== item) {
      this.item = item;
      this.dataSignal.dispatch(item);
    }

    this.indexSignal.dispatch(index);
    this.wrapper.style.order = String(index + 1);
  }
}
