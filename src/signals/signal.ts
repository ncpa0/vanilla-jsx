export type DispatchFunc<T> = (current: T) => T;
export type SignalListener<T> = (value: T) => void;
export type SignalListenerReference<T> = {
  /**
   * Detach the listener from the signal.
   */
  detach(): void;
  /**
   * The listener that was attached to the signal.
   */
  listener: SignalListener<T>;
  /**
   * The signal that the listener was attached to.
   */
  signal: Signal<T>;
};

export interface ReadonlySignal<T> {
  /**
   * Add a listener to the signal. The listener will be called immediately with
   * the current value, and on every subsequent dispatch, until the listener is
   * detached.
   */
  add(listener: SignalListener<T>): SignalListenerReference<T>;
  /**
   * Get the current value of the signal.
   */
  current(): T;
  /**
   * Get the number of listeners attached to the signal.
   */
  listenerCount(): number;
  /**
   * Create a new readonly signal that derives its value from this signal.
   */
  derive<U>(getDerivedValue: (current: T) => U): ReadonlySignal<U>;
  /**
   * Detach all listeners from the signal.
   */
  detachAll(): void;
  /**
   * Completely destroy the signal. This will detach all listeners, destroy
   * all derived signals, prevent any new listeners from being added, and
   * prevent any new dispatches from being made.
   */
  destroy(): void;
}

export interface Signal<T> extends ReadonlySignal<T> {
  /**
   * Updates the value of the signal, and if the value has changed notifies
   * all listeners and derived signals.
   */
  dispatch(value: T | DispatchFunc<T>): void;
}

function isDispatchFunc<T>(value: T | DispatchFunc<T>): value is DispatchFunc<T> {
  return typeof value === "function";
}

function attempt(fn: () => void) {
  try {
    fn();
  } catch (e) {
    console.error(e);
  }
}

class VanillaJsxSignal<T> implements Signal<T> {
  private listeners: SignalListener<T>[] = [];
  private derivedSignals: VanillaJsxSignal<any>[] = [];
  private value: T;
  private deriveFn?: (current: any) => T;
  private derivedFrom?: VanillaJsxSignal<any>;

  constructor(value: T) {
    this.value = value;
  }

  private removeDerived(signal: VanillaJsxSignal<any>) {
    this.derivedSignals = this.derivedSignals.filter((s) => s !== signal);
  }

  private propagateChange() {
    for (let i = 0; i < this.listeners.length; i++) {
      attempt(() => this.listeners[i]!(this.value));
    }

    for (let i = 0; i < this.derivedSignals.length; i++) {
      const sig = this.derivedSignals[i]!;
      attempt(() => {
        const v = sig.deriveFn!(this.value);
        sig.value = v;
        sig.propagateChange();
      });
    }
  }

  private add_destroyed(_: SignalListener<T>): never {
    throw new Error("Signal.add(): cannot add listeners to a destroyed signal");
  }

  private dispatch_destroyed(_: T | DispatchFunc<T>): never {
    throw new Error("Signal.dispatch(): cannot dispatch on a destroyed signal");
  }

  private derive_destroyed(_: (current: any) => any): never {
    throw new Error("Signal.derive(): cannot derive from a destroyed signal");
  }

  private dispatch_derived(_: T | DispatchFunc<T>): void {
    throw new Error("Signal.dispatch(): cannot dispatch on a derived signal");
  }

  public add(listener: SignalListener<T>): SignalListenerReference<T> {
    if (typeof listener !== "function") {
      throw new Error("Signal.add(): listener must be a function");
    }

    this.listeners.push(listener);

    attempt(() => {
      listener(this.value);
    });

    let isDetached = false;
    return {
      signal: this,
      listener,
      detach: () => {
        if (isDetached) {
          return;
        }
        this.listeners = this.listeners.filter((l) => l !== listener);
        isDetached = true;
      },
    };
  }

  public dispatch(value: T | DispatchFunc<T>): void {
    const prevValue = this.value;
    if (isDispatchFunc(value)) {
      this.value = value(this.value);
    } else {
      this.value = value;
    }

    if (!Object.is(prevValue, this.value)) {
      this.propagateChange();
    }
  }

  public current(): T {
    return this.value;
  }

  public detachAll(): void {
    this.listeners = [];
  }

  public listenerCount(): number {
    return this.listeners.length;
  }

  public derive<U>(getDerivedValue: (current: T) => U): ReadonlySignal<U> {
    const derivedSignal = new VanillaJsxSignal(getDerivedValue(this.value));
    derivedSignal.deriveFn = getDerivedValue;
    derivedSignal.derivedFrom = this;
    derivedSignal.dispatch = derivedSignal.dispatch_derived;

    this.derivedSignals.push(derivedSignal);
    return derivedSignal;
  }

  public destroy(): void {
    this.detachAll();
    this.derivedFrom?.removeDerived(this);
    this.deriveFn = undefined;
    this.derivedFrom = undefined;
    this.add = this.add_destroyed;
    this.dispatch = this.dispatch_destroyed;
    this.derive = this.derive_destroyed;
    this.derivedSignals.forEach((s) => s.destroy());
    this.derivedSignals = [];
  }
}

/**
 * Create a new signal with the given initial value.
 */
export function signal<T>(value: T): Signal<T> {
  return new VanillaJsxSignal(value);
}

/**
 * Alias for `signal()`.
 */
export const sig = signal;
