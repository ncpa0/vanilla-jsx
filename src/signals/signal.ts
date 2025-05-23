import {
  createDraft,
  finishDraft,
  isDraft,
  Objectish,
  type WritableDraft,
} from "immer";
import { registerBoundSignal, Widen } from "./utils";

class PropagationAbortSignal {
  static extend(abortSig: PropagationAbortSignal) {
    const sub = Object.create(abortSig, {
      abort: {
        value: function() {
          sub._isAborted = true;
        },
      },
    });
    return sub;
  }

  private _isAborted = false;

  constructor() {}

  get isAborted() {
    return this._isAborted;
  }

  abort() {
    this._isAborted = true;
  }
}

export type DeriveFn<T extends any[], U> =
  | ((...args: T) => ReadonlySignal<U>)
  | ((...args: T) => U);

export type DispatchFunc<T> = (current: T) => T;
export type ImmerDispatchFunc<T> = (
  current: T extends Objectish ? WritableDraft<T> : T,
) => T | WritableDraft<T> | void;
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

export type CompareFn<T> = (a: T, b: T) => boolean;
type Deps = [value: any, compareFn: CompareFn<any>][];

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
  derive<U>(
    getDerivedValue: DeriveFn<[T], U>,
    options?: SignalOptions<U>,
  ): ReadonlySignal<U>;
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
  /**
   * Derive Map
   *
   * Similar to `Array.map()`, equivalent to `signal.derive(list => list.map(mapFn))`
   *
   * Can only be used if the signal value is an Array.
   */
  $map<R>(
    mapFn: T extends any[] ? (elem: T[number], index: number) => R : never,
  ): ReadonlySignal<R[]>;
  /**
   * Similar to `Array.includes()`, equivalent to `signal.derive(list => list.includes(value))`
   *
   * Can only be used if the signal value is an Array.
   */
  $includes(
    value: T extends any[] ? Widen<T[number]> : never,
  ): ReadonlySignal<boolean>;
  /**
   * Derive Property
   *
   * Create a new readonly signal from the current signal object by extracting it's given property.
   * Equvalent to `signal.derive(obj => obj[key])`
   *
   * Can only be used if the signal value is an Object.
   */
  $prop<K extends keyof T>(key: K): ReadonlySignal<T[K]>;
  /**
   * Creates a derived signal containing the length of the value in the parent signal, equivalent
   * to `signal.derive(value => value.length)`.
   */
  $len(): T extends string | { length: number } ? ReadonlySignal<number>
    : never;
  /**
   * Creates a derived signal with the given value if the parent signal is null or undefined, equivalent to `signal.derive(value => value ?? defaultValue)`.
   */
  $or(defaultValue: NonNullable<T>): ReadonlySignal<NonNullable<T>>;
  /**
   * Derive a object with a subset of properties.
   *
   * Create a new readonly signal from the current signal obbject by copying over the selected
   * object properties. This derived signal will evaluate each of those props when determining
   * if the value has changed and needs to be updated.
   *
   * Can only be used if the signal value is an Object.
   */
  $pick<F extends keyof T>(...properties: F[]): ReadonlySignal<Pick<T, F>>;
  /**
   * Derive a object with a subset of properties.
   *
   * Create a new readonly signal from the current signal object by copying over all the properties
   * except the ones specified. This derived signal will evaluate each of those props when determining
   * if the value has changed and needs to be updated.
   *
   * Can only be used if the signal value is an Object.
   */
  $omit<F extends keyof T>(...properties: F[]): ReadonlySignal<Omit<T, F>>;
}

export interface Signal<T> extends ReadonlySignal<T> {
  /**
   * Updates the value of the signal, and if the value has changed notifies
   * all listeners and derived signals.
   */
  dispatch(value: T | DispatchFunc<T>): void;
  /**
   * Similar to `dispatch((v: T) => T)` but uses immer to provide the current value as a WriteableDraft.
   * If the returned value is that draft or `undefined` it will finish that draft and use it as the final value.
   * If the returned value is neither `undefined` or a draft, that returned value will be used as the new signal state
   * as is.
   *
   * See https://immerjs.github.io/immer/ to learn more about immer.
   */
  immer(update: ImmerDispatchFunc<T>): void;
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
  iseq: CompareFn<any>;
  removeDerivedChild(s: VSignal<any>): void;
};

function isDispatchFunc<T>(
  value: T | DispatchFunc<T>,
): value is DispatchFunc<T> {
  return typeof value === "function";
}

function isObjWithLen(value: unknown): value is { length: number } {
  return typeof value === "object" && value !== null
    && typeof (value as Record<string, unknown>).length === "number";
}

function noop() {}

type BatchQueue = InstanceType<(typeof VSignal)["BatchQueue"]>;

type BatchEntry = [signal: VSignal<any>, isObserved: boolean];

type Truthy<T> = Exclude<T, null | undefined | void | false | "">;
type DeNull<T> = Exclude<T, null | undefined | void>;

export type SignalOptions<T> = {
  name?: string;
  /**
   * Signals do not run listeners when the dispatched value is the same as the
   * current value, to check if the values are the same `Object.is()` is used, you
   * can specify your own comparison function here instead.
   */
  compare?: (a: T, b: T) => boolean;
};

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
        signal.propagateChangeOmitSinks();
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
            signal.propagateChangeOmitSinks();
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

  public static literal(
    template: ReadonlyArray<string>,
    ...args: (string | ReadonlySignal<any>)[]
  ): ReadonlySignal<string> {
    const deriveFn = (...values: any[]) => {
      let result = "";
      for (let i = 0; i < template.length; i++) {
        result += template[i]!;
        if (i < values.length) {
          const value = values[i];
          result += String(value);
        }
      }
      return result;
    };
    return VSignal.derive.apply(null, [
      ...args.map((a) => (a instanceof VSignal ? a : VSignal.as(a))),
      deriveFn,
    ] as any) as any;
  }

  /**
   * Equivalent of the "or" (`||`) operator but for signals.
   */
  public static or<T1, T2>(
    v1: T1 | ReadonlySignal<T1>,
    v2: T2 | ReadonlySignal<T2>,
  ): ReadonlySignal<Truthy<T1> | T2>;
  public static or<T1, T2, T3>(
    v1: T1 | ReadonlySignal<T1>,
    v2: T2 | ReadonlySignal<T2>,
    v3: T3 | ReadonlySignal<T3>,
  ): ReadonlySignal<Truthy<T1> | Truthy<T2> | T3>;
  public static or<T1, T2, T3, T4>(
    v1: T1 | ReadonlySignal<T1>,
    v2: T2 | ReadonlySignal<T2>,
    v3: T3 | ReadonlySignal<T3>,
    v4: T4 | ReadonlySignal<T4>,
  ): ReadonlySignal<Truthy<T1> | Truthy<T2> | Truthy<T3> | T4>;
  public static or(...values: any[]): ReadonlySignal<any> {
    const signals = values.map((v) => VSignal.as(v));
    const deriveFn = (...values: any[]) => {
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (value) return value;
      }
      return undefined;
    };
    return VSignal.derive.apply(null, [...signals, deriveFn] as any);
  }

  /**
   * Equivalent of the "nullish coalesscent" (`??`) operator but for signals.
   */
  public static nuc<T1, T2>(
    v1: T1 | ReadonlySignal<T1>,
    v2: T2 | ReadonlySignal<T2>,
  ): ReadonlySignal<DeNull<T1> | T2>;
  public static nuc<T1, T2, T3>(
    v1: T1 | ReadonlySignal<T1>,
    v2: T2 | ReadonlySignal<T2>,
    v3: T3 | ReadonlySignal<T3>,
  ): ReadonlySignal<DeNull<T1> | DeNull<T2> | T3>;
  public static nuc<T1, T2, T3, T4>(
    v1: T1 | ReadonlySignal<T1>,
    v2: T2 | ReadonlySignal<T2>,
    v3: T3 | ReadonlySignal<T3>,
    v4: T4 | ReadonlySignal<T4>,
  ): ReadonlySignal<DeNull<T1> | DeNull<T2> | DeNull<T3> | T4>;
  public static nuc(...values: any[]): ReadonlySignal<any> {
    const signals = values.map((v) => VSignal.as(v));
    const deriveFn = (...values: any[]) => {
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (value != null) return value;
      }
      return undefined;
    };
    return VSignal.derive.apply(null, [...signals, deriveFn] as any);
  }

  /**
   * Equivalent of the "and" (`&&`) operator but for signals.
   */
  public static and<T1, T2>(
    v1: T1 | ReadonlySignal<T1>,
    v2: T2 | ReadonlySignal<T2>,
  ): ReadonlySignal<T2 | undefined>;
  public static and<T1, T2, T3>(
    v1: T1 | ReadonlySignal<T1>,
    v2: T2 | ReadonlySignal<T2>,
    v3: T3 | ReadonlySignal<T3>,
  ): ReadonlySignal<T3 | undefined>;
  public static and<T1, T2, T3, T4>(
    v1: T1 | ReadonlySignal<T1>,
    v2: T2 | ReadonlySignal<T2>,
    v3: T3 | ReadonlySignal<T3>,
    v4: T4 | ReadonlySignal<T4>,
  ): ReadonlySignal<T4 | undefined>;
  public static and(...values: any[]): ReadonlySignal<any> {
    const signals = values.map((v) => VSignal.as(v));
    const deriveFn = (...values: any[]) => {
      for (let i = 0; i < values.length; i++) {
        const isLast = i === values.length - 1;
        const value = values[i];
        if (isLast) return value;
        if (!value) break;
      }
      return undefined;
    };
    return VSignal.derive.apply(null, [...signals, deriveFn] as any);
  }

  /**
   * Equivalent of the "not" (`!`) operator but for signals.
   */
  public static not<T>(value: T | ReadonlySignal<T>): ReadonlySignal<boolean> {
    return VSignal.derive(VSignal.as(value), (v) => !v);
  }

  /**
   * Returns a boolean signal that tells if the two given values/signals are equal.
   */
  public static eq<T>(
    a: T | ReadonlySignal<T>,
    b: T | ReadonlySignal<T>,
  ): ReadonlySignal<boolean> {
    return VSignal.derive(VSignal.as(a), VSignal.as(b), (a, b) => a === b);
  }

  public static includes<T>(
    arrSig: ReadonlySignal<T[]>,
    value: Widen<T> | ReadonlySignal<Widen<T>>,
  ): ReadonlySignal<boolean> {
    return VSignal.derive(arrSig, VSignal.as(value), (arr, value) => {
      return arr.includes(value as T);
    });
  }

  /**
   * Similar to the ternary conditional expression. Given a condition,
   * the second or the third value will be the value of resulting signal.
   *
   * @example
   * sig.when(isDarkMode, darkTheme, lightTheme);
   * // works similar to
   * isDarkMode ? darkTheme : lightTheme;
   */
  static when<T, U>(
    condition: ReadonlySignal<any>,
    then: ReadonlySignal<T> | T,
    els: ReadonlySignal<U> | U,
  ): ReadonlySignal<T | U> {
    return VSignal.derive(
      VSignal.as(condition),
      VSignal.as(then),
      VSignal.as(els),
      (c, t, e) => (c ? t : e),
    );
  }

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
  public static derive<E, U>(
    sig1: ReadonlySignal<E>,
    getDerivedValue: DeriveFn<[E], U>,
    options?: SignalOptions<U>,
  ): ReadonlySignal<U>;
  public static derive<E, F, U>(
    sig1: ReadonlySignal<E>,
    sig2: ReadonlySignal<F>,
    getDerivedValue: DeriveFn<[E, F], U>,
    options?: SignalOptions<U>,
  ): ReadonlySignal<U>;
  public static derive<E, F, G, U>(
    sig1: ReadonlySignal<E>,
    sig2: ReadonlySignal<F>,
    sig3: ReadonlySignal<G>,
    getDerivedValue: DeriveFn<[E, F, G], U>,
    options?: SignalOptions<U>,
  ): ReadonlySignal<U>;
  public static derive<E, F, G, H, U>(
    sig1: ReadonlySignal<E>,
    sig2: ReadonlySignal<F>,
    sig3: ReadonlySignal<G>,
    sig4: ReadonlySignal<H>,
    getDerivedValue: DeriveFn<[E, F, G, H], U>,
    options?: SignalOptions<U>,
  ): ReadonlySignal<U>;
  public static derive<E, F, G, H, I, U>(
    sig1: ReadonlySignal<E>,
    sig2: ReadonlySignal<F>,
    sig3: ReadonlySignal<G>,
    sig4: ReadonlySignal<H>,
    sig5: ReadonlySignal<I>,
    getDerivedValue: DeriveFn<[E, F, G, H, I], U>,
    options?: SignalOptions<U>,
  ): ReadonlySignal<U>;
  public static derive<E, F, G, H, I, J, U>(
    sig1: ReadonlySignal<E>,
    sig2: ReadonlySignal<F>,
    sig3: ReadonlySignal<G>,
    sig4: ReadonlySignal<H>,
    sig5: ReadonlySignal<I>,
    sig6: ReadonlySignal<J>,
    getDerivedValue: DeriveFn<[E, F, G, H, I, J], U>,
    options?: SignalOptions<U>,
  ): ReadonlySignal<U>;
  public static derive<U>(...args: any[]): ReadonlySignal<U> {
    let options: SignalOptions<any> | undefined;
    if (typeof args.at(-1) === "object") {
      options = args.pop();
    }
    const getDerivedValue = args.pop() as (...args: any[]) => U;
    const signals = args as VSignal<any>[];

    if (typeof getDerivedValue !== "function") {
      throw new TypeError(
        "VSignal.derive: derive function argument given is not a function",
      );
    }

    const depValues: any[] = [];
    for (let i = 0; i < signals.length; i++) {
      depValues.push(signals[i]!.get());
    }
    const derivedSignal = new VReadonlySignal<U>(null as any, options);
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

  public static bindv<const E extends object, const K extends keyof E>(
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

  /**
   * Returns the given value as a Readonly Signal.
   *
   * If the given value is already a signal it will return it as is,
   * otherwise it will create a new read-only signal.
   */
  public static as<T>(v: T | ReadonlySignal<T>): ReadonlySignal<T> {
    if (v instanceof VSignal) {
      return v as ReadonlySignal<T>;
    }

    const s = new VReadonlySignal(v as T);

    s.isDerived = true;
    s.lastUsedDeps = [];
    s.deriveFn = () => v as T;
    s.derivedFrom = [];

    return s;
  }

  private static depsCompare(a: Deps, b: Deps) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      const [aVal, aCmp] = a[i]!;
      const [bVal, bCmp] = b[i]!;
      const cmp = aCmp === bCmp ? aCmp : Object.is;
      if (!cmp(aVal, bVal)) {
        return false;
      }
    }
    return true;
  }

  protected readonly name?: string;
  protected isdestroyed = false;
  private listeners: SignalListenerReference<T>[] = [];
  private derivedSignals: WeakRef<VSignal<any>>[] = [];
  private value: T;
  private deriveFn?: (...parentSigsVals: any[]) => T | ReadonlySignal<T>;
  private derivedFrom: Array<VSignal<any> | DestroyedParentSigSubstitute> = [];
  private dynamicDerivedFrom?: VSignal<any>;
  private isDirty = false;
  private isDerived = false;
  private iseq: CompareFn<T> = Object.is;

  constructor(value: T, options?: SignalOptions<T>) {
    this.value = value;
    this.name = options?.name;
    if (options?.compare) {
      this.iseq = options.compare;
    }
  }

  private beforeAccess() {
    if (this.isDirty) {
      this.update();
    }
  }

  private lastUsedDeps: Deps = [];
  private derivedAtLeastOnce = false;

  private assignDerived(deps: any[], notifiedBy?: VSignal<any>) {
    if (notifiedBy && notifiedBy === this.dynamicDerivedFrom) {
      const v = notifiedBy.get();
      const changed = !Object.is(v, this.value);
      this.value = v;
      this.isDirty = false;
      return changed;
    }

    const v = this.deriveFn!.apply(null, deps);

    let changed = false;

    if (v instanceof VSignal) {
      const nv = v.get();
      changed = !this.derivedAtLeastOnce || !this.iseq(nv, this.value);
      this.derivedAtLeastOnce = true;

      if (v === this.dynamicDerivedFrom) {
        this.value = nv;
      } else {
        if (this.dynamicDerivedFrom != null) {
          this.dynamicDerivedFrom.removeDerivedChild(this);
        }
        this.dynamicDerivedFrom = v;
        this.value = nv;
        v.derivedSignals.push(new WeakRef(this));
      }
    } else {
      changed = !this.derivedAtLeastOnce || !this.iseq(v as T, this.value);
      this.derivedAtLeastOnce = true;
      this.value = v as T;
    }
    this.isDirty = false;
    return changed;
  }

  private update(notifiedBy?: VSignal<any>): boolean {
    if (this.deriveFn) {
      const dependencies: Deps = new Array(this.derivedFrom.length);
      const depValues: any[] = new Array(this.derivedFrom.length);

      for (let i = 0; i < this.derivedFrom.length; i++) {
        const value = this.derivedFrom[i]!.get();
        dependencies[i] = [value, (this.derivedFrom[i]! as VSignal<any>).iseq];
        depValues[i] = value;
      }
      if (
        this.dynamicDerivedFrom == null
        && VSignal.depsCompare(dependencies, this.lastUsedDeps)
      ) {
        return false;
      }
      const prevDeps = this.lastUsedDeps;
      this.lastUsedDeps = dependencies;
      try {
        return this.assignDerived(depValues, notifiedBy);
      } catch (e) {
        this.lastUsedDeps = prevDeps;
        console.error(e);
      }
    }
    return false;
  }

  private updateAndPropagate(
    abortSig?: PropagationAbortSignal,
    notifiedBy?: VSignal<any>,
  ) {
    const changed = this.update(notifiedBy);
    if (changed) {
      this.propagateChange(abortSig);
    }
  }

  private notifyListeners(abortSig: PropagationAbortSignal) {
    for (let i = 0; i < this.listeners.length; i++) {
      const listenerRef = this.listeners[i]!;
      try {
        listenerRef.callback(this.value);
      } catch (e) {
        console.error(e);
      }
      if (abortSig.isAborted) {
        return;
      }
    }
  }

  private forEachSink(
    fn: (sinkSig: VSignal<any>, breakLoop: () => void) => void,
  ) {
    // Remove sinks that have been garbage collected
    for (let i = 0; i < this.derivedSignals.length; i++) {
      const sig = this.derivedSignals[i]!.deref();
      if (!sig) {
        this.derivedSignals.splice(i, 1);
        i--;
      }
    }

    let shouldBreak = false;
    const breakLoop = () => {
      shouldBreak = true;
    };
    const derived = this.derivedSignals.slice();
    for (let i = 0; i < derived.length; i++) {
      const sig = derived[i]!.deref();
      if (sig) {
        fn(sig, breakLoop);
        if (shouldBreak) break;
      }
    }
  }

  private notifySinks(abortSig: PropagationAbortSignal) {
    const notifiedBy = this;
    this.forEachSink((sig, _break) => {
      if (sig.dynamicDerivedFrom === notifiedBy) {
        sig.updateAndPropagate(abortSig, notifiedBy);
      } else if (sig.listeners.length === 0) {
        sig.isDirty = true;
        sig.notifySinks(abortSig);
      } else {
        sig.updateAndPropagate(abortSig, notifiedBy);
      }
      if (abortSig.isAborted) {
        _break();
      }
    });
  }

  private lastPropagationAbortSig: PropagationAbortSignal =
    new PropagationAbortSignal();

  private propagateChange(abs?: PropagationAbortSignal) {
    if (abs?.isAborted) return;

    this.lastPropagationAbortSig.abort();

    const abortSig = abs
      ? PropagationAbortSignal.extend(abs)
      : new PropagationAbortSignal();

    this.lastPropagationAbortSig = abortSig;
    this.notifyListeners(abortSig);
    if (abortSig.isAborted) return;
    this.notifySinks(abortSig);
  }

  private propagateChangeOmitSinks(abs?: PropagationAbortSignal) {
    if (abs?.isAborted) return;

    this.lastPropagationAbortSig.abort();

    const abortSig = abs
      ? PropagationAbortSignal.extend(abs)
      : new PropagationAbortSignal();

    this.lastPropagationAbortSig = abortSig;
    this.notifyListeners(abortSig);
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

    if (this.iseq(prevValue, newValue)) {
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

    if (!this.iseq(prevValue, this.value)) {
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

  public immer(update: ImmerDispatchFunc<T>): void {
    const dispatchFn = (currentValue: T) => {
      if (typeof currentValue === "object" && currentValue !== null) {
        const draft = createDraft(currentValue as object);
        const newVal = update(draft as any);
        if (isDraft(newVal)) {
          return finishDraft(newVal) as T;
        }
        if (newVal === undefined) {
          return finishDraft(draft) as T;
        }
        return newVal as T;
      } else {
        return (update(currentValue as any) ?? currentValue) as T;
      }
    };

    if (VSignal.batchQueue) {
      this.dispatchBatched(dispatchFn, VSignal.batchQueue);
    } else {
      this.dispatchEager(dispatchFn);
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
      this.forEachSink((sig) => {
        sig.detachListeners(deep);
      });
    }
  }

  public detachSinks(deep = false) {
    this.forEachSink((sig) => {
      sig.onParentDestroyed(this);
      if (deep) {
        sig.detachSinks(deep);
      }
    });
    this.derivedSignals.splice(0, this.derivedSignals.length);
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

  public derive<U>(
    getDerivedValue: DeriveFn<[T], U>,
    options?: SignalOptions<U>,
  ): VReadonlySignal<U> {
    this.beforeAccess();

    const derivedSignal = new VReadonlySignal<U>(null as any, options);
    derivedSignal.isDirty = true;
    derivedSignal.isDerived = true;
    derivedSignal.lastUsedDeps = [];
    derivedSignal.deriveFn = getDerivedValue;
    derivedSignal.derivedFrom = [this];

    this.derivedSignals.push(new WeakRef(derivedSignal));
    return derivedSignal;
  }

  public $map<R>(mapFn: (elem: any, index: number) => R): ReadonlySignal<R[]> {
    return this.derive((value) => {
      if (!Array.isArray(value)) {
        throw new Error("value is not an array");
      }
      return value.map(mapFn);
    });
  }

  public $includes(elem: any): ReadonlySignal<boolean> {
    return this.derive((value) => {
      if (!Array.isArray(value)) {
        throw new Error("value is not an array");
      }
      return value.includes(elem);
    });
  }

  public $prop<K extends keyof T>(key: K): ReadonlySignal<T[K]> {
    return this.derive((value) => {
      if (typeof value !== "object" || value == null) {
        throw new Error("value is not an object");
      }
      return value[key];
    });
  }

  public $len(): T extends string | { length: number } ? ReadonlySignal<number>
    : never
  {
    return this.derive((value) => {
      if (typeof value === "string") {
        return value.length;
      } else if (isObjWithLen(value)) {
        return value.length;
      }
      throw new Error("value has no length");
    }) as any;
  }

  public $or(defaultValue: NonNullable<T>): ReadonlySignal<NonNullable<T>> {
    return this.derive((value) => value ?? defaultValue);
  }

  public $pick<K extends keyof T>(...keys: K[]): ReadonlySignal<Pick<T, K>> {
    const s = this.derive((value): Record<K, any> => {
      if (typeof value !== "object" || value == null) {
        throw new TypeError("value is not an object");
      }
      const currentValue = s.value ?? {};

      let hasChanges = false;
      const newValue: Record<K, any> = {} as any;
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]!;
        if (!Object.is(value[key], currentValue[key])) {
          hasChanges = true;
        }
        newValue[key] = value[key];
      }

      if (hasChanges) return newValue;
      return currentValue;
    });

    return s;
  }

  public $omit<K extends keyof T>(
    ...excludeKeys: K[]
  ): ReadonlySignal<Omit<T, K>> {
    const s = this.derive((value): Record<Exclude<keyof T, K>, any> => {
      if (typeof value !== "object" || value == null) {
        throw new TypeError("value is not an object");
      }
      const currentValue = (s.value ?? {}) as Record<any, any>;

      let hasChanges = false;
      const newValue: Record<any, any> = {} as any;
      const okeys = Object.keys(value) as (keyof T)[];
      for (let i = 0; i < okeys.length; i++) {
        const key = okeys[i]!;

        if (excludeKeys.includes(key as any)) continue;

        if (!Object.is(value[key], currentValue[key])) {
          hasChanges = true;
        }
        newValue[key] = value[key];
      }

      if (hasChanges) return newValue;
      return currentValue;
    });

    return s;
  }

  private _readonlySelf?: WeakRef<ReadonlySignal<T>>;
  public readonly(): ReadonlySignal<T> {
    let result = this._readonlySelf?.deref();
    if (!result) {
      result = this.derive((v) => v);
      this._readonlySelf = new WeakRef(result);
    }
    return result;
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
    if (this.dynamicDerivedFrom) {
      this.dynamicDerivedFrom.removeDerivedChild(this);
      this.dynamicDerivedFrom = undefined;
    }
    for (let i = 0; i < this.derivedSignals.length; i++) {
      const childSig = this.derivedSignals[i]!;
      childSig.deref()?.onParentDestroyed(this);
    }
    this.derivedSignals.splice(0, this.derivedSignals.length);
    this.isdestroyed = true;
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
          iseq: parentSig.iseq,
          removeDerivedChild: noop,
          IS_SUBSTITUTE: true,
        };
        this.derivedFrom[i] = substitute;
        break;
      }
    }

    if (this.dynamicDerivedFrom === parentSig) {
      this.dynamicDerivedFrom = undefined;
    }

    if (
      this.dynamicDerivedFrom == null
      && this.derivedFrom.every((s) => "IS_SUBSTITUTE" in s)
    ) {
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

  get sinks() {
    return this.derivedSignals.map((ref) => ref.deref()).filter(Boolean);
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
  <T>(): Signal<T | undefined>;
  <T>(value: T, options?: SignalOptions<T>): Signal<T>;

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
  bindv: typeof VSignal.bindv;

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

  literal: typeof VSignal.literal;

  /**
   * Equivalent of the "or" (`||`) operator but for signals.
   */
  or: typeof VSignal.or;

  /**
   * Equivalent of the "nullish coalesscent" (`??`) operator but for signals.
   */
  nuc: typeof VSignal.nuc;

  /**
   * Equivalent of the "and" (`&&`) operator but for signals.
   */
  and: typeof VSignal.and;

  /**
   * Similar to the ternary conditional expression. Given a condition,
   * the second or the third value will be the value of resulting signal.
   *
   * @example
   * sig.when(isDarkMode, darkTheme, lightTheme);
   * // works similar to
   * isDarkMode ? darkTheme : lightTheme;
   */
  when: typeof VSignal.when;

  /**
   * Equivalent of the "not" (`!`) operator but for signals.
   */
  not: typeof VSignal.not;

  /**
   * Returns a boolean signal that tells if the two given values/signals are equal.
   */
  eq: typeof VSignal.eq;

  /**
   * Returns a boolean signal that tells if the given signal array includes a given value, where value can
   * be wrapped in a signal.
   */
  includes: typeof VSignal.includes;
}

/**
 * Create a new signal with the given initial value.
 *
 * `<T>(value: T): Signal<T>;`
 */
const signal: SignalConstructor = function signal(
  value?: any,
  options?: SignalOptions<any>,
) {
  return new VSignal(value, options);
};
signal.derive = VSignal.derive;
signal.startBatch = VSignal.startBatch;
signal.commitBatch = VSignal.commitBatch;
signal.bindv = VSignal.bindv;
signal.bindAttribute = VSignal.bindAttribute;
signal.as = VSignal.as;
signal.literal = VSignal.literal;
signal.or = VSignal.or;
signal.nuc = VSignal.nuc;
signal.and = VSignal.and;
signal.when = VSignal.when;
signal.not = VSignal.not;
signal.eq = VSignal.eq;
signal.includes = VSignal.includes;

/**
 * Alias for `signal()`.
 */
const sig = signal;

export { sig, signal, VReadonlySignal, VSignal };
