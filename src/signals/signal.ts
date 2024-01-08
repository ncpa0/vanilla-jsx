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
  private derivedSignals: WeakRef<VanillaJsxSignal<any>>[] = [];
  private value: T;
  private deriveFn?: () => T;
  private derivedFrom: VanillaJsxSignal<any>[] = [];
  private derivedIsOutOfDate = false;

  constructor(value: T) {
    this.value = value;
  }

  /**
   * Removes the child signal from the list of derived signals.
   * (should be called by the child to inform the parent
   * that it doesn't need to be updated anymore)
   */
  private removeDerivedChild(signal: VanillaJsxSignal<any>) {
    this.derivedSignals = this.derivedSignals.filter((ref) => {
      const s = ref.deref();
      return s != null && s !== signal;
    });
  }

  private updateDerived() {
    const v = this.deriveFn!();
    this.derivedIsOutOfDate = false;
    if (Object.is(v, this.value)) {
      return;
    }
    this.value = v;
    this.propagateChange();
  }

  /**
   * Destroys this derived signal if all of its parents were destroyed.
   * (should be called by the parent to inform the child
   * that it will never dispatch any changes)
   */
  private destroyDerived(from: VanillaJsxSignal<any>) {
    this.derivedFrom = this.derivedFrom.filter((s) => s !== from);

    if (this.derivedFrom.length === 0) {
      this.destroy();
    }
  }

  private propagateChange() {
    for (let i = 0; i < this.listeners.length; i++) {
      attempt(() => this.listeners[i]!(this.value));
    }

    for (let i = 0; i < this.derivedSignals.length; i++) {
      const sig = this.derivedSignals[i]!.deref();
      if (sig) {
        attempt(() => {
          if (sig.listeners.length === 0 && sig.derivedSignals.length === 0) {
            sig.derivedIsOutOfDate = true;
            return;
          }
          sig.updateDerived();
        });
      } else {
        this.derivedSignals.splice(i, 1);
        i--;
      }
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
    if (this.derivedIsOutOfDate) {
      this.updateDerived();
    }

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
    if (this.derivedIsOutOfDate) {
      this.updateDerived();
    }
    return this.value;
  }

  public detachAll(): void {
    this.listeners = [];
  }

  public listenerCount(): number {
    return this.listeners.length;
  }

  public derive<U>(getDerivedValue: (current: T) => U): ReadonlySignal<U> {
    if (this.derivedIsOutOfDate) {
      this.updateDerived();
    }

    const derivedSignal = new VanillaJsxSignal(getDerivedValue(this.value));
    derivedSignal.deriveFn = () => getDerivedValue(this.value);
    derivedSignal.derivedFrom = [this];
    derivedSignal.dispatch = derivedSignal.dispatch_derived;

    this.derivedSignals.push(new WeakRef(derivedSignal));
    return derivedSignal;
  }

  public destroy(): void {
    this.detachAll();
    this.derivedFrom.forEach((s) => s.removeDerivedChild(this));
    this.deriveFn = undefined;
    this.derivedFrom = [];
    this.add = this.add_destroyed;
    this.dispatch = this.dispatch_destroyed;
    this.derive = this.derive_destroyed;
    this.derivedSignals.forEach((s) => s.deref()?.destroyDerived(this));
    this.derivedSignals = [];
  }

  public static deriveMany<U>(...args: any[]): ReadonlySignal<U> {
    const signals = args.slice(0, -1) as VanillaJsxSignal<any>[];
    const getDerivedValue = args[args.length - 1] as (...args: any[]) => U;
    const deriveFn = () => getDerivedValue(...signals.map((s) => s.value));

    const derivedSignal = new VanillaJsxSignal(deriveFn());
    derivedSignal.deriveFn = deriveFn;
    derivedSignal.derivedFrom = signals;
    derivedSignal.dispatch = derivedSignal.dispatch_derived;

    signals.forEach((s) => s.derivedSignals.push(new WeakRef(derivedSignal)));

    return derivedSignal;
  }
}

export type { VanillaJsxSignal };

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

export type DerivableSignal<T> = Signal<T> | ReadonlySignal<T>;

export function deriveMany<E, U>(sig: DerivableSignal<E>, getDerivedValue: (v: E) => U): ReadonlySignal<U>;
export function deriveMany<E, F, U>(
  sig1: DerivableSignal<E>,
  sig2: DerivableSignal<F>,
  getDerivedValue: (v1: E, v2: F) => U,
): ReadonlySignal<U>;
export function deriveMany<E, F, G, U>(
  sig1: DerivableSignal<E>,
  sig2: DerivableSignal<F>,
  sig3: DerivableSignal<G>,
  getDerivedValue: (v1: E, v2: F, v3: G) => U,
): ReadonlySignal<U>;
export function deriveMany<E, F, G, H, U>(
  sig1: DerivableSignal<E>,
  sig2: DerivableSignal<F>,
  sig3: DerivableSignal<G>,
  sig4: DerivableSignal<H>,
  getDerivedValue: (v1: E, v2: F, v3: G, v4: H) => U,
): ReadonlySignal<U>;
export function deriveMany<E, F, G, H, I, U>(
  sig1: DerivableSignal<E>,
  sig2: DerivableSignal<F>,
  sig3: DerivableSignal<G>,
  sig4: DerivableSignal<H>,
  sig5: DerivableSignal<I>,
  getDerivedValue: (v1: E, v2: F, v3: G, v4: H, v5: I) => U,
): ReadonlySignal<U>;
export function deriveMany<U>(...args: any[]): ReadonlySignal<U> {
  return VanillaJsxSignal.deriveMany(...args);
}
