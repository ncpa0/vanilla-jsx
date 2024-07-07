import { registerBoundSignal } from "./utils";

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
  callback: SignalListener<unknown>;
  /**
   * The signal that the listener was attached to.
   */
  signal: ReadonlySignal<T>;
}>;

export interface ReadonlySignal<T> {
  /**
   * Add a listener to the signal. The listener will be called immediately with
   * the current value, and on every subsequent change, until the listener is
   * detached.
   *
   * !!CAUTION!!
   *
   * Be cautious when adding listeners to non-referenced derived signals, as
   * those can get garbage collected and the listener will stop being called.
   *
   * ex. `mySignal.derive((v) => v * 2).add(console.log);`
   *
   * in here a derived signal is created but there's nothing that holds a
   * reference to it, so it will soon get garbage collected. After the derived
   * signal is collected all of it's listeners will disappear along with it.
   * Use the `observe()` instead if you want to keep the signal alive even
   * after losing all references to it.
   */
  add(listener: SignalListener<T>): SignalListenerReference<T>;
  /**
   * Similar to `add()` but additionally ensures that the Signal will not be
   * GC'd as longs as the listener is attached.
   */
  observe(listener: SignalListener<T>): SignalListenerReference<T>;
  /**
   * Get the current value of the signal.
   */
  get(): T;
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
   *
   * @param deep - If true, it will also detach all listeners from
   *  derived signals any levels deep.
   */
  detachListeners(deep?: boolean): void;
  /**
   * Detach all derived signals from this signal.
   *
   * @param deep - If true, it will also detach all derived signals from
   *  derived signals any levels deep.
   */
  detachSinks(deep?: boolean): void;
  /**
   * Detach all listeners and derived signals from this signal.
   */
  detachAll(deep?: boolean): void;
  /**
   * Completely destroy the signal. This will detach all listeners, destroy
   * all derived signals, prevent any new listeners from being added, and
   * prevent any new dispatches from being made.
   */
  destroy(): void;
  /**
   * Return itself.
   */
  readonly(): ReadonlySignal<T>;
}

export interface Signal<T> extends ReadonlySignal<T> {
  /**
   * Updates the value of the signal, and if the value has changed notifies
   * all listeners and derived signals.
   */
  dispatch(value: T | DispatchFunc<T>): void;
  /**
   * Return itself as a readonly signal.
   */
  readonly(): ReadonlySignal<T>;
}

/**
 * Get the type of the value carried by the signal.
 *
 * @example
 * type Result = SignalOf<Signal<number>>; // => number
 */
export type SignalOf<T> = T extends ReadonlySignal<infer U> ? U : T;
/**
 * Create a type that matches either `T or a `ReadonlySignal<T>`.
 *
 * @example
 * type Result = MaybeReadonlySignal<number>; // => number | ReadonlySignal<number>
 */
export type MaybeReadonlySignal<T> = T | ReadonlySignal<T>;
/**
 * Create a type that matches either `T` or a `Signal<T>`.
 *
 * @example
 * type Result = MaybeSignal<number>; // => number | Signal<number>
 */
export type MaybeSignal<T> = T | Signal<T>;
/**
 * Casts to a `ReadonlySignal<T>` if it's not a `ReadonlySignal<T>` already.
 */
export type AsReadonlySignal<T> = T extends ReadonlySignal<infer U>
  ? ReadonlySignal<U>
  : ReadonlySignal<T>;
/**
 * Casts to a `ReadonlySignal<T>` if it's not a `Signal<T>` already.
 */
export type AsSignal<T> = T extends Signal<infer U> ? T
  : T extends ReadonlySignal<infer K> ? ReadonlySignal<K>
  : ReadonlySignal<T>;

type DestroyedParentSigSubstitute = {
  IS_SUBSTITUTE: true;
  get(): any;
  removeDerivedChild(s: VSignal<any>): void;
};

function isDispatchFunc<T>(
  value: T | DispatchFunc<T>,
): value is DispatchFunc<T> {
  return typeof value === "function";
}

function noop() {}

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
        signal.notifyListeners();
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
          const changed = signal.update();
          if (changed) {
            signal.notifyListeners();
          }
        }
        signal.batchEntry = undefined;
      }
      this.orderedQueue.splice(0, this.orderedQueue.length);
    }
  };

  private static GlobalListeners = new Set<SignalListenerReference<any>>();

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
    sig1: ReadonlySignal<E>,
    getDerivedValue: (v1: E) => U,
  ): ReadonlySignal<U>;
  public static derive<E, F, U>(
    sig1: ReadonlySignal<E>,
    sig2: ReadonlySignal<F>,
    getDerivedValue: (v1: E, v2: F) => U,
  ): ReadonlySignal<U>;
  public static derive<E, F, G, U>(
    sig1: ReadonlySignal<E>,
    sig2: ReadonlySignal<F>,
    sig3: ReadonlySignal<G>,
    getDerivedValue: (v1: E, v2: F, v3: G) => U,
  ): ReadonlySignal<U>;
  public static derive<E, F, G, H, U>(
    sig1: ReadonlySignal<E>,
    sig2: ReadonlySignal<F>,
    sig3: ReadonlySignal<G>,
    sig4: ReadonlySignal<H>,
    getDerivedValue: (v1: E, v2: F, v3: G, v4: H) => U,
  ): ReadonlySignal<U>;
  public static derive<E, F, G, H, I, U>(
    sig1: ReadonlySignal<E>,
    sig2: ReadonlySignal<F>,
    sig3: ReadonlySignal<G>,
    sig4: ReadonlySignal<H>,
    sig5: ReadonlySignal<I>,
    getDerivedValue: (v1: E, v2: F, v3: G, v4: H, v5: I) => U,
  ): ReadonlySignal<U>;
  public static derive<E, F, G, H, I, J, U>(
    sig1: ReadonlySignal<E>,
    sig2: ReadonlySignal<F>,
    sig3: ReadonlySignal<G>,
    sig4: ReadonlySignal<H>,
    sig5: ReadonlySignal<I>,
    sig6: ReadonlySignal<J>,
    getDerivedValue: (v1: E, v2: F, v3: G, v4: H, v5: I, v6: J) => U,
  ): ReadonlySignal<U>;
  public static derive<U>(...args: any[]): ReadonlySignal<U> {
    const signals = args.slice(0, -1) as VSignal<any>[];
    const getDerivedValue = args[args.length - 1] as (...args: any[]) => U;

    const depValues: any[] = [];
    for (let i = 0; i < signals.length; i++) {
      depValues.push(signals[i]!.get());
    }
    const derivedSignal = new VReadonlySignal<U>(null as any);
    derivedSignal.isDirty = true;
    derivedSignal.isDerived = true;
    derivedSignal.lastUsedDeps = [];
    derivedSignal.deriveFn = getDerivedValue;
    derivedSignal.derivedFrom = signals;

    for (let i = 0; i < signals.length; i++) {
      signals[i]!.derivedSignals.push(new WeakRef(derivedSignal));
    }

    return derivedSignal;
  }

  public static bind<const E extends object, const K extends keyof E>(
    signal: ReadonlySignal<E[K]>,
    element: E,
    key: K,
  ) {
    registerBoundSignal(element, signal);
    const elemRef = new WeakRef(element);

    const l = signal.add((value) => {
      const element = elemRef.deref();
      if (element) {
        element[key] = value;
      } else {
        l?.detach();
      }
    });
  }

  public static bindAttribute<const E extends Element>(
    signal: ReadonlySignal<string | undefined> | ReadonlySignal<string>,
    element: E,
    key: string,
  ) {
    const elemRef = new WeakRef(element);

    const l = signal.add((value) => {
      const element = elemRef.deref();
      if (element) {
        if (value == null) {
          element.removeAttribute(key);
        } else {
          element.setAttribute(key, value);
        }
      } else {
        l?.detach();
      }
    });

    registerBoundSignal(element, signal);
  }

  public static as<T>(v: T | ReadonlySignal<T>): ReadonlySignal<T> {
    if (v instanceof VSignal) {
      return v;
    }

    const s = new VReadonlySignal(v as T);

    s.isDerived = true;
    s.lastUsedDeps = [];
    s.deriveFn = () => v as T;
    s.derivedFrom = [];

    return s;
  }

  private static arrCompare(a: any[], b: any[]) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  private listeners: SignalListenerReference<T>[] = [];
  private derivedSignals: WeakRef<VSignal<any>>[] = [];
  private value: T;
  private deriveFn?: (...parentSigsVals: any[]) => T;
  private derivedFrom: Array<
    VSignal<any> | DestroyedParentSigSubstitute
  > = [];
  private isDirty = false;
  private isDerived = false;

  constructor(value: T) {
    this.value = value;
  }

  private beforeAccess() {
    if (this.isDirty) {
      this.update();
    }
  }

  private lastUsedDeps: any[] = [];

  private update(): boolean {
    if (this.deriveFn) {
      const depValues: any[] = [];
      for (let i = 0; i < this.derivedFrom.length; i++) {
        depValues.push(this.derivedFrom[i]!.get());
      }
      if (VSignal.arrCompare(depValues, this.lastUsedDeps)) {
        return false;
      }
      this.lastUsedDeps = depValues;
      const v = this.deriveFn.apply(null, depValues);
      this.isDirty = false;
      if (Object.is(v, this.value)) {
        return false;
      }
      this.value = v;
      return true;
    }
    return false;
  }

  private updateAndPropagate() {
    const changed = this.update();
    if (changed) {
      this.propagateChange();
    }
  }

  private notifyListeners() {
    for (let i = 0; i < this.listeners.length; i++) {
      const listenerRef = this.listeners[i]!;
      try {
        listenerRef.callback(this.value);
      } catch (e) {
        console.error(e);
      }
    }
  }

  private forEachSink(fn: (sinkSig: VSignal<any>) => void) {
    for (let i = 0; i < this.derivedSignals.length; i++) {
      const sig = this.derivedSignals[i]!.deref();
      if (sig) {
        fn(sig);
      } else {
        this.derivedSignals.splice(i, 1);
        i--;
      }
    }
  }

  private notifySinks() {
    this.forEachSink((sig) => {
      if (sig.listeners.length === 0) {
        sig.isDirty = true;
        sig.notifySinks();
      } else {
        sig.updateAndPropagate();
      }
    });
  }

  private propagateChange() {
    this.notifyListeners();
    this.notifySinks();
  }

  public add(listener: SignalListener<T>): SignalListenerReference<T> {
    this.beforeAccess();

    if (typeof listener !== "function") {
      throw new Error("Signal.add(): listener must be a function");
    }

    let isDetached = false;
    const lRef: SignalListenerReference<T> = Object.freeze({
      signal: this,
      callback: listener as SignalListener<unknown>,
      detach: () => {
        if (isDetached) {
          return;
        }
        const idx = this.listeners.findIndex((l) => l === lRef);
        this.listeners.splice(idx, 1);
        isDetached = true;
      },
    });

    this.listeners.push(lRef);

    try {
      listener(this.value);
    } catch (e) {
      console.error(e);
    }

    return lRef;
  }

  public observe(listener: SignalListener<T>): SignalListenerReference<T> {
    this.beforeAccess();

    if (typeof listener !== "function") {
      throw new Error("Signal.add(): listener must be a function");
    }

    let isDetached = false;
    const lRef: SignalListenerReference<T> = Object.freeze({
      signal: this,
      callback: listener as SignalListener<unknown>,
      detach: () => {
        if (isDetached) {
          return;
        }
        const idx = this.listeners.findIndex((l) => l === lRef);
        this.listeners.splice(idx, 1);
        VSignal.GlobalListeners.delete(lRef);
        isDetached = true;
      },
    });

    this.listeners.push(lRef);
    VSignal.GlobalListeners.add(lRef);

    try {
      listener(this.value);
    } catch (e) {
      console.error(e);
    }

    return lRef;
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

    if (this.isDerived) {
      batchQueue.add(this, isObserved);
    }
    return isObserved;
  }

  private dispatchBatched(
    value: T | DispatchFunc<T>,
    batchQueue: BatchQueue,
  ): void {
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

  public get(): T {
    this.beforeAccess();
    return this.value;
  }

  public detachListeners(deep = false): void {
    const detachedListeners = this.listeners.splice(0, this.listeners.length);
    for (let i = 0; i < detachedListeners.length; i++) {
      const lRef = detachedListeners[i]!;
      VSignal.GlobalListeners.delete(lRef);
    }
    if (deep) {
      this.forEachSink(sig => {
        sig.detachListeners(deep);
      });
    }
  }

  public detachSinks(deep = false) {
    this.forEachSink(sig => {
      sig.onParentDestroyed(this);
      if (deep) {
        sig.detachSinks(deep);
      }
    });
    this.derivedSignals.splice(
      0,
      this.derivedSignals.length,
    );
  }

  public detachAll(deep = false) {
    this.detachListeners(deep);
    this.detachSinks(deep);
  }

  public listenerCount(): number {
    return this.listeners.length;
  }

  public derivedCount(): number {
    return this.derivedSignals.length;
  }

  public derive<U>(getDerivedValue: (current: T) => U): ReadonlySignal<U> {
    this.beforeAccess();

    const derivedSignal = new VReadonlySignal<U>(null as any);
    derivedSignal.isDirty = true;
    derivedSignal.isDerived = true;
    derivedSignal.lastUsedDeps = [];
    derivedSignal.deriveFn = getDerivedValue;
    derivedSignal.derivedFrom = [this];

    this.derivedSignals.push(new WeakRef(derivedSignal));
    return derivedSignal;
  }

  public readonly(): ReadonlySignal<T> {
    return this.derive(v => v);
  }

  public destroy(): void {
    this.detachListeners();
    this.add = this.add_destroyed;
    this.dispatch = this.dispatch_destroyed;
    this.derive = this.derive_destroyed;
    if (this.isDirty) {
      this.update();
    }
    this.deriveFn = undefined;
    this.derivedFrom.forEach((s) => {
      // @ts-expect-error
      s.removeDerivedChild(this);
    });
    this.derivedFrom.splice(0, this.derivedFrom.length);
    for (let i = 0; i < this.derivedSignals.length; i++) {
      const childSig = this.derivedSignals[i]!;
      childSig.deref()?.onParentDestroyed(this);
    }
    this.derivedSignals.splice(0, this.derivedSignals.length);
  }

  /**
   * Destroys this derived signal if all of its parents were destroyed.
   * (should be called by the parent to inform the child
   * that it will never dispatch any changes)
   */
  private onParentDestroyed(parentSig: VSignal<any>) {
    for (let i = 0; i < this.derivedFrom.length; i++) {
      const s = this.derivedFrom[i]!;
      if (s === parentSig) {
        // since this derived sig has been destroyed it will no longer ever change
        // we can just take it's value and lose the ref to the sig itself
        const stableValue = parentSig.get();
        const substitute: DestroyedParentSigSubstitute = {
          get: () => stableValue,
          removeDerivedChild: noop,
          IS_SUBSTITUTE: true,
        };
        this.derivedFrom[i] = substitute;
        break;
      }
    }

    if (this.derivedFrom.every(s => "IS_SUBSTITUTE" in s)) {
      this.destroy();
    }
  }

  /**
   * Removes the child signal from the list of derived signals.
   * (should be called by the child to inform the parent
   * that it doesn't need to be updated anymore)
   */
  protected removeDerivedChild(signal: VSignal<any>): void {
    this.derivedSignals = this.derivedSignals.filter((ref) => {
      const s = ref.deref();
      return s != null && s !== signal;
    });
  }

  private add_destroyed(_: SignalListener<T>): never {
    throw new Error(
      "VSignal.add(): cannot add listeners to a destroyed signal",
    );
  }

  private dispatch_destroyed(_: T | DispatchFunc<T>): never {
    throw new Error(
      "VSignal.dispatch(): cannot dispatch on a destroyed signal",
    );
  }

  private derive_destroyed(_: (current: any) => any): never {
    throw new Error("VSignal.derive(): cannot derive from a destroyed signal");
  }
}

/**
 * Class containing the actual implementation of the VanillaJSX ReadonlySignal.
 */
class VReadonlySignal<T> extends VSignal<T> {
  public dispatch(_: T | DispatchFunc<T>): void {
    throw new Error(
      "VSignal.dispatch(): cannot dispatch on a read-only signal",
    );
  }

  public readonly(): ReadonlySignal<T> {
    return this;
  }
}

interface SignalConstructor {
  <T>(value: T): Signal<T>;

  /**
   * A batch allows to group signal dispatches together.
   *
   * Batching prevents listener from being called more than once
   * if a signal was was dispatched to multiple times in the same batch,
   * or if a signal has multiple source signals that were dispatched to.
   *
   * Also reading values of signals within a batch will always return the
   * values as they were before the batch started, ignoring any dispatches
   * made after the batch started.
   *
   * To apply the changes made within the batch call `commitBatch()`.
   */
  startBatch(): void;
  commitBatch(): void;

  /**
   * Allows to create a derived signal from more than one source signal.
   *
   * @example
   *
   * const source1 = sig(1);
   * const source2 = sig(2);
   *
   * const derived = sig.derive(source1, source2, (v1, v2) => v1 + v2);
   */
  derive: typeof VSignal.derive;

  /**
   * Binds the value carried by the Signal to the given object's property
   * using a Weak Reference. This relation using Weak Reference does not
   * prevent the element from being Garbage Collected making it safe to
   * bind-and-forget, removing the need to manually detach the listener.
   */
  bind: typeof VSignal.bind;

  /**
   * Similar to `sig.bind()` but for HTML Element attributes.
   */
  bindAttribute: typeof VSignal.bindAttribute;

  /**
   * Returns the given value as a Readonly Signal.
   *
   * If the given value is already a signal it will return it as is,
   * otherwise it will create a new read-only signal.
   */
  as: typeof VSignal.as;
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
signal.bind = VSignal.bind;
signal.bindAttribute = VSignal.bindAttribute;
signal.as = VSignal.as;

/**
 * Alias for `signal()`.
 */
const sig = signal;

export { sig, signal, VReadonlySignal, VSignal };
