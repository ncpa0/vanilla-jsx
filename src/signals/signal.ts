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

export type DerivableSignal<T> = Signal<T> | ReadonlySignal<T>;

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

type BatchQueue = InstanceType<typeof VSignal["BatchQueue"]>;

type BatchEntry = [signal: VSignal<any>, isObserved: boolean];

/**
 * Class containing the actual implementation of the VanillaJSX Signal.
 */
class VSignal<T> implements Signal<T> {
  private static BatchQueue = class BatchQueue {
    private orderedQueue: Array<BatchEntry> = [];
    private roots: Map<VSignal<any>, any> = new Map();

    public add(s: VSignal<any>, isObserved: boolean) {
      s.batchEntry = [s, isObserved];
      this.orderedQueue.push(s.batchEntry);
    }

    public addRoot(s: VSignal<any>, newValue: any) {
      this.roots.set(s, newValue);
    }

    public commit() {
      for (const [signal, newValue] of this.roots) {
        signal.value = newValue;
        signal.batchEntry = undefined;
      }
      /**
       * first element in the queue is always the leaf node and each subsequent
       * element is higher in the tree, therefore we iterate in reverse order
       * in order to always have derived signals updated after all their parent
       * get updated first.
       */
      for (let i = this.orderedQueue.length - 1; i >= 0; i--) {
        const [signal, isObserved] = this.orderedQueue[i]!;
        if (!isObserved) {
          signal.isDirty = true;
        } else {
          signal.update();
          signal.notifyListeners();
        }
        signal.batchEntry = undefined;
      }
      this.orderedQueue.splice(0, this.orderedQueue.length);
    }
  };

  private static batchQueue?: BatchQueue;

  public static startBatch() {
    VSignal.batchQueue = new VSignal.BatchQueue();
  }

  public static commitBatch() {
    if (VSignal.batchQueue) {
      VSignal.batchQueue.commit();
      VSignal.batchQueue = undefined;
    }
  }

  public static derive<E, U>(
    sig1: DerivableSignal<E>,
    getDerivedValue: (v1: E) => U,
  ): VReadonlySignal<U>;
  public static derive<E, F, U>(
    sig1: DerivableSignal<E>,
    sig2: DerivableSignal<F>,
    getDerivedValue: (v1: E, v2: F) => U,
  ): VReadonlySignal<U>;
  public static derive<E, F, G, U>(
    sig1: DerivableSignal<E>,
    sig2: DerivableSignal<F>,
    sig3: DerivableSignal<G>,
    getDerivedValue: (v1: E, v2: F, v3: G) => U,
  ): VReadonlySignal<U>;
  public static derive<E, F, G, H, U>(
    sig1: DerivableSignal<E>,
    sig2: DerivableSignal<F>,
    sig3: DerivableSignal<G>,
    sig4: DerivableSignal<H>,
    getDerivedValue: (v1: E, v2: F, v3: G, v4: H) => U,
  ): VReadonlySignal<U>;
  public static derive<E, F, G, H, I, U>(
    sig1: DerivableSignal<E>,
    sig2: DerivableSignal<F>,
    sig3: DerivableSignal<G>,
    sig4: DerivableSignal<H>,
    sig5: DerivableSignal<I>,
    getDerivedValue: (v1: E, v2: F, v3: G, v4: H, v5: I) => U,
  ): VReadonlySignal<U>;
  public static derive<E, F, G, H, I, J, U>(
    sig1: DerivableSignal<E>,
    sig2: DerivableSignal<F>,
    sig3: DerivableSignal<G>,
    sig4: DerivableSignal<H>,
    sig5: DerivableSignal<I>,
    sig6: DerivableSignal<J>,
    getDerivedValue: (v1: E, v2: F, v3: G, v4: H, v5: I, v6: J) => U,
  ): VReadonlySignal<U>;
  public static derive<U>(...args: any[]): VReadonlySignal<U> {
    const signals = args.slice(0, -1) as VSignal<any>[];
    const getDerivedValue = args[args.length - 1] as (...args: any[]) => U;
    const deriveFn = () => getDerivedValue(...signals.map((s) => s.current()));

    const derivedSignal = new VReadonlySignal(deriveFn());
    derivedSignal.deriveFn = deriveFn;
    derivedSignal.derivedFrom = signals;

    signals.forEach((s) => s.derivedSignals.push(new WeakRef(derivedSignal)));

    return derivedSignal;
  }

  private listeners: SignalListener<T>[] = [];
  private derivedSignals: WeakRef<VSignal<any>>[] = [];
  private value: T;
  private deriveFn?: () => T;
  private derivedFrom: VSignal<any>[] = [];
  private isDirty = false;

  constructor(value: T) {
    this.value = value;
  }

  /**
   * Removes the child signal from the list of derived signals.
   * (should be called by the child to inform the parent
   * that it doesn't need to be updated anymore)
   */
  private removeDerivedChild(signal: VSignal<any>) {
    this.derivedSignals = this.derivedSignals.filter((ref) => {
      const s = ref.deref();
      return s != null && s !== signal;
    });
  }

  private update() {
    if (this.deriveFn) {
      const v = this.deriveFn!();
      this.isDirty = false;
      if (Object.is(v, this.value)) {
        return;
      }
      this.value = v;
    }
  }

  private updateAndPropagate() {
    this.update();
    this.propagateChange();
  }

  /**
   * Destroys this derived signal if all of its parents were destroyed.
   * (should be called by the parent to inform the child
   * that it will never dispatch any changes)
   */
  private destroyDerived(from: VSignal<any>) {
    this.derivedFrom = this.derivedFrom.filter((s) => s !== from);

    if (this.derivedFrom.length === 0) {
      this.destroy();
    }
  }

  private notifyListeners() {
    for (let i = 0; i < this.listeners.length; i++) {
      attempt(() => this.listeners[i]!(this.value));
    }
  }

  private notifyChildren() {
    for (let i = 0; i < this.derivedSignals.length; i++) {
      const sig = this.derivedSignals[i]!.deref();
      if (sig) {
        if (sig.listeners.length === 0) {
          sig.isDirty = true;
          sig.notifyChildren();
        } else {
          sig.updateAndPropagate();
        }
      } else {
        this.derivedSignals.splice(i, 1);
        i--;
      }
    }
  }

  private propagateChange() {
    this.notifyListeners();
    this.notifyChildren();
  }

  public add(listener: SignalListener<T>): SignalListenerReference<T> {
    if (this.isDirty) {
      this.update();
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

  private batchEntry?: BatchEntry;
  private addToBatch(batchQueue: BatchQueue): boolean {
    let isObserved = this.listeners.length > 0;

    if (this.batchEntry) {
      return this.batchEntry[1];
    }

    for (let i = 0; i < this.derivedSignals.length; i++) {
      const sig = this.derivedSignals[i]!.deref();
      if (sig) {
        const cisObs = sig.addToBatch(batchQueue);
        isObserved ||= cisObs;
      } else {
        this.derivedSignals.splice(i, 1);
        i--;
      }
    }

    batchQueue.add(this, isObserved);
    return isObserved;
  }

  private dispatchBatched(value: T | DispatchFunc<T>, batchQueue: BatchQueue): void {
    const prevValue = this.value;
    let newValue: T;
    if (isDispatchFunc(value)) {
      newValue = value(this.value);
    } else {
      newValue = value;
    }

    if (Object.is(prevValue, newValue)) {
      return;
    }

    batchQueue.addRoot(this, newValue);
    this.addToBatch(batchQueue);
  }

  private dispatchEager(value: T | DispatchFunc<T>): void {
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

  public dispatch(value: T | DispatchFunc<T>): void {
    if (VSignal.batchQueue) {
      this.dispatchBatched(value, VSignal.batchQueue);
    } else {
      this.dispatchEager(value);
    }
  }

  public current(): T {
    if (this.isDirty) {
      this.update();
    }
    return this.value;
  }

  public detachAll(): void {
    this.listeners = [];
  }

  public listenerCount(): number {
    return this.listeners.length;
  }

  public derive<U>(getDerivedValue: (current: T) => U): VReadonlySignal<U> {
    if (this.isDirty) {
      this.update();
    }

    const derivedSignal = new VReadonlySignal(getDerivedValue(this.value));
    derivedSignal.deriveFn = () => getDerivedValue(this.current());
    derivedSignal.derivedFrom = [this];

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

/**
 * Class containing the actual implementation of the VanillaJSX ReadonlySignal.
 */
class VReadonlySignal<T> extends VSignal<T> {
  public dispatch(_: T | DispatchFunc<T>): void {
    throw new Error("Signal.dispatch(): cannot dispatch on a derived signal");
  }
}

interface SignalConstructor {
  <T>(value: T): Signal<T>;
  derive: typeof VSignal.derive;
  startBatch(): void;
  commitBatch(): void;
}

/**
 * Create a new signal with the given initial value.
 *
 * `<T>(value: T): Signal<T>;`
 */
const signal: SignalConstructor = function signal<T>(value: T): Signal<T> {
  return new VSignal(value);
};
signal.derive = VSignal.derive;
signal.startBatch = VSignal.startBatch;
signal.commitBatch = VSignal.commitBatch;

/**
 * Alias for `signal()`.
 */
const sig = signal;

export { VReadonlySignal, VSignal, sig, signal };

