export type DispatchFunc<T> = (current: T) => T;
export type SignalListener<T> = (value: T) => void;
export type SignalListenerReference<T> = Readonly<{
  /**
   * Detach the listener from the signal.
   */
  detach(): void;
  /**
   * The listener that was attached to the signal.
   */
  callback: SignalListener<T>;
  /**
   * The signal that the listener was attached to.
   */
  signal: Signal<T>;
}>;

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

const GlobalListeners = new Set<SignalListenerReference<any>>();

class QueuedUpdate {
  private static allQueuedCount: VanillaJsxSignal<number>;

  public static init() {
    QueuedUpdate.allQueuedCount = new VanillaJsxSignal(0);
  }

  public static flush() {
    return new Promise<void>((resolve) => {
      if (QueuedUpdate.allQueuedCount.current() === 0) {
        resolve();
        return;
      }

      const listener = QueuedUpdate.allQueuedCount.add(c => {
        if (c === 0) {
          resolve();
          listener.detach();
        }
        return c;
      });
    });
  }

  private aborted = false;

  constructor(private readonly update: () => void) {
    QueuedUpdate.allQueuedCount.dispatch((c) => c + 1);
    queueMicrotask(() => {
      if (this.aborted) {
        return;
      }

      this.update();
      QueuedUpdate.allQueuedCount.dispatch((c) => c - 1);
    });
  }

  abort() {
    this.aborted = true;
    QueuedUpdate.allQueuedCount.dispatch((c) => c - 1);
  }
}

class VanillaJsxSignal<T> implements Signal<T> {
  private static autoBatching = false;

  static setAutoBatchingEnabled(enabled: boolean) {
    VanillaJsxSignal.autoBatching = enabled;
  }

  public static derive<U>(...args: any[]): ReadonlySignal<U> {
    const signals = args.slice(0, -1) as VanillaJsxSignal<any>[];
    const getDerivedValue = args[args.length - 1] as (...args: any[]) => U;

    const derivedSignal = new VanillaJsxReadonlySignal(getDerivedValue(...signals.map((s) => s.value)));
    derivedSignal.deriveFn = getDerivedValue;
    derivedSignal.derivedFrom = signals;

    for (let i = 0; i < signals.length; i++) {
      const s = signals[i]!;
      s.derivedSignals.push(new WeakRef(derivedSignal));
    }

    return derivedSignal;
  }

  private listeners: SignalListenerReference<T>[] = [];
  private derivedSignals: WeakRef<VanillaJsxSignal<any>>[] = [];
  private value: T;
  private deriveFn?: (...v: any[]) => T;
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

  private queueUpdate() {
    if (this.queuedUpdate) {
      return;
    }
    this.queuedUpdate = new QueuedUpdate(() => {
      this.queuedUpdate = undefined;
      this.updateDerivedUnsafe();
    });
    this.propagateQueuedChange();
  }

  private updateDerivedUnsafe() {
    const v = this.deriveFn!(...this.derivedFrom.map((s) => s.value));
    this.derivedIsOutOfDate = false;
    if (Object.is(v, this.value)) {
      return;
    }
    this.value = v;
    this.propagateChange();
  }

  private queuedUpdate?: QueuedUpdate;
  private updateDerived() {
    this.updateDerivedUnsafe();
    // if (VanillaJsxSignal.autoBatching) {
    //   if (this.queuedUpdate) {
    //     return;
    //   }
    //   this.queueUpdate();
    // } else {
    // }
  }

  private beforeAccess() {
    if (this.derivedIsOutOfDate) {
      if (this.queuedUpdate) {
        this.queuedUpdate.abort();
        this.queuedUpdate = undefined;
      }
      this.updateDerivedUnsafe();
    }
  }

  private destroyedParents = 0;
  /**
   * Destroys this derived signal if all of its parents were destroyed.
   * (should be called by the parent to inform the child
   * that it will never dispatch any changes)
   */
  private destroyDerived(from: VanillaJsxSignal<any>) {
    this.destroyedParents++;
    // this.derivedFrom = this.derivedFrom.map((s) => s === from ? {} : s);

    if (this.derivedFrom.length === this.destroyedParents) {
      this.destroy();
    }
  }

  private propagateChange() {
    for (let i = 0; i < this.listeners.length; i++) {
      attempt(() => this.listeners[i]!.callback(this.value));
    }

    if (VanillaJsxSignal.autoBatching) {
      for (let i = 0; i < this.derivedSignals.length; i++) {
        const sig = this.derivedSignals[i]!.deref()!;
        sig.queueUpdate();
      }
    } else {
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
  }

  private propagateQueuedChange() {
    for (let i = 0; i < this.derivedSignals.length; i++) {
      const sig = this.derivedSignals[i]!.deref();
      if (sig) {
        if (sig.listeners.length === 0 && sig.derivedSignals.length === 0) {
          sig.derivedIsOutOfDate = true;
          return;
        }
        sig.queueUpdate();
      } else {
        this.derivedSignals.splice(i, 1);
        i--;
      }
    }
  }

  public add(listener: SignalListener<T>): SignalListenerReference<T> {
    this.beforeAccess();

    if (typeof listener !== "function") {
      throw new Error("Signal.add(): listener must be a function");
    }

    let isDetached = false;
    const lRef: SignalListenerReference<T> = Object.freeze({
      signal: this,
      callback: listener,
      detach: () => {
        if (isDetached) {
          return;
        }
        const idx = this.listeners.findIndex((l) => l === lRef);
        this.listeners.splice(idx, 1);
        GlobalListeners.delete(lRef);
        isDetached = true;
      },
    });

    this.listeners.push(lRef);
    GlobalListeners.add(lRef);

    attempt(() => {
      listener(this.value);
    });

    return lRef;
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
    this.beforeAccess();
    return this.value;
  }

  public detachAll(): void {
    for (let i = this.listeners.length - 1; i >= 0; i--) {
      this.listeners[i]!.detach();
    }
  }

  public listenerCount(): number {
    return this.listeners.length;
  }

  public derive<U>(getDerivedValue: (current: T) => U): ReadonlySignal<U> {
    this.beforeAccess();

    const derivedSignal = new VanillaJsxReadonlySignal(getDerivedValue(this.value));
    derivedSignal.deriveFn = getDerivedValue;
    derivedSignal.derivedFrom = [this];

    this.derivedSignals.push(new WeakRef(derivedSignal));
    return derivedSignal;
  }

  public destroy(): void {
    this.detachAll();
    for (let i = 0; i < this.derivedFrom.length; i++) {
      const s = this.derivedFrom[i]!;
      s.removeDerivedChild(this);
    }
    this.deriveFn = undefined;
    this.derivedFrom = [];
    this.add = this.add_destroyed;
    this.dispatch = this.dispatch_destroyed;
    this.derive = this.derive_destroyed;
    for (let i = 0; i < this.derivedSignals.length; i++) {
      const s = this.derivedSignals[i]!;
      s.deref()?.destroyDerived(this);
    }
    this.derivedSignals = [];
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
}

class VanillaJsxReadonlySignal<T> extends VanillaJsxSignal<T> {
  public dispatch(_: T | DispatchFunc<T>): void {
    throw new Error("Signal.dispatch(): cannot dispatch on a derived signal");
  }
}

QueuedUpdate.init();

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
  return VanillaJsxSignal.derive(...args);
}

export function setAutoBatchingEnabled(enabled: boolean) {
  VanillaJsxSignal.setAutoBatchingEnabled(enabled);
}

export function flushBatch() {
  return QueuedUpdate.flush();
}
