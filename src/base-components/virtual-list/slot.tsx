import { GetElement } from "../../reconciler/reconciler";
import { ReadonlySignal, sig } from "../../signals/signal";

/**
 * A recycled row slot. The wrapper and the user-rendered element are created
 * exactly once and then reused for many different data items over the lifetime
 * of the list. Only the `data` and `index` signals are dispatched when the slot
 * is reassigned, so the user's render tree stays mounted and reactive.
 */
export class Slot<T> {
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
